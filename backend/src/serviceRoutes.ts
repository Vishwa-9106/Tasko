import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { Express, Request, Response } from "express";
import { db } from "./firebaseAdmin";
import { getSuggestedPricingForSubcategory } from "./servicePricing";

type ServiceStatus = "active" | "inactive";

type ServiceRecord = {
  id: string;
  name: string;
  category: string;
  categorySlug: string;
  slug: string;
  description: string;
  basePrice: number;
  pricingType: string;
  duration: string;
  image: string;
  includedServices: string[];
  notIncludedServices: string[];
  rating: number;
  reviewCount: number;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
};

type ServicePricingOptionRecord = {
  id: string;
  serviceId: string;
  title: string;
  description: string;
  price: number;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type ServiceAddonRecord = {
  id: string;
  serviceId: string;
  title: string;
  price: number;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type ServiceDetailRecord = {
  service: ServiceRecord;
  pricingOptions: ServicePricingOptionRecord[];
  addons: ServiceAddonRecord[];
};

type RegisterServiceRoutesOptions = {
  validateAdminSession: (token: string) => boolean;
};

type SeedCategoryDefinition = {
  category: string;
  duration: string;
  services: string[];
  includedServices: string[];
  notIncludedServices: string[];
  addons: Array<{
    title: string;
    description: string;
    price: number;
  }>;
};

const uploadsRoot = path.resolve(__dirname, "../uploads");
const serviceImagesRoot = path.join(uploadsRoot, "service-images");
const maxImageBytes = 5 * 1024 * 1024;
const servicesReadCacheTtlMs = Math.max(5000, Number(process.env.SERVICES_READ_CACHE_MS || 60000));

const inMemoryServices = new Map<string, ServiceRecord>();
const inMemoryPricingOptions = new Map<string, ServicePricingOptionRecord>();
const inMemoryAddons = new Map<string, ServiceAddonRecord>();

let servicesListCache: { expiresAt: number; value: ServiceRecord[] } | null = null;
const serviceDetailCache = new Map<string, { expiresAt: number; value: ServiceDetailRecord | null }>();

const seedCatalog: SeedCategoryDefinition[] = [
  {
    category: "Cleaning",
    duration: "2-3 hours",
    services: ["House Cleaning", "Deep Cleaning", "Kitchen Cleaninng", "Bathroom Cleaning", "Office Cleaning"],
    includedServices: ["Dusting and surface wipe-down", "Floor cleaning", "Basic sanitisation"],
    notIncludedServices: ["Paint removal", "Heavy debris disposal", "Consumables for special stains"],
    addons: [
      { title: "Balcony Cleaning", description: "Additional balcony or utility area cleaning.", price: 249 },
      { title: "Premium Supplies", description: "Tasko partner brings premium cleaning consumables.", price: 199 }
    ]
  },
  {
    category: "Washing",
    duration: "1-2 hours",
    services: ["Dish Washing", "Clothes Washing", "Bike Washing", "Car Washing", "Sofa / Carpet Washing"],
    includedServices: ["Standard washing process", "Water-efficient cleaning", "Basic drying or finishing"],
    notIncludedServices: ["Damaged item repair", "Premium chemicals", "Pickup and delivery"],
    addons: [
      { title: "Stain Treatment", description: "Extra treatment for stubborn stains or marks.", price: 149 },
      { title: "Express Slot", description: "Priority scheduling within the earliest available slot.", price: 199 }
    ]
  },
  {
    category: "Maintenance",
    duration: "1-3 hours",
    services: [
      "Garden Maintenance",
      "Lawn Cutting",
      "Water Tank Cleaning",
      "General Home Maintenance",
      "Minor Repair Work"
    ],
    includedServices: ["Inspection and task setup", "Routine service work", "Basic cleanup after work"],
    notIncludedServices: ["Replacement parts", "Major civil work", "Structural modifications"],
    addons: [
      { title: "Material Pickup", description: "Technician arranges and collects basic materials.", price: 249 },
      { title: "Extended Coverage", description: "Additional 30-45 minutes of scope support.", price: 299 }
    ]
  },
  {
    category: "Mechanic",
    duration: "45-120 mins",
    services: ["Bike Repair", "Car Repair", "Puncture Fix", "Engine Check", "Battery Replacement"],
    includedServices: ["Initial diagnosis", "Labour for selected task", "Basic safety check"],
    notIncludedServices: ["Spare parts", "Oil and consumables", "Towing support"],
    addons: [
      { title: "Emergency Visit", description: "Fast doorstep mechanic dispatch for urgent jobs.", price: 349 },
      { title: "Full Diagnostics", description: "Expanded multi-point inspection and report.", price: 299 }
    ]
  },
  {
    category: "Plumbing",
    duration: "45-90 mins",
    services: [
      "Pipe Leakage Fix",
      "Tap Installation",
      "Drain Block Cleaning",
      "Bathroom Fitting Repair",
      "Water Motor Repair"
    ],
    includedServices: ["Standard plumbing labour", "Leak and fitment check", "Basic worksite cleanup"],
    notIncludedServices: ["Pipes and fittings", "Wall breaking work", "Motor replacement cost"],
    addons: [
      { title: "Sealant Pack", description: "Professional-grade sealing material for better finishing.", price: 179 },
      { title: "Emergency Visit", description: "Priority slot for urgent plumbing issues.", price: 249 }
    ]
  },
  {
    category: "Technical & Installation Services",
    duration: "45-120 mins",
    services: [
      "Fan Installation",
      "Light Installation",
      "TV Installation",
      "CCTV Installation",
      "Washing Machine Installation",
      "Inverter Installation"
    ],
    includedServices: ["Technician visit", "Standard installation labour", "Basic safety test"],
    notIncludedServices: ["Cables and accessories", "Drilling beyond standard scope", "Civil modifications"],
    addons: [
      { title: "Wall Mount Hardware", description: "Additional mounting accessories when needed.", price: 249 },
      { title: "Extended Wiring", description: "Extra wiring support for complex setups.", price: 299 }
    ]
  },
  {
    category: "Caring",
    duration: "4-8 hours",
    services: ["Babysitting", "Elder Care", "Patient Care", "Full Day Care", "Night Care"],
    includedServices: ["Attendant support", "Basic care assistance", "Routine supervision"],
    notIncludedServices: ["Medicines", "Medical procedures", "Special equipment rental"],
    addons: [
      { title: "Extended Shift", description: "Additional care support beyond the standard slot.", price: 499 },
      { title: "Companion Support", description: "Extra caregiver/attendant for demanding situations.", price: 699 }
    ]
  },
  {
    category: "Barber & Makeup Services",
    duration: "45-150 mins",
    services: ["Hair Cutting", "Beard Styling", "Facial", "Bridal Makeup", "Party Makeup"],
    includedServices: ["Professional visit", "Basic tools and setup", "Standard post-service cleanup"],
    notIncludedServices: ["Premium branded products", "Trial sessions", "Outstation travel"],
    addons: [
      { title: "Premium Products", description: "Use of premium salon-grade products.", price: 399 },
      { title: "Styling Finish", description: "Additional finishing and touch-up support.", price: 249 }
    ]
  },
  {
    category: "Cooking",
    duration: "2-4 hours",
    services: ["Home Cook (Daily)", "Event Cooking", "Veg Cooking", "Non-Veg Cooking", "Temporary Cook"],
    includedServices: ["Food preparation", "Cooking support", "Basic kitchen cleaning"],
    notIncludedServices: ["Ingredients", "Serving staff", "Disposable items"],
    addons: [
      { title: "Serving Assistance", description: "Additional person for serving help.", price: 300 },
      { title: "Extra Kitchen Cleaning", description: "Deeper cleanup after the cooking session.", price: 200 }
    ]
  },
  {
    category: "AC Repair",
    duration: "45-120 mins",
    services: [
      "AC Installation",
      "AC Gas Refill",
      "AC General Service",
      "AC Not Cooling Issue",
      "AC Water Leakage Fix"
    ],
    includedServices: ["Technician inspection", "Standard service labour", "Basic performance check"],
    notIncludedServices: ["Replacement parts", "Gas cylinder cost", "Extended copper piping"],
    addons: [
      { title: "Filter Deep Clean", description: "Enhanced AC filter and vent cleaning.", price: 249 },
      { title: "Same-Day Slot", description: "Priority same-day service when available.", price: 299 }
    ]
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
    message.includes("not_found") ||
    message.includes("permission_denied") ||
    message.includes("resource_exhausted") ||
    (message.includes("database") && message.includes("does not exist")) ||
    message.includes("deadline exceeded") ||
    message.includes("unavailable") ||
    code.includes("not-found") ||
    code.includes("permission-denied") ||
    code.includes("resource-exhausted") ||
    code === "5" ||
    code === "7" ||
    code === "8" ||
    code === "14"
  );
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function readNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = readNumber(value, fallback);
  return parsed >= 0 ? parsed : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => readTrimmedString(entry)).filter(Boolean);
}

function readStatus(value: unknown): ServiceStatus {
  return readTrimmedString(value).toLowerCase() === "inactive" ? "inactive" : "active";
}

function toSlug(value: string): string {
  return readTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "service";
}

function toCategorySlug(value: string): string {
  return toSlug(value);
}

function formatImageUrl(relativePath: string): string {
  return relativePath ? `/uploads/${relativePath.replace(/^\/+/, "")}` : "";
}

function formatPrice(value: number): number {
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded;
}

function normalizeServiceRecord(serviceId: string, data: Record<string, unknown>): ServiceRecord {
  const category = readTrimmedString(data.category);
  const name = readTrimmedString(data.name);
  const slug = readTrimmedString(data.slug) || toSlug(name);
  const categorySlug = readTrimmedString(data.categorySlug) || toCategorySlug(category);
  const createdAt = readTrimmedString(data.createdAt) || new Date().toISOString();
  const updatedAt = readTrimmedString(data.updatedAt) || createdAt;

  return {
    id: serviceId,
    name,
    category,
    categorySlug,
    slug,
    description: readTrimmedString(data.description),
    basePrice: readNonNegativeNumber(data.basePrice, 0),
    pricingType: readTrimmedString(data.pricingType) || "tiered",
    duration: readTrimmedString(data.duration),
    image: readTrimmedString(data.image),
    includedServices: readStringArray(data.includedServices),
    notIncludedServices: readStringArray(data.notIncludedServices),
    rating: Number(readNumber(data.rating, 4.5).toFixed(1)),
    reviewCount: Math.max(0, Math.trunc(readNumber(data.reviewCount, 0))),
    status: readStatus(data.status),
    createdAt,
    updatedAt
  };
}

function normalizePricingOptionRecord(optionId: string, data: Record<string, unknown>): ServicePricingOptionRecord {
  const createdAt = readTrimmedString(data.createdAt) || new Date().toISOString();
  const updatedAt = readTrimmedString(data.updatedAt) || createdAt;

  return {
    id: optionId,
    serviceId: readTrimmedString(data.serviceId),
    title: readTrimmedString(data.title),
    description: readTrimmedString(data.description),
    price: readNonNegativeNumber(data.price, 0),
    order: Math.max(1, Math.trunc(readNumber(data.order, 1))),
    createdAt,
    updatedAt
  };
}

function normalizeAddonRecord(addonId: string, data: Record<string, unknown>): ServiceAddonRecord {
  const createdAt = readTrimmedString(data.createdAt) || new Date().toISOString();
  const updatedAt = readTrimmedString(data.updatedAt) || createdAt;

  return {
    id: addonId,
    serviceId: readTrimmedString(data.serviceId),
    title: readTrimmedString(data.title),
    price: readNonNegativeNumber(data.price, 0),
    description: readTrimmedString(data.description),
    createdAt,
    updatedAt
  };
}

function buildSeedServiceDescription(category: string, serviceName: string): string {
  const normalizedName = serviceName.toLowerCase();
  if (category === "Cooking") {
    return `Experienced professionals for ${normalizedName} with clean setup, organised preparation, and reliable completion.`;
  }
  if (category === "Caring") {
    return `Trusted Tasko professionals for ${normalizedName} with attentive support and dependable care coverage.`;
  }
  return `Tasko professionals handle ${normalizedName} with verified expertise, clear scope, and doorstep convenience.`;
}

function hashCode(input: string): number {
  return Array.from(input).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function buildSeedServices(): ServiceDetailRecord[] {
  const now = new Date().toISOString();

  return seedCatalog.flatMap((entry) =>
    entry.services.map((serviceName) => {
      const suggestion = getSuggestedPricingForSubcategory(serviceName);
      const categorySlug = toCategorySlug(entry.category);
      const slug = toSlug(serviceName);
      const serviceId = `svc-${categorySlug}-${slug}`;
      const basePrice = formatPrice(suggestion?.price || 499);
      const seedHash = hashCode(`${entry.category}:${serviceName}`);
      const rating = Number((4.2 + (seedHash % 6) * 0.1).toFixed(1));
      const reviewCount = 30 + (seedHash % 180);

      const pricingOptions: ServicePricingOptionRecord[] = [
        {
          id: `spo-${serviceId}-basic`,
          serviceId,
          title: "Standard",
          description: `Ideal for regular ${serviceName.toLowerCase()} needs.`,
          price: basePrice,
          order: 1,
          createdAt: now,
          updatedAt: now
        },
        {
          id: `spo-${serviceId}-plus`,
          serviceId,
          title: "Plus",
          description: "Expanded scope with extra attention and coverage.",
          price: formatPrice(basePrice * 1.7),
          order: 2,
          createdAt: now,
          updatedAt: now
        },
        {
          id: `spo-${serviceId}-premium`,
          serviceId,
          title: "Premium",
          description: "Best for larger, more demanding or premium tasks.",
          price: formatPrice(basePrice * 2.5),
          order: 3,
          createdAt: now,
          updatedAt: now
        }
      ];

      const addons: ServiceAddonRecord[] = entry.addons.map((addon, index) => ({
        id: `sad-${serviceId}-${toSlug(addon.title)}-${index + 1}`,
        serviceId,
        title: addon.title,
        description: addon.description,
        price: addon.price,
        createdAt: now,
        updatedAt: now
      }));

      return {
        service: {
          id: serviceId,
          name: serviceName,
          category: entry.category,
          categorySlug,
          slug,
          description: buildSeedServiceDescription(entry.category, serviceName),
          basePrice,
          pricingType: "tiered",
          duration: entry.duration,
          image: "",
          includedServices: [...entry.includedServices],
          notIncludedServices: [...entry.notIncludedServices],
          rating,
          reviewCount,
          status: "active",
          createdAt: now,
          updatedAt: now
        },
        pricingOptions,
        addons
      };
    })
  );
}

function ensureInMemorySeedData(): ServiceDetailRecord[] {
  if (inMemoryServices.size > 0) {
    return Array.from(inMemoryServices.values()).map((service) => ({
      service,
      pricingOptions: Array.from(inMemoryPricingOptions.values())
        .filter((option) => option.serviceId === service.id)
        .sort((left, right) => left.order - right.order),
      addons: Array.from(inMemoryAddons.values())
        .filter((addon) => addon.serviceId === service.id)
        .sort((left, right) => left.title.localeCompare(right.title))
    }));
  }

  const seedData = buildSeedServices();
  seedData.forEach((entry) => {
    inMemoryServices.set(entry.service.id, entry.service);
    entry.pricingOptions.forEach((option) => inMemoryPricingOptions.set(option.id, option));
    entry.addons.forEach((addon) => inMemoryAddons.set(addon.id, addon));
  });

  return seedData;
}

function clearServiceCaches(): void {
  servicesListCache = null;
  serviceDetailCache.clear();
}

async function ensureServicesBootstrapData(): Promise<void> {
  const seedData = ensureInMemorySeedData();

  try {
    const snapshot = await db.collection("services").limit(1).get();
    if (!snapshot.empty) {
      return;
    }

    await Promise.all(
      seedData.flatMap((entry) => {
        const serviceWrites = [
          db.collection("services").doc(entry.service.id).set(
            {
              name: entry.service.name,
              category: entry.service.category,
              categorySlug: entry.service.categorySlug,
              slug: entry.service.slug,
              description: entry.service.description,
              basePrice: entry.service.basePrice,
              pricingType: entry.service.pricingType,
              duration: entry.service.duration,
              image: entry.service.image,
              includedServices: entry.service.includedServices,
              notIncludedServices: entry.service.notIncludedServices,
              rating: entry.service.rating,
              reviewCount: entry.service.reviewCount,
              status: entry.service.status,
              createdAt: entry.service.createdAt,
              updatedAt: entry.service.updatedAt
            },
            { merge: true }
          )
        ];

        const pricingWrites = entry.pricingOptions.map((option) =>
          db.collection("service_pricing_options").doc(option.id).set(
            {
              serviceId: option.serviceId,
              title: option.title,
              description: option.description,
              price: option.price,
              order: option.order,
              createdAt: option.createdAt,
              updatedAt: option.updatedAt
            },
            { merge: true }
          )
        );

        const addonWrites = entry.addons.map((addon) =>
          db.collection("service_addons").doc(addon.id).set(
            {
              serviceId: addon.serviceId,
              title: addon.title,
              description: addon.description,
              price: addon.price,
              createdAt: addon.createdAt,
              updatedAt: addon.updatedAt
            },
            { merge: true }
          )
        );

        return [...serviceWrites, ...pricingWrites, ...addonWrites];
      })
    );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
}

function getCachedServicesList(): ServiceRecord[] | null {
  if (!servicesListCache) return null;
  if (Date.now() >= servicesListCache.expiresAt) {
    servicesListCache = null;
    return null;
  }
  return servicesListCache.value;
}

function setCachedServicesList(value: ServiceRecord[]): void {
  servicesListCache = {
    value,
    expiresAt: Date.now() + servicesReadCacheTtlMs
  };
}

function getCachedServiceDetail(key: string): ServiceDetailRecord | null | undefined {
  const cached = serviceDetailCache.get(key);
  if (!cached) return undefined;
  if (Date.now() >= cached.expiresAt) {
    serviceDetailCache.delete(key);
    return undefined;
  }
  return cached.value;
}

function setCachedServiceDetail(key: string, value: ServiceDetailRecord | null): void {
  serviceDetailCache.set(key, {
    value,
    expiresAt: Date.now() + servicesReadCacheTtlMs
  });
}

async function listServices(): Promise<ServiceRecord[]> {
  const cached = getCachedServicesList();
  if (cached) {
    return cached;
  }

  try {
    await ensureServicesBootstrapData();
    const snapshot = await db.collection("services").get();
    if (!snapshot.empty) {
      const services = snapshot.docs
        .map((document) => normalizeServiceRecord(document.id, document.data()))
        .filter((service) => Boolean(service.name) && Boolean(service.category))
        .sort((left, right) => left.name.localeCompare(right.name));
      services.forEach((service) => inMemoryServices.set(service.id, service));
      setCachedServicesList(services);
      return services;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  const fallback = ensureInMemorySeedData()
    .map((entry) => entry.service)
    .sort((left, right) => left.name.localeCompare(right.name));
  setCachedServicesList(fallback);
  return fallback;
}

async function listPricingOptions(serviceId: string): Promise<ServicePricingOptionRecord[]> {
  try {
    const snapshot = await db.collection("service_pricing_options").where("serviceId", "==", serviceId).get();
    if (!snapshot.empty) {
      const options = snapshot.docs
        .map((document) => normalizePricingOptionRecord(document.id, document.data()))
        .filter((record) => Boolean(record.serviceId) && Boolean(record.title))
        .sort((left, right) => left.order - right.order);
      options.forEach((option) => inMemoryPricingOptions.set(option.id, option));
      return options;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  ensureInMemorySeedData();
  return Array.from(inMemoryPricingOptions.values())
    .filter((option) => option.serviceId === serviceId)
    .sort((left, right) => left.order - right.order);
}

async function listAddons(serviceId: string): Promise<ServiceAddonRecord[]> {
  try {
    const snapshot = await db.collection("service_addons").where("serviceId", "==", serviceId).get();
    if (!snapshot.empty) {
      const addons = snapshot.docs
        .map((document) => normalizeAddonRecord(document.id, document.data()))
        .filter((record) => Boolean(record.serviceId) && Boolean(record.title))
        .sort((left, right) => left.title.localeCompare(right.title));
      addons.forEach((addon) => inMemoryAddons.set(addon.id, addon));
      return addons;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  ensureInMemorySeedData();
  return Array.from(inMemoryAddons.values())
    .filter((addon) => addon.serviceId === serviceId)
    .sort((left, right) => left.title.localeCompare(right.title));
}

export async function getServiceById(serviceId: string): Promise<ServiceRecord | null> {
  if (!serviceId) {
    return null;
  }

  const fromMemory = inMemoryServices.get(serviceId);
  if (fromMemory) {
    return fromMemory;
  }

  try {
    await ensureServicesBootstrapData();
    const document = await db.collection("services").doc(serviceId).get();
    if (document.exists) {
      const service = normalizeServiceRecord(document.id, document.data() || {});
      inMemoryServices.set(service.id, service);
      return service;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  ensureInMemorySeedData();
  return inMemoryServices.get(serviceId) || null;
}

export async function getServiceDetailByCategoryAndSlug(
  categorySlug: string,
  serviceSlug: string
): Promise<ServiceDetailRecord | null> {
  const cacheKey = `${categorySlug}::${serviceSlug}`;
  const cached = getCachedServiceDetail(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let service: ServiceRecord | null = null;

  try {
    await ensureServicesBootstrapData();
    const snapshot = await db.collection("services").where("slug", "==", serviceSlug).limit(10).get();
    if (!snapshot.empty) {
      const match = snapshot.docs
        .map((document) => normalizeServiceRecord(document.id, document.data()))
        .find((item) => item.categorySlug === categorySlug);
      if (match) {
        service = match;
        inMemoryServices.set(match.id, match);
      }
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  if (!service) {
    const fallbackServices = await listServices();
    service =
      fallbackServices.find((item) => item.slug === serviceSlug && item.categorySlug === categorySlug) || null;
  }

  if (!service) {
    setCachedServiceDetail(cacheKey, null);
    return null;
  }

  const [pricingOptions, addons] = await Promise.all([listPricingOptions(service.id), listAddons(service.id)]);
  const detail = { service, pricingOptions, addons };
  setCachedServiceDetail(cacheKey, detail);
  return detail;
}

export async function getServiceDetailById(serviceId: string): Promise<ServiceDetailRecord | null> {
  const service = await getServiceById(serviceId);
  if (!service) {
    return null;
  }
  return getServiceDetailByCategoryAndSlug(service.categorySlug, service.slug);
}

function toServiceListResponse(service: ServiceRecord, pricingOptions: ServicePricingOptionRecord[]) {
  const sortedOptions = [...pricingOptions].sort((left, right) => left.order - right.order);
  const startingPrice =
    sortedOptions.length > 0 ? sortedOptions[0].price : Number.isFinite(service.basePrice) ? service.basePrice : 0;

  return {
    ...service,
    startingPrice,
    pricingOptionsCount: sortedOptions.length
  };
}

function readBodyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBodyNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function readBodyStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => readBodyString(entry)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (_error) {
      return null;
    }
  }
  return null;
}

function parseArrayPayload(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
        );
      }
    } catch (_error) {
      return [];
    }
  }
  return [];
}

function validateServicePayload(payload: Record<string, unknown>): {
  error: string;
  service: Omit<ServiceRecord, "id" | "createdAt" | "updatedAt"> | null;
} {
  const name = readBodyString(payload.name);
  const category = readBodyString(payload.category);
  const slug = readBodyString(payload.slug) || toSlug(name);
  const description = readBodyString(payload.description);
  const duration = readBodyString(payload.duration);
  const image = readBodyString(payload.image);
  const basePrice = readBodyNumber(payload.basePrice, 0);
  const pricingType = readBodyString(payload.pricingType) || "tiered";
  const rating = Number(readBodyNumber(payload.rating, 4.5).toFixed(1));
  const reviewCount = Math.max(0, Math.trunc(readBodyNumber(payload.reviewCount, 0)));
  const status = readStatus(payload.status);
  const includedServices = readBodyStringArray(payload.includedServices);
  const notIncludedServices = readBodyStringArray(payload.notIncludedServices);

  if (!name) {
    return { error: "Service name is required.", service: null };
  }
  if (!category) {
    return { error: "Service category is required.", service: null };
  }
  if (!description) {
    return { error: "Service description is required.", service: null };
  }
  if (!duration) {
    return { error: "Service duration is required.", service: null };
  }
  if (basePrice < 0) {
    return { error: "Base price must be non-negative.", service: null };
  }

  return {
    error: "",
    service: {
      name,
      category,
      categorySlug: toCategorySlug(category),
      slug,
      description,
      basePrice,
      pricingType,
      duration,
      image,
      includedServices,
      notIncludedServices,
      rating,
      reviewCount,
      status
    }
  };
}

function validatePricingOptionPayload(
  payload: Record<string, unknown>,
  serviceId: string
): { error: string; option: Omit<ServicePricingOptionRecord, "id" | "createdAt" | "updatedAt"> | null } {
  const title = readBodyString(payload.title);
  const description = readBodyString(payload.description);
  const price = readBodyNumber(payload.price, -1);
  const order = Math.max(1, Math.trunc(readBodyNumber(payload.order, 1)));

  if (!serviceId) {
    return { error: "serviceId is required.", option: null };
  }
  if (!title) {
    return { error: "Pricing option title is required.", option: null };
  }
  if (price < 0) {
    return { error: "Pricing option price must be non-negative.", option: null };
  }

  return {
    error: "",
    option: {
      serviceId,
      title,
      description,
      price,
      order
    }
  };
}

function validateAddonPayload(
  payload: Record<string, unknown>,
  serviceId: string
): { error: string; addon: Omit<ServiceAddonRecord, "id" | "createdAt" | "updatedAt"> | null } {
  const title = readBodyString(payload.title);
  const description = readBodyString(payload.description);
  const price = readBodyNumber(payload.price, -1);

  if (!serviceId) {
    return { error: "serviceId is required.", addon: null };
  }
  if (!title) {
    return { error: "Addon title is required.", addon: null };
  }
  if (price < 0) {
    return { error: "Addon price must be non-negative.", addon: null };
  }

  return {
    error: "",
    addon: {
      serviceId,
      title,
      description,
      price
    }
  };
}

async function upsertServiceRecord(
  serviceId: string,
  service: Omit<ServiceRecord, "id" | "createdAt" | "updatedAt">,
  existing?: ServiceRecord | null
): Promise<ServiceRecord> {
  const now = new Date().toISOString();
  const nextRecord: ServiceRecord = {
    id: serviceId,
    ...service,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  try {
    await db.collection("services").doc(serviceId).set(nextRecord, { merge: true });
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryServices.set(serviceId, nextRecord);
  clearServiceCaches();
  return nextRecord;
}

async function upsertPricingOptionRecord(
  optionId: string,
  option: Omit<ServicePricingOptionRecord, "id" | "createdAt" | "updatedAt">,
  existing?: ServicePricingOptionRecord | null
): Promise<ServicePricingOptionRecord> {
  const now = new Date().toISOString();
  const nextRecord: ServicePricingOptionRecord = {
    id: optionId,
    ...option,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  try {
    await db.collection("service_pricing_options").doc(optionId).set(nextRecord, { merge: true });
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryPricingOptions.set(optionId, nextRecord);
  clearServiceCaches();
  return nextRecord;
}

async function upsertAddonRecord(
  addonId: string,
  addon: Omit<ServiceAddonRecord, "id" | "createdAt" | "updatedAt">,
  existing?: ServiceAddonRecord | null
): Promise<ServiceAddonRecord> {
  const now = new Date().toISOString();
  const nextRecord: ServiceAddonRecord = {
    id: addonId,
    ...addon,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  try {
    await db.collection("service_addons").doc(addonId).set(nextRecord, { merge: true });
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryAddons.set(addonId, nextRecord);
  clearServiceCaches();
  return nextRecord;
}

async function removeServiceRecord(serviceId: string): Promise<void> {
  const pricingOptions = await listPricingOptions(serviceId);
  const addons = await listAddons(serviceId);

  try {
    await Promise.all([
      db.collection("services").doc(serviceId).delete(),
      ...pricingOptions.map((option) => db.collection("service_pricing_options").doc(option.id).delete()),
      ...addons.map((addon) => db.collection("service_addons").doc(addon.id).delete())
    ]);
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryServices.delete(serviceId);
  pricingOptions.forEach((option) => inMemoryPricingOptions.delete(option.id));
  addons.forEach((addon) => inMemoryAddons.delete(addon.id));
  clearServiceCaches();
}

async function removePricingOptionRecord(optionId: string): Promise<void> {
  try {
    await db.collection("service_pricing_options").doc(optionId).delete();
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryPricingOptions.delete(optionId);
  clearServiceCaches();
}

async function removeAddonRecord(addonId: string): Promise<void> {
  try {
    await db.collection("service_addons").doc(addonId).delete();
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryAddons.delete(addonId);
  clearServiceCaches();
}

function getAdminSessionToken(req: Request): string {
  const headerToken = readBodyString(req.header("x-admin-session-token"));
  if (headerToken) {
    return headerToken;
  }

  const authorizationHeader = readBodyString(req.header("authorization"));
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  const queryToken = readBodyString(req.query.sessionToken);
  if (queryToken) {
    return queryToken;
  }

  return typeof req.body === "object" && req.body !== null
    ? readBodyString((req.body as Record<string, unknown>).sessionToken)
    : "";
}

function readUploadedFileExtension(name: string, mimeType: string): string {
  const normalizedMime = mimeType.toLowerCase();
  if (normalizedMime === "image/png") return "png";
  if (normalizedMime === "image/jpeg") return "jpg";
  if (normalizedMime === "image/webp") return "webp";

  const extension = name.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }
  return "";
}

async function persistServiceImage(input: unknown): Promise<string> {
  const payload = parseJsonObject(input);
  if (!payload) {
    throw new Error("Image payload is required.");
  }

  const fileName = readBodyString(payload.name);
  const mimeType = readBodyString(payload.type);
  const dataUrl = readBodyString(payload.dataUrl);
  const extension = readUploadedFileExtension(fileName, mimeType);
  if (!extension) {
    throw new Error("Only PNG, JPG or WEBP images are allowed.");
  }

  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid uploaded image payload.");
  }

  const fileBuffer = Buffer.from(match[1], "base64");
  if (fileBuffer.byteLength === 0 || fileBuffer.byteLength > maxImageBytes) {
    throw new Error("Image size must be between 1 byte and 5MB.");
  }

  await fs.mkdir(serviceImagesRoot, { recursive: true });
  const storedFileName = `${Date.now()}-${crypto.randomUUID()}-service.${extension}`;
  const absolutePath = path.join(serviceImagesRoot, storedFileName);
  await fs.writeFile(absolutePath, fileBuffer);
  return formatImageUrl(path.join("service-images", storedFileName).replace(/\\/g, "/"));
}

export function registerServiceRoutes(app: Express, options: RegisterServiceRoutesOptions): void {
  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const requestedCategory = readBodyString(req.query.category);
      const requestedSearch = readBodyString(req.query.search).toLowerCase();
      const requestedStatus = readBodyString(req.query.status).toLowerCase();
      const services = await listServices();
      const visibleServices = services.filter((service) => {
        if (requestedStatus && service.status.toLowerCase() !== requestedStatus) {
          return false;
        }
        if (
          requestedCategory &&
          service.category.toLowerCase() !== requestedCategory.toLowerCase() &&
          service.categorySlug !== toCategorySlug(requestedCategory)
        ) {
          return false;
        }
        if (!requestedSearch) {
          return true;
        }
        const haystack = `${service.name} ${service.category} ${service.description}`.toLowerCase();
        return haystack.includes(requestedSearch);
      });

      const pricingEntries = await Promise.all(
        visibleServices.map(async (service) => ({
          serviceId: service.id,
          pricingOptions: await listPricingOptions(service.id)
        }))
      );
      const pricingMap = new Map(pricingEntries.map((entry) => [entry.serviceId, entry.pricingOptions]));

      return res.json({
        categories: Array.from(new Set(services.map((service) => service.category))).sort((left, right) =>
          left.localeCompare(right)
        ),
        services: visibleServices
          .map((service) => toServiceListResponse(service, pricingMap.get(service.id) || []))
          .sort((left, right) => left.name.localeCompare(right.name))
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to load services", error: getErrorMessage(error) });
    }
  });

  app.get("/api/services/id/:serviceId", async (req: Request, res: Response) => {
    try {
      const serviceId = readBodyString(req.params.serviceId);
      const detail = await getServiceDetailById(serviceId);
      if (!detail) {
        return res.status(404).json({ message: "Service not found" });
      }
      return res.json(detail);
    } catch (error) {
      return res.status(500).json({ message: "Failed to load service details", error: getErrorMessage(error) });
    }
  });

  app.get("/api/services/:categorySlug/:serviceSlug", async (req: Request, res: Response) => {
    try {
      const categorySlug = readBodyString(req.params.categorySlug);
      const serviceSlug = readBodyString(req.params.serviceSlug);
      const detail = await getServiceDetailByCategoryAndSlug(categorySlug, serviceSlug);
      if (!detail) {
        return res.status(404).json({ message: "Service not found" });
      }
      return res.json(detail);
    } catch (error) {
      return res.status(500).json({ message: "Failed to load service details", error: getErrorMessage(error) });
    }
  });

  app.get("/api/admin/services", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const services = await listServices();
      const detailEntries = await Promise.all(
        services.map(async (service) => ({
          service,
          pricingOptions: await listPricingOptions(service.id),
          addons: await listAddons(service.id)
        }))
      );
      return res.json({ services: detailEntries });
    } catch (error) {
      return res.status(500).json({ message: "Failed to load admin services", error: getErrorMessage(error) });
    }
  });

  app.post("/api/admin/services/upload-image", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const imageUrl = await persistServiceImage((req.body as Record<string, unknown>).file);
      return res.status(201).json({ imageUrl });
    } catch (error) {
      return res.status(400).json({ message: getErrorMessage(error) });
    }
  });

  app.post("/api/admin/services", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const payload = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
      const validated = validateServicePayload(payload);
      if (validated.error || !validated.service) {
        return res.status(400).json({ message: validated.error || "Invalid service payload." });
      }

      const services = await listServices();
      const duplicate = services.find(
        (service) =>
          service.slug === validated.service?.slug &&
          service.categorySlug === validated.service?.categorySlug
      );
      if (duplicate) {
        return res.status(409).json({ message: "A service with the same slug already exists in this category." });
      }

      const serviceId = `svc-${validated.service.categorySlug}-${validated.service.slug}`;
      const createdService = await upsertServiceRecord(serviceId, validated.service);

      const pricingOptionsPayload = parseArrayPayload(payload.pricingOptions);
      const addonsPayload = parseArrayPayload(payload.addons);

      const createdPricingOptions = await Promise.all(
        pricingOptionsPayload.map(async (entry, index) => {
          const next = validatePricingOptionPayload(entry, createdService.id);
          if (!next.option || next.error) {
            throw new Error(next.error || "Invalid pricing option payload.");
          }
          return upsertPricingOptionRecord(`spo-${createdService.id}-${index + 1}-${toSlug(next.option.title)}`, next.option);
        })
      );

      const createdAddons = await Promise.all(
        addonsPayload.map(async (entry, index) => {
          const next = validateAddonPayload(entry, createdService.id);
          if (!next.addon || next.error) {
            throw new Error(next.error || "Invalid addon payload.");
          }
          return upsertAddonRecord(`sad-${createdService.id}-${index + 1}-${toSlug(next.addon.title)}`, next.addon);
        })
      );

      return res.status(201).json({
        message: "Service created successfully.",
        service: createdService,
        pricingOptions: createdPricingOptions,
        addons: createdAddons
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to create service", error: getErrorMessage(error) });
    }
  });

  app.patch("/api/admin/services/:serviceId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const serviceId = readBodyString(req.params.serviceId);
      const existing = await getServiceById(serviceId);
      if (!existing) {
        return res.status(404).json({ message: "Service not found." });
      }

      const payload = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
      const validated = validateServicePayload({
        ...existing,
        ...payload
      });
      if (validated.error || !validated.service) {
        return res.status(400).json({ message: validated.error || "Invalid service payload." });
      }

      const updatedService = await upsertServiceRecord(serviceId, validated.service, existing);
      return res.json({ message: "Service updated successfully.", service: updatedService });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update service", error: getErrorMessage(error) });
    }
  });

  app.delete("/api/admin/services/:serviceId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const serviceId = readBodyString(req.params.serviceId);
      const existing = await getServiceById(serviceId);
      if (!existing) {
        return res.status(404).json({ message: "Service not found." });
      }
      await removeServiceRecord(serviceId);
      return res.json({ message: "Service deleted successfully." });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete service", error: getErrorMessage(error) });
    }
  });

  app.post("/api/admin/services/:serviceId/pricing-options", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const serviceId = readBodyString(req.params.serviceId);
      const service = await getServiceById(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found." });
      }

      const payload = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
      const validated = validatePricingOptionPayload(payload, serviceId);
      if (validated.error || !validated.option) {
        return res.status(400).json({ message: validated.error || "Invalid pricing option payload." });
      }

      const optionId = `spo-${serviceId}-${Date.now()}-${toSlug(validated.option.title)}`;
      const pricingOption = await upsertPricingOptionRecord(optionId, validated.option);
      return res.status(201).json({ message: "Pricing option added successfully.", pricingOption });
    } catch (error) {
      return res.status(500).json({ message: "Failed to add pricing option", error: getErrorMessage(error) });
    }
  });

  app.patch("/api/admin/services/:serviceId/pricing-options/:pricingOptionId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const serviceId = readBodyString(req.params.serviceId);
      const pricingOptionId = readBodyString(req.params.pricingOptionId);
      const existing =
        inMemoryPricingOptions.get(pricingOptionId) ||
        (await listPricingOptions(serviceId)).find((item) => item.id === pricingOptionId) ||
        null;
      if (!existing) {
        return res.status(404).json({ message: "Pricing option not found." });
      }

      const payload = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
      const validated = validatePricingOptionPayload({ ...existing, ...payload }, serviceId);
      if (validated.error || !validated.option) {
        return res.status(400).json({ message: validated.error || "Invalid pricing option payload." });
      }

      const pricingOption = await upsertPricingOptionRecord(pricingOptionId, validated.option, existing);
      return res.json({ message: "Pricing option updated successfully.", pricingOption });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update pricing option", error: getErrorMessage(error) });
    }
  });

  app.delete("/api/admin/services/:serviceId/pricing-options/:pricingOptionId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const pricingOptionId = readBodyString(req.params.pricingOptionId);
      await removePricingOptionRecord(pricingOptionId);
      return res.json({ message: "Pricing option deleted successfully." });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete pricing option", error: getErrorMessage(error) });
    }
  });

  app.post("/api/admin/services/:serviceId/addons", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const serviceId = readBodyString(req.params.serviceId);
      const service = await getServiceById(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found." });
      }

      const payload = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
      const validated = validateAddonPayload(payload, serviceId);
      if (validated.error || !validated.addon) {
        return res.status(400).json({ message: validated.error || "Invalid addon payload." });
      }

      const addonId = `sad-${serviceId}-${Date.now()}-${toSlug(validated.addon.title)}`;
      const addon = await upsertAddonRecord(addonId, validated.addon);
      return res.status(201).json({ message: "Addon added successfully.", addon });
    } catch (error) {
      return res.status(500).json({ message: "Failed to add addon", error: getErrorMessage(error) });
    }
  });

  app.patch("/api/admin/services/:serviceId/addons/:addonId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const serviceId = readBodyString(req.params.serviceId);
      const addonId = readBodyString(req.params.addonId);
      const existing =
        inMemoryAddons.get(addonId) || (await listAddons(serviceId)).find((item) => item.id === addonId) || null;
      if (!existing) {
        return res.status(404).json({ message: "Addon not found." });
      }

      const payload = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
      const validated = validateAddonPayload({ ...existing, ...payload }, serviceId);
      if (validated.error || !validated.addon) {
        return res.status(400).json({ message: validated.error || "Invalid addon payload." });
      }

      const addon = await upsertAddonRecord(addonId, validated.addon, existing);
      return res.json({ message: "Addon updated successfully.", addon });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update addon", error: getErrorMessage(error) });
    }
  });

  app.delete("/api/admin/services/:serviceId/addons/:addonId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const addonId = readBodyString(req.params.addonId);
      await removeAddonRecord(addonId);
      return res.json({ message: "Addon deleted successfully." });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete addon", error: getErrorMessage(error) });
    }
  });
}

export {
  ensureServicesBootstrapData,
  type ServiceAddonRecord,
  type ServiceDetailRecord,
  type ServicePricingOptionRecord,
  type ServiceRecord
};
