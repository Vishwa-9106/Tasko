import { Express, Request, Response } from "express";
import { db } from "./firebaseAdmin";

type PackageVisitFrequency = "daily" | "weekly" | "every_2_days" | "monthly";
type UserPackageStatus = "active" | "completed" | "cancelled";
type PackageScheduleStatus = "pending" | "assigned" | "completed";

type PackageRecord = {
  package_id: number;
  package_name: string;
  description: string;
  price: number;
  duration_days: number;
  visit_frequency: PackageVisitFrequency;
  status: boolean;
  created_at: string;
};

type PackageServiceRecord = {
  package_service_id: number;
  package_id: number;
  category_name: string;
  sub_category_name: string;
  service_frequency: string;
};

type UserPackageRecord = {
  user_package_id: number;
  user_id: number;
  package_id: number;
  start_date: string;
  end_date: string;
  status: UserPackageStatus;
  created_at: string;
};

type PackageScheduleRecord = {
  schedule_id: number;
  user_package_id: number;
  service_date: string;
  worker_id: number;
  status: PackageScheduleStatus;
};

type PackagePaymentRecord = {
  payment_id: number;
  user_package_id: number;
  amount: number;
  payment_method: string;
  payment_status: string;
  paid_at: string;
};

type CounterTableName =
  | "packages"
  | "package_services"
  | "user_packages"
  | "package_schedule"
  | "package_payments";

type SeedPackage = {
  package_name: string;
  description: string;
  price: number;
  duration_days: number;
  visit_frequency: PackageVisitFrequency;
  services: Array<{
    category_name: string;
    sub_category_name: string;
    service_frequency: string;
  }>;
};

const inMemoryPackages = new Map<number, PackageRecord>();
const inMemoryPackageServices = new Map<number, PackageServiceRecord>();
const inMemoryUserPackages = new Map<number, UserPackageRecord>();
const inMemoryPackageSchedules = new Map<number, PackageScheduleRecord>();
const inMemoryPackagePayments = new Map<number, PackagePaymentRecord>();
const inMemoryCounters = new Map<CounterTableName, number>();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isFirestoreUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("5 NOT_FOUND") ||
    message.includes("database (default) does not exist") ||
    message.includes("The caller does not have permission")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : "";
  }
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readInteger(value: unknown): number | null {
  const parsed = readNumber(value);
  if (parsed === null) {
    return null;
  }
  return Math.trunc(parsed);
}

function readBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "active", "enabled", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "inactive", "disabled", "no"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function parseDateLike(value: unknown, fallback: string): string {
  const text = readTrimmedString(value);
  if (!text) {
    return fallback;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed.toISOString();
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = readInteger(value);
  if (parsed === null || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseId(value: unknown): number | null {
  const parsed = readInteger(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseDurationDays(value: unknown, fallback = 30): number {
  const asInt = readInteger(value);
  if (asInt !== null && asInt > 0) {
    return asInt;
  }

  const text = readTrimmedString(value);
  if (!text) {
    return fallback;
  }

  const match = text.match(/\d+/);
  if (!match) {
    return fallback;
  }

  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function normalizeVisitFrequency(value: unknown): PackageVisitFrequency {
  const normalized = readTrimmedString(value).toLowerCase().replace(/\s+/g, "_");
  if (normalized === "daily") return "daily";
  if (normalized === "weekly") return "weekly";
  if (normalized === "every_2_days" || normalized === "every2days") return "every_2_days";
  if (normalized === "monthly") return "monthly";
  return "weekly";
}

function normalizePackageStatus(value: unknown): UserPackageStatus {
  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "completed") return "completed";
  if (normalized === "cancelled") return "cancelled";
  return "active";
}

function normalizeScheduleStatus(value: unknown): PackageScheduleStatus {
  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "assigned") return "assigned";
  if (normalized === "completed") return "completed";
  return "pending";
}

function resolvePackageId(input: Record<string, unknown>, docIdHint: string, fallback: number): number {
  const explicit = parseId(input.package_id);
  if (explicit !== null) {
    return explicit;
  }

  const fromDoc = parseId(docIdHint);
  if (fromDoc !== null) {
    return fromDoc;
  }

  return fallback;
}

function resolvePackageServiceId(input: Record<string, unknown>, docIdHint: string, fallback: number): number {
  const explicit = parseId(input.package_service_id);
  if (explicit !== null) {
    return explicit;
  }

  const fromDoc = parseId(docIdHint);
  if (fromDoc !== null) {
    return fromDoc;
  }

  return fallback;
}

function normalizePackageRecord(data: Record<string, unknown>, docIdHint: string): PackageRecord {
  const now = new Date().toISOString();
  const packageId = resolvePackageId(data, docIdHint, parsePositiveInt(inMemoryPackages.size + 1, 1));
  const packageName =
    readTrimmedString(data.package_name) ||
    readTrimmedString(data.name) ||
    readTrimmedString(data.title) ||
    `Tasko Package ${packageId}`;
  const description =
    readTrimmedString(data.description) || "Tasko recurring service package with verified professionals.";
  const price = readNumber(data.price) ?? 0;
  const duration_days = parseDurationDays(data.duration_days ?? data.duration, 30);
  const visit_frequency = normalizeVisitFrequency(data.visit_frequency ?? data.frequency);
  const status = readBoolean(data.status, true);
  const created_at = parseDateLike(data.created_at ?? data.createdAt, now);

  return {
    package_id: packageId,
    package_name: packageName,
    description,
    price: price < 0 ? 0 : price,
    duration_days,
    visit_frequency,
    status,
    created_at
  };
}

function normalizePackageServiceRecord(data: Record<string, unknown>, docIdHint: string): PackageServiceRecord {
  const serviceId = resolvePackageServiceId(data, docIdHint, parsePositiveInt(inMemoryPackageServices.size + 1, 1));
  const packageId = parsePositiveInt(data.package_id, 1);
  const category_name =
    readTrimmedString(data.category_name) ||
    readTrimmedString(data.category) ||
    "General Service";
  const sub_category_name =
    readTrimmedString(data.sub_category_name) ||
    readTrimmedString(data.service_name) ||
    readTrimmedString(data.name) ||
    "Service";
  const service_frequency =
    readTrimmedString(data.service_frequency) ||
    readTrimmedString(data.frequency) ||
    "weekly";

  return {
    package_service_id: serviceId,
    package_id: packageId,
    category_name,
    sub_category_name,
    service_frequency
  };
}

function toPackageCollectionPayload(record: PackageRecord): Record<string, unknown> {
  return {
    package_id: record.package_id,
    package_name: record.package_name,
    description: record.description,
    price: record.price,
    duration_days: record.duration_days,
    visit_frequency: record.visit_frequency,
    status: record.status,
    created_at: record.created_at
  };
}

function toPackageServiceCollectionPayload(record: PackageServiceRecord): Record<string, unknown> {
  return {
    package_service_id: record.package_service_id,
    package_id: record.package_id,
    category_name: record.category_name,
    sub_category_name: record.sub_category_name,
    service_frequency: record.service_frequency
  };
}

function updateInMemoryCounter(tableName: CounterTableName, candidateValue: number): void {
  const current = inMemoryCounters.get(tableName) || 0;
  if (candidateValue > current) {
    inMemoryCounters.set(tableName, candidateValue);
  }
}

function getNextInMemoryCounter(tableName: CounterTableName): number {
  const next = (inMemoryCounters.get(tableName) || 0) + 1;
  inMemoryCounters.set(tableName, next);
  return next;
}

async function getNextSequenceValue(tableName: CounterTableName): Promise<number> {
  try {
    const counterRef = db.collection("package_counters").doc(tableName);
    const nextValue = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(counterRef);
      const currentValue = parsePositiveInt(snapshot.data()?.value, 0);
      const candidateValue = currentValue + 1;
      transaction.set(
        counterRef,
        {
          table_name: tableName,
          value: candidateValue,
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
      return candidateValue;
    });

    updateInMemoryCounter(tableName, nextValue);
    return nextValue;
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return getNextInMemoryCounter(tableName);
}

async function ensureCounterBaseline(tableName: CounterTableName, minimumValue: number): Promise<void> {
  updateInMemoryCounter(tableName, minimumValue);

  try {
    const counterRef = db.collection("package_counters").doc(tableName);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(counterRef);
      const current = parsePositiveInt(snapshot.data()?.value, 0);
      if (current < minimumValue) {
        transaction.set(
          counterRef,
          {
            table_name: tableName,
            value: minimumValue,
            updated_at: new Date().toISOString()
          },
          { merge: true }
        );
      }
    });
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
}

async function savePackageRecord(record: PackageRecord): Promise<void> {
  try {
    await db.collection("packages").doc(String(record.package_id)).set(toPackageCollectionPayload(record), { merge: true });
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryPackages.set(record.package_id, record);
  await ensureCounterBaseline("packages", record.package_id);
}

async function savePackageServiceRecord(record: PackageServiceRecord): Promise<void> {
  try {
    await db
      .collection("package_services")
      .doc(String(record.package_service_id))
      .set(toPackageServiceCollectionPayload(record), { merge: true });
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryPackageServices.set(record.package_service_id, record);
  await ensureCounterBaseline("package_services", record.package_service_id);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunked: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunked.push(items.slice(index, index + size));
  }
  return chunked;
}

async function listAllPackages(): Promise<PackageRecord[]> {
  try {
    const snapshot = await db.collection("packages").get();
    const packages = snapshot.docs.map((document) => normalizePackageRecord(document.data(), document.id));
    packages.forEach((record) => {
      inMemoryPackages.set(record.package_id, record);
      updateInMemoryCounter("packages", record.package_id);
    });
    return packages.sort((left, right) => left.package_id - right.package_id);
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return Array.from(inMemoryPackages.values()).sort((left, right) => left.package_id - right.package_id);
}

async function listPackageServicesByPackageIds(packageIds: number[]): Promise<Map<number, PackageServiceRecord[]>> {
  const grouped = new Map<number, PackageServiceRecord[]>();
  if (packageIds.length === 0) {
    return grouped;
  }

  const packageIdSet = new Set(packageIds);

  try {
    const allRows: PackageServiceRecord[] = [];
    const chunks = chunkArray(Array.from(packageIdSet), 30);
    for (const packageIdChunk of chunks) {
      const snapshot = await db
        .collection("package_services")
        .where("package_id", "in", packageIdChunk)
        .get();
      snapshot.docs.forEach((document) => {
        const row = normalizePackageServiceRecord(document.data(), document.id);
        allRows.push(row);
      });
    }

    allRows.forEach((row) => {
      inMemoryPackageServices.set(row.package_service_id, row);
      updateInMemoryCounter("package_services", row.package_service_id);
    });

    allRows
      .sort((left, right) => left.package_service_id - right.package_service_id)
      .forEach((row) => {
        const list = grouped.get(row.package_id) || [];
        list.push(row);
        grouped.set(row.package_id, list);
      });

    return grouped;
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  Array.from(inMemoryPackageServices.values())
    .filter((service) => packageIdSet.has(service.package_id))
    .sort((left, right) => left.package_service_id - right.package_service_id)
    .forEach((service) => {
      const list = grouped.get(service.package_id) || [];
      list.push(service);
      grouped.set(service.package_id, list);
    });

  return grouped;
}

const samplePackages: SeedPackage[] = [
  {
    package_name: "Basic Home Care",
    description: "Daily home support package for essential household chores.",
    price: 999,
    duration_days: 30,
    visit_frequency: "daily",
    services: [
      {
        category_name: "Home Care",
        sub_category_name: "Floor Cleaning",
        service_frequency: "daily"
      },
      {
        category_name: "Home Care",
        sub_category_name: "Dish Washing",
        service_frequency: "daily"
      },
      {
        category_name: "Home Care",
        sub_category_name: "Trash Cleaning",
        service_frequency: "daily"
      }
    ]
  },
  {
    package_name: "Weekly Deep Cleaning",
    description: "Focused deep cleaning package for bathrooms, kitchens and windows.",
    price: 499,
    duration_days: 7,
    visit_frequency: "weekly",
    services: [
      {
        category_name: "Deep Cleaning",
        sub_category_name: "Bathroom Cleaning",
        service_frequency: "weekly"
      },
      {
        category_name: "Deep Cleaning",
        sub_category_name: "Kitchen Cleaning",
        service_frequency: "weekly"
      },
      {
        category_name: "Deep Cleaning",
        sub_category_name: "Window Cleaning",
        service_frequency: "weekly"
      }
    ]
  },
  {
    package_name: "Vehicle Care Package",
    description: "Recurring vehicle wash package for bikes and cars.",
    price: 799,
    duration_days: 30,
    visit_frequency: "every_2_days",
    services: [
      {
        category_name: "Vehicle Care",
        sub_category_name: "Bike Wash",
        service_frequency: "every_2_days"
      },
      {
        category_name: "Vehicle Care",
        sub_category_name: "Car Wash",
        service_frequency: "every_2_days"
      }
    ]
  },
  {
    package_name: "Beauty & Grooming",
    description: "At-home grooming essentials for monthly personal care.",
    price: 999,
    duration_days: 30,
    visit_frequency: "monthly",
    services: [
      {
        category_name: "Beauty & Grooming",
        sub_category_name: "Haircut",
        service_frequency: "monthly"
      },
      {
        category_name: "Beauty & Grooming",
        sub_category_name: "Beard Trim",
        service_frequency: "monthly"
      },
      {
        category_name: "Beauty & Grooming",
        sub_category_name: "Facial",
        service_frequency: "monthly"
      }
    ]
  },
  {
    package_name: "Garden Maintenance",
    description: "Weekly garden support for healthy lawn and plants.",
    price: 699,
    duration_days: 30,
    visit_frequency: "weekly",
    services: [
      {
        category_name: "Garden Maintenance",
        sub_category_name: "Grass Cutting",
        service_frequency: "weekly"
      },
      {
        category_name: "Garden Maintenance",
        sub_category_name: "Plant Watering",
        service_frequency: "weekly"
      }
    ]
  }
];

async function createSamplePackages(): Promise<void> {
  const now = new Date().toISOString();
  for (const packageInput of samplePackages) {
    const packageId = await getNextSequenceValue("packages");
    const packageRecord: PackageRecord = {
      package_id: packageId,
      package_name: packageInput.package_name,
      description: packageInput.description,
      price: packageInput.price,
      duration_days: packageInput.duration_days,
      visit_frequency: packageInput.visit_frequency,
      status: true,
      created_at: now
    };

    await savePackageRecord(packageRecord);

    for (const serviceInput of packageInput.services) {
      const packageServiceId = await getNextSequenceValue("package_services");
      const packageService: PackageServiceRecord = {
        package_service_id: packageServiceId,
        package_id: packageId,
        category_name: serviceInput.category_name,
        sub_category_name: serviceInput.sub_category_name,
        service_frequency: serviceInput.service_frequency
      };
      await savePackageServiceRecord(packageService);
    }
  }
}

export async function ensurePackagesBootstrapData(): Promise<void> {
  const counters: CounterTableName[] = [
    "packages",
    "package_services",
    "user_packages",
    "package_schedule",
    "package_payments"
  ];

  await Promise.all(counters.map((counter) => ensureCounterBaseline(counter, inMemoryCounters.get(counter) || 0)));

  const existingPackages = await listAllPackages();
  if (existingPackages.length > 0) {
    return;
  }

  await createSamplePackages();
}

export function registerPackageRoutes(app: Express): void {
  app.get("/api/packages", async (_req: Request, res: Response) => {
    try {
      const allPackages = await listAllPackages();
      const activePackages = allPackages.filter((item) => item.status);
      const packageServicesMap = await listPackageServicesByPackageIds(
        activePackages.map((item) => item.package_id)
      );

      const payload = activePackages.map((item) => {
        const serviceDetails = packageServicesMap.get(item.package_id) || [];
        const services = serviceDetails.map((service) => service.sub_category_name);

        return {
          package_id: item.package_id,
          package_name: item.package_name,
          description: item.description,
          price: item.price,
          duration_days: item.duration_days,
          visit_frequency: item.visit_frequency,
          status: item.status,
          created_at: item.created_at,
          services,
          service_details: serviceDetails.map((service) => ({
            package_service_id: service.package_service_id,
            package_id: service.package_id,
            category_name: service.category_name,
            sub_category_name: service.sub_category_name,
            service_frequency: service.service_frequency
          })),
          id: String(item.package_id),
          name: item.package_name,
          duration: `${item.duration_days} days`,
          frequency: item.visit_frequency
        };
      });

      return res.json(payload);
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch packages",
        error: getErrorMessage(error)
      });
    }
  });
}

