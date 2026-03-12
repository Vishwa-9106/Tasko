import { Express, Request, Response } from "express";
import { db } from "./firebaseAdmin";

type PackageVisitFrequency = "daily" | "weekly" | "every_2_days" | "monthly";
type PackageStatus = "active" | "disabled";
type CounterTableName =
  | "packages"
  | "package_services"
  | "user_packages"
  | "package_schedule"
  | "package_payments";

type PackageRecord = {
  package_id: number;
  name: string;
  package_name: string;
  category: string;
  description: string;
  price: number;
  duration_days: number;
  visit_frequency: PackageVisitFrequency;
  services_included: string[];
  package_tag: string;
  display_order: number;
  status: PackageStatus;
  created_at: string;
  updated_at: string;
};

type PackageServiceRecord = {
  package_service_id: number;
  package_id: number;
  category_name: string;
  sub_category_name: string;
  service_frequency: string;
  created_at: string;
  updated_at: string;
};

type UserPackageStatus = "pending" | "active" | "completed" | "cancelled";
type UserPackagePaymentStatus = "paid" | "pending" | "failed";
type PackageTimeSlot = "morning" | "afternoon" | "evening";

type UserPackageRecord = {
  user_package_id: number;
  user_id: string;
  package_id: number;
  package_name: string;
  package_price: number;
  package_duration_days: number;
  address_id: string;
  address_title: string;
  street: string;
  city: string;
  pincode: string;
  start_date: string;
  end_date: string;
  time_slot: PackageTimeSlot;
  status: UserPackageStatus;
  payment_status: UserPackagePaymentStatus;
  payment_method: string;
  assigned_worker_id: string;
  assigned_worker_name: string;
  created_at: string;
  updated_at: string;
};

type SeedPackage = {
  name: string;
  category: string;
  description: string;
  price: number;
  duration_days: number;
  visit_frequency: PackageVisitFrequency;
  services: string[];
  package_tag?: string;
  display_order: number;
};

type RegisterPackageRoutesOptions = {
  validateAdminSession: (token: string) => boolean;
};

const inMemoryPackages = new Map<number, PackageRecord>();
const inMemoryPackageServices = new Map<number, PackageServiceRecord>();
const inMemoryUserPackages = new Map<number, UserPackageRecord>();
const inMemoryCounters = new Map<CounterTableName, number>();
const packagesReadCacheTtlMs = Math.max(5000, Number(process.env.PACKAGES_READ_CACHE_MS || 30000));
let packagesResponseCache: { expiresAt: number; value: Array<Record<string, unknown>> } | null = null;

const fallbackCategories = [
  "Home Care",
  "Cleaning",
  "Vehicle Care",
  "Grooming",
  "Garden",
  "Deep Cleaning"
];

const samplePackages: SeedPackage[] = [
  {
    name: "Basic Home Care",
    category: "Home Care",
    description: "Daily home support package for essential household chores.",
    price: 999,
    duration_days: 30,
    visit_frequency: "daily",
    services: ["Floor Cleaning", "Dish Washing", "Trash Cleaning"],
    package_tag: "Most Popular",
    display_order: 1
  },
  {
    name: "Weekly Deep Cleaning",
    category: "Cleaning",
    description: "Focused deep cleaning package for bathrooms, kitchens and windows.",
    price: 499,
    duration_days: 7,
    visit_frequency: "weekly",
    services: ["Bathroom Cleaning", "Kitchen Cleaning", "Window Cleaning"],
    package_tag: "Recommended",
    display_order: 2
  },
  {
    name: "Vehicle Care Package",
    category: "Vehicle Care",
    description: "Recurring vehicle wash package for bikes and cars.",
    price: 799,
    duration_days: 30,
    visit_frequency: "every_2_days",
    services: ["Bike Wash", "Car Wash"],
    display_order: 3
  },
  {
    name: "Beauty & Grooming",
    category: "Grooming",
    description: "At-home grooming essentials for monthly personal care.",
    price: 999,
    duration_days: 30,
    visit_frequency: "monthly",
    services: ["Haircut", "Beard Trim", "Facial"],
    display_order: 4
  },
  {
    name: "Garden Maintenance",
    category: "Garden",
    description: "Weekly garden support for healthy lawn and plants.",
    price: 699,
    duration_days: 30,
    visit_frequency: "weekly",
    services: ["Grass Cutting", "Plant Watering"],
    display_order: 5
  }
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isFirestoreUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = String((error as { code?: string | number })?.code || "").toLowerCase();
  return (
    message.includes("5 not_found") ||
    message.includes("not_found") ||
    message.includes("7 permission_denied") ||
    message.includes("permission_denied") ||
    message.includes("8 resource_exhausted") ||
    message.includes("resource_exhausted") ||
    message.includes("quota exceeded") ||
    message.includes("missing or insufficient permissions") ||
    message.includes("the caller does not have permission") ||
    (message.includes("database") && message.includes("does not exist")) ||
    message.includes("14 unavailable") ||
    message.includes("deadline exceeded") ||
    code.includes("not-found") ||
    code.includes("permission-denied") ||
    code.includes("resource-exhausted") ||
    code === "5" ||
    code === "7" ||
    code === "8" ||
    code === "14"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim().replace(/\s+/g, " ") : "";
  }
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => readTrimmedString(value))
        .filter(Boolean)
    )
  );
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((entry) => String(entry || "")));
  }

  if (typeof value === "string") {
    return uniqueStrings(
      value
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    );
  }

  return [];
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
  const normalized = readTrimmedString(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "daily") return "daily";
  if (normalized === "weekly") return "weekly";
  if (normalized === "every_2_days" || normalized === "every2days") return "every_2_days";
  if (normalized === "monthly") return "monthly";
  return "weekly";
}

function normalizePackageStatus(value: unknown): PackageStatus {
  if (typeof value === "boolean") {
    return value ? "active" : "disabled";
  }

  const normalized = readTrimmedString(value).toLowerCase();
  if (["disabled", "inactive", "false", "0", "hidden", "off"].includes(normalized)) {
    return "disabled";
  }
  return "active";
}

function formatPackageDuration(durationDays: number): string {
  return `${durationDays} days`;
}

function resolvePackageId(input: Record<string, unknown>, docIdHint: string, fallback: number): number {
  const explicit = parseId(input.package_id ?? input.id);
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
  const name =
    readTrimmedString(data.name) ||
    readTrimmedString(data.package_name) ||
    readTrimmedString(data.title) ||
    `Tasko Package ${packageId}`;
  const description =
    readTrimmedString(data.description) || "Tasko recurring service package with verified professionals.";
  const category =
    readTrimmedString(data.category) ||
    readTrimmedString(data.category_name) ||
    "General";
  const price = Math.max(0, readNumber(data.price) ?? 0);
  const duration_days = parseDurationDays(data.duration_days ?? data.duration, 30);
  const visit_frequency = normalizeVisitFrequency(data.visit_frequency ?? data.visitFrequency ?? data.frequency);
  const services_included = uniqueStrings(
    readStringArray(data.servicesIncluded ?? data.services_included ?? data.services ?? data.includedServices)
  );
  const package_tag = readTrimmedString(data.package_tag ?? data.packageTag ?? data.tag);
  const display_order = Math.max(0, readInteger(data.display_order ?? data.displayOrder) ?? packageId);
  const status = normalizePackageStatus(data.status ?? data.isActive ?? data.enabled);
  const created_at = parseDateLike(data.created_at ?? data.createdAt, now);
  const updated_at = parseDateLike(data.updated_at ?? data.updatedAt ?? data.created_at ?? data.createdAt, created_at);

  return {
    package_id: packageId,
    name,
    package_name: name,
    category,
    description,
    price,
    duration_days,
    visit_frequency,
    services_included,
    package_tag,
    display_order,
    status,
    created_at,
    updated_at
  };
}

function normalizePackageServiceRecord(data: Record<string, unknown>, docIdHint: string): PackageServiceRecord {
  const now = new Date().toISOString();
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
  const created_at = parseDateLike(data.created_at ?? data.createdAt, now);
  const updated_at = parseDateLike(data.updated_at ?? data.updatedAt ?? data.created_at ?? data.createdAt, created_at);

  return {
    package_service_id: serviceId,
    package_id: packageId,
    category_name,
    sub_category_name,
    service_frequency,
    created_at,
    updated_at
  };
}

function normalizeTimeSlot(value: unknown): PackageTimeSlot {
  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "afternoon") return "afternoon";
  if (normalized === "evening") return "evening";
  return "morning";
}

function normalizeUserPackageStatus(value: unknown): UserPackageStatus {
  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "pending") return "pending";
  if (normalized === "completed") return "completed";
  if (normalized === "cancelled") return "cancelled";
  return "active";
}

function normalizePaymentStatus(value: unknown): UserPackagePaymentStatus {
  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "pending") return "pending";
  if (normalized === "failed") return "failed";
  return "paid";
}

function normalizeUserPackageRecord(data: Record<string, unknown>, docIdHint: string): UserPackageRecord {
  const now = new Date().toISOString();
  const userPackageId = parsePositiveInt(data.user_package_id ?? data.id ?? docIdHint, parsePositiveInt(inMemoryUserPackages.size + 1, 1));
  const createdAt = parseDateLike(data.created_at ?? data.createdAt, now);
  const updatedAt = parseDateLike(data.updated_at ?? data.updatedAt ?? data.created_at ?? data.createdAt, createdAt);

  return {
    user_package_id: userPackageId,
    user_id: readTrimmedString(data.user_id ?? data.userId),
    package_id: parsePositiveInt(data.package_id ?? data.packageId, 1),
    package_name: readTrimmedString(data.package_name ?? data.packageName ?? data.name),
    package_price: Math.max(0, readNumber(data.package_price ?? data.packagePrice ?? data.price) ?? 0),
    package_duration_days: parseDurationDays(data.package_duration_days ?? data.packageDurationDays ?? data.duration_days ?? data.duration, 30),
    address_id: readTrimmedString(data.address_id ?? data.addressId),
    address_title: readTrimmedString(data.address_title ?? data.addressTitle),
    street: readTrimmedString(data.street ?? data.address_line ?? data.addressLine),
    city: readTrimmedString(data.city),
    pincode: readTrimmedString(data.pincode),
    start_date: readTrimmedString(data.start_date ?? data.startDate),
    end_date: readTrimmedString(data.end_date ?? data.endDate),
    time_slot: normalizeTimeSlot(data.time_slot ?? data.timeSlot),
    status: normalizeUserPackageStatus(data.status),
    payment_status: normalizePaymentStatus(data.payment_status ?? data.paymentStatus),
    payment_method: readTrimmedString(data.payment_method ?? data.paymentMethod),
    assigned_worker_id: readTrimmedString(data.assigned_worker_id ?? data.assignedWorkerId),
    assigned_worker_name: readTrimmedString(data.assigned_worker_name ?? data.assignedWorkerName),
    created_at: createdAt,
    updated_at: updatedAt
  };
}

function toPackageCollectionPayload(record: PackageRecord): Record<string, unknown> {
  const isActive = record.status === "active";
  return {
    id: String(record.package_id),
    package_id: record.package_id,
    name: record.name,
    package_name: record.package_name,
    category: record.category,
    price: record.price,
    duration: record.duration_days,
    duration_days: record.duration_days,
    visitFrequency: record.visit_frequency,
    visit_frequency: record.visit_frequency,
    servicesIncluded: record.services_included,
    services_included: record.services_included,
    description: record.description,
    packageTag: record.package_tag,
    package_tag: record.package_tag,
    displayOrder: record.display_order,
    display_order: record.display_order,
    status: record.status,
    isActive,
    enabled: isActive,
    createdAt: record.created_at,
    created_at: record.created_at,
    updatedAt: record.updated_at,
    updated_at: record.updated_at
  };
}

function toPackageServiceCollectionPayload(record: PackageServiceRecord): Record<string, unknown> {
  return {
    package_service_id: record.package_service_id,
    package_id: record.package_id,
    category_name: record.category_name,
    sub_category_name: record.sub_category_name,
    service_frequency: record.service_frequency,
    createdAt: record.created_at,
    created_at: record.created_at,
    updatedAt: record.updated_at,
    updated_at: record.updated_at
  };
}

function toUserPackageCollectionPayload(record: UserPackageRecord): Record<string, unknown> {
  return {
    id: String(record.user_package_id),
    user_package_id: record.user_package_id,
    user_id: record.user_id,
    userId: record.user_id,
    package_id: record.package_id,
    packageId: record.package_id,
    package_name: record.package_name,
    packageName: record.package_name,
    package_price: record.package_price,
    packagePrice: record.package_price,
    package_duration_days: record.package_duration_days,
    packageDurationDays: record.package_duration_days,
    address_id: record.address_id,
    addressId: record.address_id,
    address_title: record.address_title,
    addressTitle: record.address_title,
    street: record.street,
    city: record.city,
    pincode: record.pincode,
    start_date: record.start_date,
    startDate: record.start_date,
    end_date: record.end_date,
    endDate: record.end_date,
    time_slot: record.time_slot,
    timeSlot: record.time_slot,
    status: record.status,
    payment_status: record.payment_status,
    paymentStatus: record.payment_status,
    payment_method: record.payment_method,
    paymentMethod: record.payment_method,
    assigned_worker_id: record.assigned_worker_id,
    assignedWorkerId: record.assigned_worker_id,
    assigned_worker_name: record.assigned_worker_name,
    assignedWorkerName: record.assigned_worker_name,
    created_at: record.created_at,
    createdAt: record.created_at,
    updated_at: record.updated_at,
    updatedAt: record.updated_at
  };
}

function sortPackages<T extends { display_order: number; package_id: number; name: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.display_order !== right.display_order) {
      return left.display_order - right.display_order;
    }
    if (left.package_id !== right.package_id) {
      return left.package_id - right.package_id;
    }
    return left.name.localeCompare(right.name);
  });
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

function getPackagesResponseCache(): Array<Record<string, unknown>> | null {
  if (!packagesResponseCache) return null;
  if (Date.now() >= packagesResponseCache.expiresAt) {
    packagesResponseCache = null;
    return null;
  }
  return packagesResponseCache.value;
}

function setPackagesResponseCache(value: Array<Record<string, unknown>>): void {
  packagesResponseCache = {
    value,
    expiresAt: Date.now() + packagesReadCacheTtlMs
  };
}

function clearPackagesResponseCache(): void {
  packagesResponseCache = null;
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
  clearPackagesResponseCache();
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
  clearPackagesResponseCache();
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
    return sortPackages(packages);
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return sortPackages(Array.from(inMemoryPackages.values()));
}

async function getPackageById(packageId: number): Promise<PackageRecord | null> {
  if (inMemoryPackages.has(packageId)) {
    return inMemoryPackages.get(packageId) || null;
  }

  try {
    const snapshot = await db.collection("packages").doc(String(packageId)).get();
    if (!snapshot.exists) {
      return null;
    }
    const record = normalizePackageRecord((snapshot.data() as Record<string, unknown>) || {}, snapshot.id);
    inMemoryPackages.set(record.package_id, record);
    updateInMemoryCounter("packages", record.package_id);
    return record;
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return inMemoryPackages.get(packageId) || null;
}

async function listPackageServicesForPackage(packageId: number): Promise<PackageServiceRecord[]> {
  try {
    const snapshot = await db.collection("package_services").where("package_id", "==", packageId).get();
    const services = snapshot.docs.map((document) => normalizePackageServiceRecord(document.data(), document.id));
    services.forEach((record) => {
      inMemoryPackageServices.set(record.package_service_id, record);
      updateInMemoryCounter("package_services", record.package_service_id);
    });
    return services.sort((left, right) => left.package_service_id - right.package_service_id);
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return Array.from(inMemoryPackageServices.values())
    .filter((service) => service.package_id === packageId)
    .sort((left, right) => left.package_service_id - right.package_service_id);
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

async function saveUserPackageRecord(record: UserPackageRecord): Promise<void> {
  try {
    await db.collection("user_packages").doc(String(record.user_package_id)).set(toUserPackageCollectionPayload(record), { merge: true });
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryUserPackages.set(record.user_package_id, record);
  await ensureCounterBaseline("user_packages", record.user_package_id);
}

async function getUserPackageById(userPackageId: number): Promise<UserPackageRecord | null> {
  if (inMemoryUserPackages.has(userPackageId)) {
    return inMemoryUserPackages.get(userPackageId) || null;
  }

  try {
    const snapshot = await db.collection("user_packages").doc(String(userPackageId)).get();
    if (!snapshot.exists) {
      return null;
    }
    const record = normalizeUserPackageRecord((snapshot.data() as Record<string, unknown>) || {}, snapshot.id);
    inMemoryUserPackages.set(record.user_package_id, record);
    updateInMemoryCounter("user_packages", record.user_package_id);
    return record;
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return inMemoryUserPackages.get(userPackageId) || null;
}

async function listUserPackagesByUserId(userId: string): Promise<UserPackageRecord[]> {
  try {
    const snapshot = await db.collection("user_packages").where("user_id", "==", userId).get();
    const records = snapshot.docs.map((document) => normalizeUserPackageRecord(document.data(), document.id));
    records.forEach((record) => {
      inMemoryUserPackages.set(record.user_package_id, record);
      updateInMemoryCounter("user_packages", record.user_package_id);
    });
    return records.sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return Array.from(inMemoryUserPackages.values())
    .filter((record) => record.user_id === userId)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}

async function listAllUserPackages(): Promise<UserPackageRecord[]> {
  try {
    const snapshot = await db.collection("user_packages").get();
    const records = snapshot.docs.map((document) => normalizeUserPackageRecord(document.data(), document.id));
    records.forEach((record) => {
      inMemoryUserPackages.set(record.user_package_id, record);
      updateInMemoryCounter("user_packages", record.user_package_id);
    });
    return records.sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return Array.from(inMemoryUserPackages.values()).sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}

async function removePackageServiceRecords(packageId: number): Promise<void> {
  const existingServices = await listPackageServicesForPackage(packageId);

  try {
    await Promise.all(
      existingServices.map((service) => db.collection("package_services").doc(String(service.package_service_id)).delete())
    );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  existingServices.forEach((service) => {
    inMemoryPackageServices.delete(service.package_service_id);
  });
  clearPackagesResponseCache();
}

async function syncPackageServices(record: PackageRecord, servicesIncluded: string[]): Promise<PackageServiceRecord[]> {
  await removePackageServiceRecords(record.package_id);

  const nextRecords: PackageServiceRecord[] = [];
  for (const serviceName of uniqueStrings(servicesIncluded)) {
    const packageServiceId = await getNextSequenceValue("package_services");
    const nextService = normalizePackageServiceRecord(
      {
        package_service_id: packageServiceId,
        package_id: record.package_id,
        category_name: record.category,
        sub_category_name: serviceName,
        service_frequency: record.visit_frequency,
        created_at: record.updated_at,
        updated_at: record.updated_at
      },
      String(packageServiceId)
    );
    await savePackageServiceRecord(nextService);
    nextRecords.push(nextService);
  }

  return nextRecords;
}

async function removePackageRecord(packageId: number): Promise<void> {
  await removePackageServiceRecords(packageId);

  try {
    await db.collection("packages").doc(String(packageId)).delete();
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryPackages.delete(packageId);
  clearPackagesResponseCache();
}

function getAdminSessionToken(req: Request): string {
  const headerToken = readTrimmedString(req.header("x-admin-session-token"));
  if (headerToken) {
    return headerToken;
  }

  const authorizationHeader = readTrimmedString(req.header("authorization"));
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  const queryToken = readTrimmedString(req.query.sessionToken);
  if (queryToken) {
    return queryToken;
  }

  return isRecord(req.body) ? readTrimmedString(req.body.sessionToken) : "";
}

function validatePackagePayload(
  payload: Record<string, unknown>,
  existing?: PackageRecord | null
): { package: PackageRecord | null; servicesIncluded: string[]; error: string } {
  const name = readTrimmedString(payload.name ?? payload.package_name ?? existing?.name);
  if (!name) {
    return { package: null, servicesIncluded: [], error: "Package name is required." };
  }

  const category = readTrimmedString(payload.category ?? existing?.category);
  if (!category) {
    return { package: null, servicesIncluded: [], error: "Category is required." };
  }

  const price = readNumber(payload.price ?? existing?.price);
  if (price === null || price < 0) {
    return { package: null, servicesIncluded: [], error: "Price must be a valid non-negative number." };
  }

  const durationDays = parseDurationDays(payload.duration_days ?? payload.duration ?? existing?.duration_days, 0);
  if (durationDays <= 0) {
    return { package: null, servicesIncluded: [], error: "Duration must be greater than 0 days." };
  }

  const servicesIncluded = uniqueStrings(
    readStringArray(
      payload.servicesIncluded ??
        payload.services_included ??
        payload.services ??
        payload.includedServices ??
        existing?.services_included
    )
  );
  if (servicesIncluded.length === 0) {
    return { package: null, servicesIncluded: [], error: "At least one included service is required." };
  }

  const baseRecord = normalizePackageRecord(
    {
      ...(existing ? toPackageCollectionPayload(existing) : {}),
      ...payload,
      name,
      package_name: name,
      category,
      price,
      duration_days: durationDays,
      duration: durationDays,
      visit_frequency: payload.visit_frequency ?? payload.visitFrequency ?? existing?.visit_frequency,
      servicesIncluded,
      services_included: servicesIncluded,
      description: payload.description ?? existing?.description,
      package_tag: payload.package_tag ?? payload.packageTag ?? existing?.package_tag,
      display_order: payload.display_order ?? payload.displayOrder ?? existing?.display_order,
      status: payload.status ?? existing?.status ?? "active",
      created_at: existing?.created_at,
      updated_at: new Date().toISOString()
    },
    String(existing?.package_id || "")
  );

  baseRecord.name = name;
  baseRecord.package_name = name;
  baseRecord.category = category;
  baseRecord.price = price;
  baseRecord.duration_days = durationDays;
  baseRecord.services_included = servicesIncluded;
  if (existing?.created_at) {
    baseRecord.created_at = existing.created_at;
  }

  return {
    package: baseRecord,
    servicesIncluded,
    error: ""
  };
}

function buildPackageResponse(
  record: PackageRecord,
  serviceDetails: PackageServiceRecord[]
): Record<string, unknown> {
  const fallbackServices = record.services_included;
  const normalizedServices = uniqueStrings(
    (serviceDetails.length > 0 ? serviceDetails.map((service) => service.sub_category_name) : fallbackServices).filter(Boolean)
  );
  const category =
    readTrimmedString(record.category) ||
    readTrimmedString(serviceDetails[0]?.category_name) ||
    "General";
  const isActive = record.status === "active";

  return {
    id: String(record.package_id),
    package_id: record.package_id,
    name: record.name,
    package_name: record.package_name,
    category,
    price: record.price,
    duration: formatPackageDuration(record.duration_days),
    duration_days: record.duration_days,
    visitFrequency: record.visit_frequency,
    visit_frequency: record.visit_frequency,
    servicesIncluded: normalizedServices,
    services_included: normalizedServices,
    services: normalizedServices,
    description: record.description,
    packageTag: record.package_tag,
    package_tag: record.package_tag,
    displayOrder: record.display_order,
    display_order: record.display_order,
    status: record.status,
    isActive,
    enabled: isActive,
    createdAt: record.created_at,
    created_at: record.created_at,
    updatedAt: record.updated_at,
    updated_at: record.updated_at,
    service_details:
      serviceDetails.length > 0
        ? serviceDetails.map((service) => ({
            package_service_id: service.package_service_id,
            package_id: service.package_id,
            category_name: service.category_name,
            sub_category_name: service.sub_category_name,
            service_frequency: service.service_frequency,
            createdAt: service.created_at,
            created_at: service.created_at,
            updatedAt: service.updated_at,
            updated_at: service.updated_at
          }))
        : normalizedServices.map((serviceName, index) => ({
            package_service_id: index + 1,
            package_id: record.package_id,
            category_name: category,
            sub_category_name: serviceName,
            service_frequency: record.visit_frequency
          }))
  };
}

function buildUserPackageResponse(record: UserPackageRecord): Record<string, unknown> {
  return {
    id: String(record.user_package_id),
    user_package_id: record.user_package_id,
    userId: record.user_id,
    user_id: record.user_id,
    packageId: String(record.package_id),
    package_id: record.package_id,
    packageName: record.package_name,
    package_name: record.package_name,
    packagePrice: record.package_price,
    package_price: record.package_price,
    packageDurationDays: record.package_duration_days,
    package_duration_days: record.package_duration_days,
    addressId: record.address_id,
    address_id: record.address_id,
    addressTitle: record.address_title,
    address_title: record.address_title,
    street: record.street,
    city: record.city,
    pincode: record.pincode,
    fullAddress: [record.street, record.city, record.pincode].filter(Boolean).join(", "),
    startDate: record.start_date,
    start_date: record.start_date,
    endDate: record.end_date,
    end_date: record.end_date,
    timeSlot: record.time_slot,
    time_slot: record.time_slot,
    status: record.status,
    paymentStatus: record.payment_status,
    payment_status: record.payment_status,
    paymentMethod: record.payment_method,
    payment_method: record.payment_method,
    assignedWorkerId: record.assigned_worker_id,
    assigned_worker_id: record.assigned_worker_id,
    assignedWorkerName: record.assigned_worker_name,
    assigned_worker_name: record.assigned_worker_name,
    createdAt: record.created_at,
    created_at: record.created_at,
    updatedAt: record.updated_at,
    updated_at: record.updated_at
  };
}

async function createSamplePackages(): Promise<void> {
  const now = new Date().toISOString();

  for (const packageInput of samplePackages) {
    const packageId = await getNextSequenceValue("packages");
    const record = normalizePackageRecord(
      {
        package_id: packageId,
        name: packageInput.name,
        package_name: packageInput.name,
        category: packageInput.category,
        description: packageInput.description,
        price: packageInput.price,
        duration_days: packageInput.duration_days,
        visit_frequency: packageInput.visit_frequency,
        servicesIncluded: packageInput.services,
        package_tag: packageInput.package_tag || "",
        display_order: packageInput.display_order,
        status: "active",
        created_at: now,
        updated_at: now
      },
      String(packageId)
    );

    await savePackageRecord(record);
    await syncPackageServices(record, packageInput.services);
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

export function registerPackageRoutes(app: Express, options: RegisterPackageRoutesOptions): void {
  app.get("/api/packages", async (_req: Request, res: Response) => {
    const cachedPayload = getPackagesResponseCache();
    if (cachedPayload) {
      return res.json(cachedPayload);
    }

    try {
      const allPackages = await listAllPackages();
      const packageServicesMap = await listPackageServicesByPackageIds(allPackages.map((item) => item.package_id));
      const payload = sortPackages(allPackages.filter((item) => item.status === "active")).map((item) =>
        buildPackageResponse(item, packageServicesMap.get(item.package_id) || [])
      );

      setPackagesResponseCache(payload);
      return res.json(payload);
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch packages",
        error: getErrorMessage(error)
      });
    }
  });

  app.get("/api/packages/:packageId", async (req: Request, res: Response) => {
    try {
      const packageId = parsePositiveInt(req.params.packageId, 0);
      if (!packageId) {
        return res.status(400).json({ message: "Valid packageId is required." });
      }

      const record = await getPackageById(packageId);
      if (!record || record.status !== "active") {
        return res.status(404).json({ message: "Package not found." });
      }

      const services = await listPackageServicesForPackage(record.package_id);
      return res.json(buildPackageResponse(record, services));
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch package details",
        error: getErrorMessage(error)
      });
    }
  });

  app.get("/api/package-subscriptions", async (req: Request, res: Response) => {
    try {
      const userId = readTrimmedString(req.query.userId);
      const subscriptions = userId ? await listUserPackagesByUserId(userId) : await listAllUserPackages();
      return res.json(subscriptions.map((record) => buildUserPackageResponse(record)));
    } catch (error) {
      return res.status(500).json({
        message: "Failed to load package subscriptions",
        error: getErrorMessage(error)
      });
    }
  });

  app.get("/api/package-subscriptions/:subscriptionId", async (req: Request, res: Response) => {
    try {
      const subscriptionId = parsePositiveInt(req.params.subscriptionId, 0);
      if (!subscriptionId) {
        return res.status(400).json({ message: "Valid subscriptionId is required." });
      }

      const record = await getUserPackageById(subscriptionId);
      if (!record) {
        return res.status(404).json({ message: "Subscription not found." });
      }

      return res.json(buildUserPackageResponse(record));
    } catch (error) {
      return res.status(500).json({
        message: "Failed to load subscription",
        error: getErrorMessage(error)
      });
    }
  });

  app.post("/api/package-subscriptions", async (req: Request, res: Response) => {
    try {
      const payload = isRecord(req.body) ? req.body : {};
      const userId = readTrimmedString(payload.userId ?? payload.user_id);
      const packageId = parsePositiveInt(payload.packageId ?? payload.package_id, 0);
      const addressId = readTrimmedString(payload.addressId ?? payload.address_id);
      const addressTitle = readTrimmedString(payload.addressTitle ?? payload.address_title);
      const street = readTrimmedString(payload.street);
      const city = readTrimmedString(payload.city);
      const pincode = readTrimmedString(payload.pincode);
      const startDate = readTrimmedString(payload.startDate ?? payload.start_date);
      const paymentMethod = readTrimmedString(payload.paymentMethod ?? payload.payment_method);

      if (!userId || !packageId || !addressId || !street || !startDate || !paymentMethod) {
        return res.status(400).json({
          message: "userId, packageId, addressId, street, startDate and paymentMethod are required."
        });
      }

      const parsedStartDate = new Date(startDate);
      if (Number.isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({ message: "startDate must be a valid date." });
      }

      const packageRecord = await getPackageById(packageId);
      if (!packageRecord || packageRecord.status !== "active") {
        return res.status(404).json({ message: "Selected package is not available." });
      }

      const endDateValue = new Date(parsedStartDate);
      endDateValue.setDate(endDateValue.getDate() + Math.max(0, packageRecord.duration_days - 1));

      const userPackageId = await getNextSequenceValue("user_packages");
      const now = new Date().toISOString();
      const record = normalizeUserPackageRecord(
        {
          user_package_id: userPackageId,
          user_id: userId,
          package_id: packageRecord.package_id,
          package_name: packageRecord.package_name,
          package_price: packageRecord.price,
          package_duration_days: packageRecord.duration_days,
          address_id: addressId,
          address_title: addressTitle || "Saved Address",
          street,
          city,
          pincode,
          start_date: parsedStartDate.toISOString().slice(0, 10),
          end_date: endDateValue.toISOString().slice(0, 10),
          time_slot: payload.timeSlot ?? payload.time_slot,
          status: "active",
          payment_status: "paid",
          payment_method: paymentMethod,
          assigned_worker_id: "",
          assigned_worker_name: "",
          created_at: now,
          updated_at: now
        },
        String(userPackageId)
      );

      await saveUserPackageRecord(record);
      return res.status(201).json({
        message: "Package subscription created successfully.",
        subscription: buildUserPackageResponse(record)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to create package subscription",
        error: getErrorMessage(error)
      });
    }
  });

  app.patch("/api/package-subscriptions/:subscriptionId/status", async (req: Request, res: Response) => {
    try {
      const subscriptionId = parsePositiveInt(req.params.subscriptionId, 0);
      if (!subscriptionId) {
        return res.status(400).json({ message: "Valid subscriptionId is required." });
      }

      const existing = await getUserPackageById(subscriptionId);
      if (!existing) {
        return res.status(404).json({ message: "Subscription not found." });
      }

      const updated = normalizeUserPackageRecord(
        {
          ...toUserPackageCollectionPayload(existing),
          status: isRecord(req.body) ? req.body.status : existing.status,
          updated_at: new Date().toISOString()
        },
        String(subscriptionId)
      );
      updated.created_at = existing.created_at;

      await saveUserPackageRecord(updated);
      return res.json({
        message: "Package booking status updated successfully.",
        subscription: buildUserPackageResponse(updated)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update package booking status",
        error: getErrorMessage(error)
      });
    }
  });

  app.patch("/api/package-subscriptions/:subscriptionId/assign-worker", async (req: Request, res: Response) => {
    try {
      const subscriptionId = parsePositiveInt(req.params.subscriptionId, 0);
      if (!subscriptionId) {
        return res.status(400).json({ message: "Valid subscriptionId is required." });
      }

      const existing = await getUserPackageById(subscriptionId);
      if (!existing) {
        return res.status(404).json({ message: "Subscription not found." });
      }

      const updated = normalizeUserPackageRecord(
        {
          ...toUserPackageCollectionPayload(existing),
          assigned_worker_id: isRecord(req.body) ? req.body.workerId ?? req.body.assigned_worker_id : existing.assigned_worker_id,
          assigned_worker_name: isRecord(req.body) ? req.body.workerName ?? req.body.assigned_worker_name : existing.assigned_worker_name,
          updated_at: new Date().toISOString()
        },
        String(subscriptionId)
      );
      updated.created_at = existing.created_at;

      await saveUserPackageRecord(updated);
      return res.json({
        message: "Worker assigned to package booking successfully.",
        subscription: buildUserPackageResponse(updated)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to assign worker to package booking",
        error: getErrorMessage(error)
      });
    }
  });

  app.get("/api/admin/packages", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const allPackages = await listAllPackages();
      const packageServicesMap = await listPackageServicesByPackageIds(allPackages.map((item) => item.package_id));
      const payload = sortPackages(allPackages).map((item) =>
        buildPackageResponse(item, packageServicesMap.get(item.package_id) || [])
      );
      const categories = Array.from(
        new Set([...fallbackCategories, ...payload.map((item) => readTrimmedString(item.category)).filter(Boolean)])
      ).sort((left, right) => left.localeCompare(right));

      return res.json({
        packages: payload,
        categories
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to load admin packages",
        error: getErrorMessage(error)
      });
    }
  });

  app.post("/api/admin/packages", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const payload = isRecord(req.body) ? req.body : {};
      const packageId = await getNextSequenceValue("packages");
      const validated = validatePackagePayload(
        {
          ...payload,
          package_id: packageId,
          id: packageId
        },
        null
      );
      if (!validated.package || validated.error) {
        return res.status(400).json({ message: validated.error || "Invalid package payload." });
      }

      await savePackageRecord(validated.package);
      const services = await syncPackageServices(validated.package, validated.servicesIncluded);

      return res.status(201).json({
        message: "Package created successfully.",
        package: buildPackageResponse(validated.package, services)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to create package",
        error: getErrorMessage(error)
      });
    }
  });

  app.patch("/api/admin/packages/:packageId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const packageId = parsePositiveInt(req.params.packageId, 0);
      if (!packageId) {
        return res.status(400).json({ message: "Valid packageId is required." });
      }

      const existing = await getPackageById(packageId);
      if (!existing) {
        return res.status(404).json({ message: "Package not found." });
      }

      const payload = isRecord(req.body) ? req.body : {};
      const validated = validatePackagePayload(payload, existing);
      if (!validated.package || validated.error) {
        return res.status(400).json({ message: validated.error || "Invalid package payload." });
      }

      await savePackageRecord(validated.package);
      const services = await syncPackageServices(validated.package, validated.servicesIncluded);

      return res.json({
        message: "Package updated successfully.",
        package: buildPackageResponse(validated.package, services)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update package",
        error: getErrorMessage(error)
      });
    }
  });

  app.patch("/api/admin/packages/:packageId/status", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const packageId = parsePositiveInt(req.params.packageId, 0);
      if (!packageId) {
        return res.status(400).json({ message: "Valid packageId is required." });
      }

      const existing = await getPackageById(packageId);
      if (!existing) {
        return res.status(404).json({ message: "Package not found." });
      }

      const nextStatus = normalizePackageStatus(isRecord(req.body) ? req.body.status : "");
      const updated = normalizePackageRecord(
        {
          ...toPackageCollectionPayload(existing),
          status: nextStatus,
          updated_at: new Date().toISOString()
        },
        String(existing.package_id)
      );
      updated.created_at = existing.created_at;
      updated.services_included = existing.services_included;

      await savePackageRecord(updated);
      const services = await listPackageServicesForPackage(updated.package_id);

      return res.json({
        message: `Package ${nextStatus === "active" ? "enabled" : "disabled"} successfully.`,
        package: buildPackageResponse(updated, services)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update package status",
        error: getErrorMessage(error)
      });
    }
  });

  app.delete("/api/admin/packages/:packageId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const packageId = parsePositiveInt(req.params.packageId, 0);
      if (!packageId) {
        return res.status(400).json({ message: "Valid packageId is required." });
      }

      const existing = await getPackageById(packageId);
      if (!existing) {
        return res.status(404).json({ message: "Package not found." });
      }

      await removePackageRecord(packageId);
      return res.json({ message: "Package deleted successfully." });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to delete package",
        error: getErrorMessage(error)
      });
    }
  });
}
