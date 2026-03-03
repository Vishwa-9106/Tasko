import crypto from "crypto";
import fs from "fs/promises";
import { Express, Request, Response } from "express";
import path from "path";
import { db } from "./firebaseAdmin";

type WorkerApplicationStatus = "Under Review" | "Visit Required" | "Approved" | "Rejected" | "Account Created";
type WorkerStatus = "Active" | "Suspended" | "Terminated";

type WorkerApplicationRecord = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  category_applied: string;
  id_proof_url: string;
  address_proof_url: string;
  status: WorkerApplicationStatus;
  admin_notes: string;
  applied_at: string;
  reviewed_at?: string;
  approved_worker_id?: string;
};

type WorkerRecord = {
  worker_id: string;
  full_name: string;
  phone: string;
  email: string;
  category: string;
  salary: number;
  password_hash: string;
  status: WorkerStatus;
  joining_date: string;
  created_at: string;
  updated_at?: string;
  online: boolean;
  rating: number;
};

type CategoryRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type SubcategoryRecord = {
  id: string;
  categoryId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type SessionRecord = {
  workerId: string;
  createdAt: number;
};

type RegisterWorkerHiringOptions = {
  validateAdminSession: (token: string) => boolean;
};

const workerSessions = new Map<string, SessionRecord>();
const workerSessionTtlMs = 1000 * 60 * 60 * 24;
const inMemoryWorkerApplications = new Map<string, WorkerApplicationRecord>();
const inMemoryWorkers = new Map<string, WorkerRecord>();
const inMemoryCategories = new Map<string, CategoryRecord>();
const inMemorySubcategories = new Map<string, SubcategoryRecord>();
const defaultServiceCategories = [
  "Cleaning",
  "Washing",
  "Maintenance",
  "Mechanic",
  "Plumbing",
  "Technical & Installation Services",
  "Caring",
  "Barber & Makeup Services",
  "Cooking",
  "AC Repair"
];
const defaultSubcategoriesByCategoryName: Record<string, string[]> = {
  cleaning: [
    "House Cleaning",
    "Deep Cleaning",
    "Kitchen Cleaninng",
    "Bathroom Cleaning",
    "Office Cleaning"
  ],
  washing: [
    "Dish Washing",
    "Clothes Washing",
    "Bike Washing",
    "Car Washing",
    "Sofa / Carpet Washing"
  ],
  maintenance: [
    "Garden Maintenance",
    "Lawn Cutting",
    "Water Tank Cleaning",
    "General Home Maintenance",
    "Minor Repair Work"
  ],
  mechanic: [
    "Bike Repair",
    "Car Repair",
    "Puncture Fix",
    "Engine Check",
    "Battery Replacement"
  ],
  plumbing: [
    "Pipe Leakage Fix",
    "Tap Installation",
    "Drain Block Cleaning",
    "Bathroom Fitting Repair",
    "Water Motor Repair"
  ],
  "technical & installation services": [
    "Fan Installation",
    "Light Installation",
    "TV Installation",
    "CCTV Installation",
    "Washing Machine Installation",
    "Inverter Installation"
  ],
  caring: ["Babysitting", "Elder Care", "Patient Care", "Full Day Care", "Night Care"],
  "barber & makeup services": [
    "Hair Cutting",
    "Beard Styling",
    "Facial",
    "Bridal Makeup",
    "Party Makeup"
  ],
  cooking: [
    "Home Cook (Daily)",
    "Event Cooking",
    "Veg Cooking",
    "Non-Veg Cooking",
    "Temporary Cook"
  ],
  "ac repair": [
    "AC Installation",
    "AC Gas Refill",
    "AC General Service",
    "AC Not Cooling Issue",
    "AC Water Leakage Fix"
  ]
};

const uploadsRoot = path.resolve(__dirname, "../uploads");
const workerDocumentsRoot = path.join(uploadsRoot, "worker-documents");
const maxDocumentBytes = 5 * 1024 * 1024;
const workerApplicationStatuses: WorkerApplicationStatus[] = [
  "Under Review",
  "Visit Required",
  "Approved",
  "Rejected",
  "Account Created"
];
const allowedDocumentMimeTypes: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: unknown): string {
  return readTrimmedString(value).replace(/\D/g, "");
}

function normalizeCategoryName(value: unknown): string {
  return readTrimmedString(value).replace(/\s+/g, " ");
}

function uniqueCategories(input: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();
  input.forEach((value) => {
    const normalized = normalizeCategoryName(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(normalized);
  });
  return deduped;
}

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "category";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isFirestoreUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("5 NOT_FOUND") ||
    message.includes("database (default) does not exist") ||
    message.includes("The caller does not have permission")
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes("6 ALREADY_EXISTS") || message.toLowerCase().includes("already exists");
}

function normalizeWorkerApplicationStatus(value: unknown): WorkerApplicationStatus {
  const normalized = readTrimmedString(value).toLowerCase().replace(/_/g, " ");
  if (normalized === "visit required") return "Visit Required";
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "account created") return "Account Created";
  return "Under Review";
}

function normalizeWorkerStatus(value: unknown): WorkerStatus {
  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "suspended") return "Suspended";
  if (normalized === "terminated") return "Terminated";
  return "Active";
}

function isValidWorkerApplicationStatus(value: unknown): value is WorkerApplicationStatus {
  return workerApplicationStatuses.includes(value as WorkerApplicationStatus);
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

  const queryToken =
    typeof req.query.sessionToken === "string" ? readTrimmedString(req.query.sessionToken) : "";
  if (queryToken) {
    return queryToken;
  }

  return readTrimmedString((req.body as { sessionToken?: unknown })?.sessionToken);
}

function getWorkerSessionToken(req: Request): string {
  const headerToken = readTrimmedString(req.header("x-worker-session-token"));
  if (headerToken) {
    return headerToken;
  }

  const authorizationHeader = readTrimmedString(req.header("authorization"));
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  return readTrimmedString((req.body as { sessionToken?: unknown })?.sessionToken);
}

function resolveWorkerSession(sessionToken: string): string | null {
  const session = workerSessions.get(sessionToken);
  if (!session) {
    return null;
  }

  if (Date.now() - session.createdAt > workerSessionTtlMs) {
    workerSessions.delete(sessionToken);
    return null;
  }

  return session.workerId;
}

function createWorkerSession(workerId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  workerSessions.set(token, { workerId, createdAt: Date.now() });
  return token;
}

function clearWorkerSession(sessionToken: string): void {
  workerSessions.delete(sessionToken);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, expectedHash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(actualHash, "hex"));
  } catch {
    return false;
  }
}

function normalizeWorkerId(value: unknown): string {
  return readTrimmedString(value).toUpperCase();
}

function isValidWorkerId(workerId: string): boolean {
  return /^[A-Z0-9_-]{4,32}$/.test(workerId);
}

function normalizeWorkerRecord(workerId: string, data: Record<string, unknown>): WorkerRecord {
  const now = new Date().toISOString();
  return {
    worker_id: readTrimmedString(data.worker_id) || workerId,
    full_name: readTrimmedString(data.full_name),
    phone: normalizePhone(data.phone),
    email: readTrimmedString(data.email).toLowerCase(),
    category: readTrimmedString(data.category),
    salary: Number.isFinite(Number(data.salary)) ? Number(data.salary) : 18000,
    password_hash: readTrimmedString(data.password_hash),
    status: normalizeWorkerStatus(data.status),
    joining_date: readTrimmedString(data.joining_date) || now.slice(0, 10),
    created_at: readTrimmedString(data.created_at) || now,
    updated_at: readTrimmedString(data.updated_at) || undefined,
    online: Boolean(data.online),
    rating: Number.isFinite(Number(data.rating)) ? Number(data.rating) : 0
  };
}

function toWorkerResponse(worker: WorkerRecord): Record<string, unknown> {
  return {
    id: worker.worker_id,
    worker_id: worker.worker_id,
    full_name: worker.full_name,
    name: worker.full_name,
    phone: worker.phone,
    email: worker.email,
    category: worker.category,
    salary: worker.salary,
    status: worker.status,
    joining_date: worker.joining_date,
    created_at: worker.created_at,
    online: worker.online,
    rating: worker.rating
  };
}

function resolveDocumentExtension(name: string, type: string): string {
  if (allowedDocumentMimeTypes[type]) {
    return allowedDocumentMimeTypes[type];
  }
  const extension = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf", "jpg", "jpeg", "png", "webp"].includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }
  return "";
}

async function persistDocument(input: unknown, label: "id-proof" | "address-proof"): Promise<string> {
  if (!isRecord(input)) {
    throw new Error(`Missing ${label} document`);
  }

  const fileName = readTrimmedString(input.name);
  const mimeType = readTrimmedString(input.type).toLowerCase();
  const dataUrl = readTrimmedString(input.dataUrl);
  const extension = resolveDocumentExtension(fileName, mimeType);
  if (!extension) {
    throw new Error("Only PDF, JPG, PNG or WEBP files are allowed.");
  }

  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid uploaded document payload.");
  }

  const fileBuffer = Buffer.from(match[1], "base64");
  if (fileBuffer.byteLength === 0 || fileBuffer.byteLength > maxDocumentBytes) {
    throw new Error("Document size must be between 1 byte and 5MB.");
  }

  await fs.mkdir(workerDocumentsRoot, { recursive: true });
  const storedFileName = `${Date.now()}-${crypto.randomUUID()}-${label}.${extension}`;
  const absolutePath = path.join(workerDocumentsRoot, storedFileName);
  await fs.writeFile(absolutePath, fileBuffer);
  return path.join("worker-documents", storedFileName).replace(/\\/g, "/");
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const webhookUrl = readTrimmedString(process.env.EMAIL_WEBHOOK_URL);
  if (!webhookUrl) {
    // eslint-disable-next-line no-console
    console.log(`[Email Stub] To: ${to}; Subject: ${subject}; Body: ${text}`);
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, text })
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Email delivery failed: ${getErrorMessage(error)}`);
  }
}

function normalizeWorkerApplicationRecord(
  applicationId: string,
  data: Record<string, unknown>
): WorkerApplicationRecord {
  const appliedAt = readTrimmedString(data.applied_at) || new Date().toISOString();
  return {
    id: applicationId,
    full_name: readTrimmedString(data.full_name),
    phone: normalizePhone(data.phone),
    email: readTrimmedString(data.email).toLowerCase(),
    address: readTrimmedString(data.address),
    category_applied: readTrimmedString(data.category_applied),
    id_proof_url: readTrimmedString(data.id_proof_url),
    address_proof_url: readTrimmedString(data.address_proof_url),
    status: normalizeWorkerApplicationStatus(data.status),
    admin_notes: readTrimmedString(data.admin_notes),
    applied_at: appliedAt,
    reviewed_at: readTrimmedString(data.reviewed_at) || undefined,
    approved_worker_id: readTrimmedString(data.approved_worker_id) || undefined
  };
}

async function getWorkerApplicationById(applicationId: string): Promise<WorkerApplicationRecord | null> {
  const inMemoryRecord = inMemoryWorkerApplications.get(applicationId);
  try {
    const document = await db.collection("worker_applications").doc(applicationId).get();
    if (document.exists) {
      return normalizeWorkerApplicationRecord(document.id, document.data() || {});
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
  return inMemoryRecord || null;
}

async function listWorkerApplications(): Promise<WorkerApplicationRecord[]> {
  try {
    const snapshot = await db.collection("worker_applications").orderBy("applied_at", "desc").get();
    return snapshot.docs.map((document) => normalizeWorkerApplicationRecord(document.id, document.data()));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return Array.from(inMemoryWorkerApplications.values()).sort(
    (left, right) => new Date(right.applied_at).getTime() - new Date(left.applied_at).getTime()
  );
}

async function updateWorkerApplication(
  applicationId: string,
  patch: Partial<Omit<WorkerApplicationRecord, "id">>
): Promise<WorkerApplicationRecord | null> {
  const current = await getWorkerApplicationById(applicationId);
  if (!current) {
    return null;
  }

  const nextRecord = normalizeWorkerApplicationRecord(applicationId, {
    ...current,
    ...patch
  });

  // Firestore rejects undefined values. Strip them before merge updates.
  const firestorePatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );

  try {
    if (Object.keys(firestorePatch).length > 0) {
      await db.collection("worker_applications").doc(applicationId).set(firestorePatch, { merge: true });
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryWorkerApplications.set(applicationId, nextRecord);
  return nextRecord;
}

async function getWorkerById(workerId: string): Promise<WorkerRecord | null> {
  const inMemoryRecord = inMemoryWorkers.get(workerId);
  try {
    const document = await db.collection("workers").doc(workerId).get();
    if (document.exists) {
      return normalizeWorkerRecord(document.id, document.data() || {});
    }

    const querySnapshot = await db.collection("workers").where("worker_id", "==", workerId).limit(1).get();
    if (!querySnapshot.empty) {
      return normalizeWorkerRecord(querySnapshot.docs[0].id, querySnapshot.docs[0].data());
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
  return inMemoryRecord || null;
}

async function listWorkers(): Promise<WorkerRecord[]> {
  try {
    const snapshot = await db.collection("workers").get();
    return snapshot.docs.map((document) => normalizeWorkerRecord(document.id, document.data()));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
  return Array.from(inMemoryWorkers.values());
}

function normalizeCategoryRecord(categoryId: string, data: Record<string, unknown>): CategoryRecord {
  const now = new Date().toISOString();
  return {
    id: categoryId,
    name: normalizeCategoryName(data.name),
    createdAt:
      readTrimmedString(data.createdAt) || readTrimmedString(data.created_at) || now,
    updatedAt:
      readTrimmedString(data.updatedAt) || readTrimmedString(data.updated_at) || now
  };
}

function normalizeSubcategoryRecord(subcategoryId: string, data: Record<string, unknown>): SubcategoryRecord {
  const now = new Date().toISOString();
  return {
    id: subcategoryId,
    categoryId: readTrimmedString(data.categoryId) || readTrimmedString(data.category_id),
    name: normalizeCategoryName(data.name),
    createdAt:
      readTrimmedString(data.createdAt) || readTrimmedString(data.created_at) || now,
    updatedAt:
      readTrimmedString(data.updatedAt) || readTrimmedString(data.updated_at) || now
  };
}

function toCategoryResponse(category: CategoryRecord, subcategoryCount: number): Record<string, unknown> {
  return {
    id: category.id,
    name: category.name,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    subcategoryCount
  };
}

function toSubcategoryResponse(subcategory: SubcategoryRecord): Record<string, unknown> {
  return {
    id: subcategory.id,
    categoryId: subcategory.categoryId,
    category_id: subcategory.categoryId,
    name: subcategory.name,
    createdAt: subcategory.createdAt,
    updatedAt: subcategory.updatedAt
  };
}

function ensureInMemoryDefaultCategories(): CategoryRecord[] {
  if (inMemoryCategories.size > 0) {
    return Array.from(inMemoryCategories.values());
  }

  const now = new Date().toISOString();
  const usedIds = new Set<string>();
  uniqueCategories(defaultServiceCategories).forEach((name) => {
    const baseId = `cat-${toSlug(name)}`;
    let nextId = baseId;
    let suffix = 1;
    while (usedIds.has(nextId)) {
      suffix += 1;
      nextId = `${baseId}-${suffix}`;
    }
    usedIds.add(nextId);
    inMemoryCategories.set(nextId, {
      id: nextId,
      name,
      createdAt: now,
      updatedAt: now
    });
  });

  return Array.from(inMemoryCategories.values());
}

async function ensureDefaultSubcategoriesForCategories(categories: CategoryRecord[]): Promise<void> {
  if (categories.length === 0) {
    return;
  }

  const existing = await listSubcategories();
  const existingByCategoryId = new Map<string, Set<string>>();
  existing.forEach((subcategory) => {
    const key = subcategory.categoryId;
    const current = existingByCategoryId.get(key) || new Set<string>();
    current.add(subcategory.name.toLowerCase());
    existingByCategoryId.set(key, current);
  });

  const now = new Date().toISOString();
  const recordsToSeed: SubcategoryRecord[] = [];
  categories.forEach((category) => {
    const defaults =
      defaultSubcategoriesByCategoryName[category.name.trim().toLowerCase()] || [];
    if (defaults.length === 0) {
      return;
    }

    const existingNames = existingByCategoryId.get(category.id) || new Set<string>();
    uniqueCategories(defaults).forEach((name) => {
      const normalizedName = normalizeCategoryName(name);
      if (!normalizedName) {
        return;
      }
      if (existingNames.has(normalizedName.toLowerCase())) {
        return;
      }
      existingNames.add(normalizedName.toLowerCase());
      recordsToSeed.push({
        id: `sub-${crypto.randomUUID()}`,
        categoryId: category.id,
        name: normalizedName,
        createdAt: now,
        updatedAt: now
      });
    });
  });

  if (recordsToSeed.length === 0) {
    return;
  }

  try {
    await Promise.all(
      recordsToSeed.map((record) =>
        db.collection("subcategories").doc(record.id).set(
          {
            categoryId: record.categoryId,
            name: record.name,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
          },
          { merge: true }
        )
      )
    );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  recordsToSeed.forEach((record) => inMemorySubcategories.set(record.id, record));
}

async function listCategories(): Promise<CategoryRecord[]> {
  try {
    const snapshot = await db.collection("categories").get();
    if (!snapshot.empty) {
      const categories = snapshot.docs
        .map((document) => normalizeCategoryRecord(document.id, document.data()))
        .filter((record) => Boolean(record.name))
        .sort((left, right) => left.name.localeCompare(right.name));

      categories.forEach((record) => inMemoryCategories.set(record.id, record));
      await ensureDefaultSubcategoriesForCategories(categories);
      return categories;
    }

    const now = new Date().toISOString();
    const seedRecords = ensureInMemoryDefaultCategories().map((record) => ({
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now
    }));
    await Promise.all(
      seedRecords.map((record) =>
        db.collection("categories").doc(record.id).set(
          {
            name: record.name,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
          },
          { merge: true }
        )
      )
    );
    await ensureDefaultSubcategoriesForCategories(seedRecords);
    return seedRecords.sort((left, right) => left.name.localeCompare(right.name));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  const fallbackCategories = ensureInMemoryDefaultCategories().sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  await ensureDefaultSubcategoriesForCategories(fallbackCategories);
  return fallbackCategories;
}

async function getCategoryById(categoryId: string): Promise<CategoryRecord | null> {
  const fromMemory = inMemoryCategories.get(categoryId);
  if (fromMemory) {
    return fromMemory;
  }

  try {
    const document = await db.collection("categories").doc(categoryId).get();
    if (document.exists) {
      const normalized = normalizeCategoryRecord(document.id, document.data() || {});
      inMemoryCategories.set(normalized.id, normalized);
      return normalized;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return null;
}

async function listSubcategories(categoryId?: string): Promise<SubcategoryRecord[]> {
  try {
    const snapshot = categoryId
      ? await db.collection("subcategories").where("categoryId", "==", categoryId).get()
      : await db.collection("subcategories").get();
    const subcategories = snapshot.docs
      .map((document) => normalizeSubcategoryRecord(document.id, document.data()))
      .filter(
        (record) =>
          Boolean(record.name) &&
          Boolean(record.categoryId) &&
          (!categoryId || record.categoryId === categoryId)
      )
      .sort((left, right) => left.name.localeCompare(right.name));
    subcategories.forEach((record) => inMemorySubcategories.set(record.id, record));
    return subcategories;
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return Array.from(inMemorySubcategories.values())
    .filter((record) => !categoryId || record.categoryId === categoryId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function getSubcategoryById(subcategoryId: string): Promise<SubcategoryRecord | null> {
  const fromMemory = inMemorySubcategories.get(subcategoryId);
  if (fromMemory) {
    return fromMemory;
  }

  try {
    const document = await db.collection("subcategories").doc(subcategoryId).get();
    if (document.exists) {
      const normalized = normalizeSubcategoryRecord(document.id, document.data() || {});
      inMemorySubcategories.set(normalized.id, normalized);
      return normalized;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return null;
}

async function createCategory(name: string): Promise<{ category: CategoryRecord | null; created: boolean }> {
  const normalizedName = normalizeCategoryName(name);
  if (!normalizedName) {
    throw new Error("Category name is required.");
  }

  const existing = await listCategories();
  if (existing.some((record) => record.name.toLowerCase() === normalizedName.toLowerCase())) {
    return { category: null, created: false };
  }

  const now = new Date().toISOString();
  const categoryId = `cat-${crypto.randomUUID()}`;
  const category: CategoryRecord = {
    id: categoryId,
    name: normalizedName,
    createdAt: now,
    updatedAt: now
  };

  try {
    await db.collection("categories").doc(categoryId).set(
      {
        name: category.name,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
      },
      { merge: true }
    );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryCategories.set(category.id, category);
  return { category, created: true };
}

async function updateCategory(
  categoryId: string,
  name: string
): Promise<{ category: CategoryRecord | null; updated: boolean }> {
  const normalizedName = normalizeCategoryName(name);
  if (!normalizedName) {
    throw new Error("Category name is required.");
  }

  const current = await getCategoryById(categoryId);
  if (!current) {
    return { category: null, updated: false };
  }

  const allCategories = await listCategories();
  const duplicate = allCategories.find(
    (record) =>
      record.id !== categoryId &&
      record.name.toLowerCase() === normalizedName.toLowerCase()
  );
  if (duplicate) {
    return { category: null, updated: false };
  }

  const next: CategoryRecord = {
    ...current,
    name: normalizedName,
    updatedAt: new Date().toISOString()
  };

  try {
    await db.collection("categories").doc(categoryId).set(
      {
        name: next.name,
        updatedAt: next.updatedAt
      },
      { merge: true }
    );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryCategories.set(categoryId, next);
  return { category: next, updated: true };
}

async function deleteCategory(
  categoryId: string
): Promise<{ deleted: boolean; deletedSubcategoryCount: number }> {
  const current = await getCategoryById(categoryId);
  if (!current) {
    return { deleted: false, deletedSubcategoryCount: 0 };
  }

  const subcategories = await listSubcategories(categoryId);
  try {
    await Promise.all([
      db.collection("categories").doc(categoryId).delete(),
      ...subcategories.map((subcategory) =>
        db.collection("subcategories").doc(subcategory.id).delete()
      )
    ]);
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryCategories.delete(categoryId);
  subcategories.forEach((subcategory) => inMemorySubcategories.delete(subcategory.id));
  return { deleted: true, deletedSubcategoryCount: subcategories.length };
}

async function createSubcategory(
  categoryId: string,
  name: string
): Promise<{ subcategory: SubcategoryRecord | null; created: boolean }> {
  const normalizedName = normalizeCategoryName(name);
  if (!normalizedName) {
    throw new Error("Subcategory name is required.");
  }

  const category = await getCategoryById(categoryId);
  if (!category) {
    return { subcategory: null, created: false };
  }

  const existing = await listSubcategories(categoryId);
  if (existing.some((record) => record.name.toLowerCase() === normalizedName.toLowerCase())) {
    return { subcategory: null, created: false };
  }

  const now = new Date().toISOString();
  const subcategoryId = `sub-${crypto.randomUUID()}`;
  const subcategory: SubcategoryRecord = {
    id: subcategoryId,
    categoryId,
    name: normalizedName,
    createdAt: now,
    updatedAt: now
  };

  try {
    await db.collection("subcategories").doc(subcategoryId).set(
      {
        categoryId: subcategory.categoryId,
        name: subcategory.name,
        createdAt: subcategory.createdAt,
        updatedAt: subcategory.updatedAt
      },
      { merge: true }
    );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemorySubcategories.set(subcategory.id, subcategory);
  return { subcategory, created: true };
}

async function updateSubcategory(
  categoryId: string,
  subcategoryId: string,
  name: string
): Promise<{ subcategory: SubcategoryRecord | null; updated: boolean }> {
  const normalizedName = normalizeCategoryName(name);
  if (!normalizedName) {
    throw new Error("Subcategory name is required.");
  }

  const current = await getSubcategoryById(subcategoryId);
  if (!current || current.categoryId !== categoryId) {
    return { subcategory: null, updated: false };
  }

  const allInCategory = await listSubcategories(categoryId);
  const duplicate = allInCategory.find(
    (record) =>
      record.id !== subcategoryId &&
      record.name.toLowerCase() === normalizedName.toLowerCase()
  );
  if (duplicate) {
    return { subcategory: null, updated: false };
  }

  const next: SubcategoryRecord = {
    ...current,
    name: normalizedName,
    updatedAt: new Date().toISOString()
  };

  try {
    await db.collection("subcategories").doc(subcategoryId).set(
      {
        name: next.name,
        updatedAt: next.updatedAt
      },
      { merge: true }
    );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemorySubcategories.set(subcategoryId, next);
  return { subcategory: next, updated: true };
}

async function deleteSubcategory(
  categoryId: string,
  subcategoryId: string
): Promise<{ deleted: boolean }> {
  const current = await getSubcategoryById(subcategoryId);
  if (!current || current.categoryId !== categoryId) {
    return { deleted: false };
  }

  try {
    await db.collection("subcategories").doc(subcategoryId).delete();
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemorySubcategories.delete(subcategoryId);
  return { deleted: true };
}

function buildDocumentUrl(
  req: Request,
  applicationId: string,
  documentType: "id-proof" | "address-proof",
  sessionToken: string
): string {
  const protocol = req.protocol;
  const host = req.get("host") || "localhost:5000";
  return `${protocol}://${host}/api/admin/worker-applications/${applicationId}/documents/${documentType}?sessionToken=${encodeURIComponent(sessionToken)}`;
}

function toApplicationResponse(
  req: Request,
  sessionToken: string,
  application: WorkerApplicationRecord
): Record<string, unknown> {
  return {
    id: application.id,
    full_name: application.full_name,
    name: application.full_name,
    phone: application.phone,
    email: application.email,
    address: application.address,
    category_applied: application.category_applied,
    category: application.category_applied,
    id_proof_url: buildDocumentUrl(req, application.id, "id-proof", sessionToken),
    address_proof_url: buildDocumentUrl(req, application.id, "address-proof", sessionToken),
    status: application.status,
    admin_notes: application.admin_notes,
    applied_at: application.applied_at,
    createdAt: application.applied_at,
    reviewed_at: application.reviewed_at || "",
    approved_worker_id: application.approved_worker_id || ""
  };
}

export function registerWorkerHiringRoutes(app: Express, options: RegisterWorkerHiringOptions): void {
  app.post("/api/worker-applications", async (req: Request, res: Response) => {
    try {
      const fullName = readTrimmedString((req.body as { fullName?: unknown }).fullName);
      const phone = normalizePhone((req.body as { phone?: unknown }).phone);
      const email = readTrimmedString((req.body as { email?: unknown }).email).toLowerCase();
      const address = readTrimmedString((req.body as { address?: unknown }).address);
      const categoryApplied = readTrimmedString((req.body as { categoryApplied?: unknown }).categoryApplied);
      const idProof = (req.body as { idProof?: unknown }).idProof;
      const addressProof = (req.body as { addressProof?: unknown }).addressProof;

      if (!fullName || !phone || !email || !address || !categoryApplied || !idProof || !addressProof) {
        return res.status(400).json({ message: "All fields are required." });
      }
      if (phone.length < 10 || phone.length > 15) {
        return res.status(400).json({ message: "Enter a valid mobile number." });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Enter a valid email address." });
      }

      const [idProofPath, addressProofPath] = await Promise.all([
        persistDocument(idProof, "id-proof"),
        persistDocument(addressProof, "address-proof")
      ]);

      const now = new Date().toISOString();
      const payload: Omit<WorkerApplicationRecord, "id"> = {
        full_name: fullName,
        phone,
        email,
        address,
        category_applied: categoryApplied,
        id_proof_url: idProofPath,
        address_proof_url: addressProofPath,
        status: "Under Review",
        admin_notes: "",
        applied_at: now
      };

      let applicationId = "";
      try {
        const reference = await db.collection("worker_applications").add(payload);
        applicationId = reference.id;
      } catch (error) {
        if (!isFirestoreUnavailableError(error)) {
          throw error;
        }
        applicationId = `APP-${Date.now()}-${crypto.randomInt(1000, 9999)}`;
        inMemoryWorkerApplications.set(applicationId, { id: applicationId, ...payload });
      }

      await sendEmail(
        email,
        "Tasko Application Received",
        "Your application has been submitted successfully. Our team will contact you after verification."
      );

      return res.status(201).json({
        id: applicationId,
        status: "Under Review",
        message:
          "Your application has been submitted successfully. Our team will contact you after verification."
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to submit application", error: getErrorMessage(error) });
    }
  });

  app.get("/api/admin/worker-applications", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const applications = await listWorkerApplications();
      return res.json(applications.map((application) => toApplicationResponse(req, sessionToken, application)));
    } catch (error) {
      return res.status(500).json({ message: "Failed to load worker applications", error: getErrorMessage(error) });
    }
  });

  app.get("/api/admin/categories", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const categories = await listCategories();
      const subcategories = await listSubcategories();
      const subcategoryCountByCategory = new Map<string, number>();
      subcategories.forEach((subcategory) => {
        subcategoryCountByCategory.set(
          subcategory.categoryId,
          (subcategoryCountByCategory.get(subcategory.categoryId) || 0) + 1
        );
      });
      return res.json({
        categories: categories.map((category) =>
          toCategoryResponse(category, subcategoryCountByCategory.get(category.id) || 0)
        )
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to load categories", error: getErrorMessage(error) });
    }
  });

  app.post("/api/admin/categories", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const name = normalizeCategoryName((req.body as { name?: unknown }).name);
      if (!name) {
        return res.status(400).json({ message: "Category name is required." });
      }

      const { category, created } = await createCategory(name);
      if (!created || !category) {
        return res.status(409).json({ message: "Category already exists." });
      }

      return res.status(201).json({
        message: "Category added successfully.",
        category: toCategoryResponse(category, 0)
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to add category", error: getErrorMessage(error) });
    }
  });

  app.patch("/api/admin/categories/:categoryId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const categoryId = readTrimmedString(req.params.categoryId);
      if (!categoryId) {
        return res.status(400).json({ message: "categoryId is required." });
      }

      const name = normalizeCategoryName((req.body as { name?: unknown }).name);
      if (!name) {
        return res.status(400).json({ message: "Category name is required." });
      }

      const { category, updated } = await updateCategory(categoryId, name);
      if (!updated || !category) {
        const exists = await getCategoryById(categoryId);
        if (!exists) {
          return res.status(404).json({ message: "Category not found." });
        }
        return res.status(409).json({ message: "Category name already exists." });
      }

      const subcategories = await listSubcategories(categoryId);
      return res.json({
        message: "Category updated successfully.",
        category: toCategoryResponse(category, subcategories.length)
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update category", error: getErrorMessage(error) });
    }
  });

  app.delete("/api/admin/categories/:categoryId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const categoryId = readTrimmedString(req.params.categoryId);
      if (!categoryId) {
        return res.status(400).json({ message: "categoryId is required." });
      }

      const { deleted, deletedSubcategoryCount } = await deleteCategory(categoryId);
      if (!deleted) {
        return res.status(404).json({ message: "Category not found." });
      }

      return res.json({
        message: "Category deleted successfully.",
        deletedSubcategoryCount
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete category", error: getErrorMessage(error) });
    }
  });

  app.get("/api/admin/categories/:categoryId/subcategories", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const categoryId = readTrimmedString(req.params.categoryId);
      if (!categoryId) {
        return res.status(400).json({ message: "categoryId is required." });
      }

      const category = await getCategoryById(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found." });
      }

      const subcategories = await listSubcategories(categoryId);
      return res.json({
        category: toCategoryResponse(category, subcategories.length),
        subcategories: subcategories.map((subcategory) => toSubcategoryResponse(subcategory))
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to load subcategories", error: getErrorMessage(error) });
    }
  });

  app.post("/api/admin/categories/:categoryId/subcategories", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const categoryId = readTrimmedString(req.params.categoryId);
      if (!categoryId) {
        return res.status(400).json({ message: "categoryId is required." });
      }

      const name = normalizeCategoryName((req.body as { name?: unknown }).name);
      if (!name) {
        return res.status(400).json({ message: "Subcategory name is required." });
      }

      const { subcategory, created } = await createSubcategory(categoryId, name);
      if (!created || !subcategory) {
        const category = await getCategoryById(categoryId);
        if (!category) {
          return res.status(404).json({ message: "Category not found." });
        }
        return res.status(409).json({ message: "Subcategory name already exists in this category." });
      }

      return res.status(201).json({
        message: "Subcategory added successfully.",
        subcategory: toSubcategoryResponse(subcategory)
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to add subcategory", error: getErrorMessage(error) });
    }
  });

  app.patch("/api/admin/categories/:categoryId/subcategories/:subcategoryId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const categoryId = readTrimmedString(req.params.categoryId);
      const subcategoryId = readTrimmedString(req.params.subcategoryId);
      if (!categoryId || !subcategoryId) {
        return res.status(400).json({ message: "categoryId and subcategoryId are required." });
      }

      const name = normalizeCategoryName((req.body as { name?: unknown }).name);
      if (!name) {
        return res.status(400).json({ message: "Subcategory name is required." });
      }

      const { subcategory, updated } = await updateSubcategory(categoryId, subcategoryId, name);
      if (!updated || !subcategory) {
        const category = await getCategoryById(categoryId);
        if (!category) {
          return res.status(404).json({ message: "Category not found." });
        }
        const existingSubcategory = await getSubcategoryById(subcategoryId);
        if (!existingSubcategory || existingSubcategory.categoryId !== categoryId) {
          return res.status(404).json({ message: "Subcategory not found." });
        }
        return res.status(409).json({ message: "Subcategory name already exists in this category." });
      }

      return res.json({
        message: "Subcategory updated successfully.",
        subcategory: toSubcategoryResponse(subcategory)
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update subcategory", error: getErrorMessage(error) });
    }
  });

  app.delete("/api/admin/categories/:categoryId/subcategories/:subcategoryId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const categoryId = readTrimmedString(req.params.categoryId);
      const subcategoryId = readTrimmedString(req.params.subcategoryId);
      if (!categoryId || !subcategoryId) {
        return res.status(400).json({ message: "categoryId and subcategoryId are required." });
      }

      const { deleted } = await deleteSubcategory(categoryId, subcategoryId);
      if (!deleted) {
        return res.status(404).json({ message: "Subcategory not found." });
      }

      return res.json({ message: "Subcategory deleted successfully." });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete subcategory", error: getErrorMessage(error) });
    }
  });

  app.get("/api/admin/worker-applications/:applicationId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const applicationId = readTrimmedString(req.params.applicationId);
      if (!applicationId) {
        return res.status(400).json({ message: "applicationId is required" });
      }

      const application = await getWorkerApplicationById(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      return res.json(toApplicationResponse(req, sessionToken, application));
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch application", error: getErrorMessage(error) });
    }
  });

  app.patch("/api/admin/worker-applications/:applicationId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const applicationId = readTrimmedString(req.params.applicationId);
      if (!applicationId) {
        return res.status(400).json({ message: "applicationId is required" });
      }

      const status = readTrimmedString((req.body as { status?: unknown }).status);
      const adminNotes = readTrimmedString((req.body as { adminNotes?: unknown }).adminNotes);
      if (status && !isValidWorkerApplicationStatus(status)) {
        return res.status(400).json({ message: "Invalid application status" });
      }

      const updatedApplication = await updateWorkerApplication(applicationId, {
        status: status ? (status as WorkerApplicationStatus) : undefined,
        admin_notes: adminNotes || undefined,
        reviewed_at: new Date().toISOString()
      });

      if (!updatedApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      return res.json({
        message: "Application updated",
        application: toApplicationResponse(req, sessionToken, updatedApplication)
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update application", error: getErrorMessage(error) });
    }
  });

  app.post("/api/admin/worker-applications/:applicationId/approve-create-account", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const applicationId = readTrimmedString(req.params.applicationId);
      if (!applicationId) {
        return res.status(400).json({ message: "applicationId is required" });
      }

      const application = await getWorkerApplicationById(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.status === "Rejected") {
        return res.status(400).json({ message: "Rejected applications cannot be approved." });
      }

      if (application.approved_worker_id) {
        return res.status(409).json({
          message: "Worker account already created for this application.",
          workerId: application.approved_worker_id
        });
      }

      const allWorkers = await listWorkers();
      if (allWorkers.some((worker) => worker.email === application.email || worker.phone === application.phone)) {
        return res.status(409).json({ message: "A worker account already exists with this phone or email." });
      }

      const workerId = normalizeWorkerId((req.body as { workerId?: unknown }).workerId);
      const accountPassword = readTrimmedString((req.body as { password?: unknown }).password);
      if (!workerId) {
        return res.status(400).json({ message: "workerId is required." });
      }
      if (!isValidWorkerId(workerId)) {
        return res
          .status(400)
          .json({ message: "workerId must be 4-32 characters (A-Z, 0-9, _ or -)." });
      }
      if (!accountPassword) {
        return res.status(400).json({ message: "password is required." });
      }
      if (accountPassword.length < 6) {
        return res.status(400).json({ message: "password must be at least 6 characters long." });
      }
      if (
        inMemoryWorkers.has(workerId) ||
        allWorkers.some((worker) => worker.worker_id.toUpperCase() === workerId)
      ) {
        return res.status(409).json({ message: "This workerId is already in use." });
      }

      const passwordHash = hashPassword(accountPassword);
      const now = new Date().toISOString();
      const salary = Number.isFinite(Number((req.body as { salary?: unknown }).salary))
        ? Math.max(0, Number((req.body as { salary?: unknown }).salary))
        : 18000;
      const workerPayload: WorkerRecord = {
        worker_id: workerId.toUpperCase(),
        full_name: application.full_name,
        phone: application.phone,
        email: application.email,
        category: application.category_applied,
        salary,
        password_hash: passwordHash,
        status: "Active",
        joining_date: now.slice(0, 10),
        created_at: now,
        updated_at: now,
        online: false,
        rating: 0
      };

      try {
        await db.collection("workers").doc(workerId).create(workerPayload);
      } catch (error) {
        if (isAlreadyExistsError(error)) {
          return res.status(409).json({ message: "This workerId is already in use." });
        }
        if (!isFirestoreUnavailableError(error)) {
          throw error;
        }
      }
      inMemoryWorkers.set(workerId, workerPayload);

      const adminNotes = readTrimmedString((req.body as { adminNotes?: unknown }).adminNotes);
      const updatedApplication = await updateWorkerApplication(applicationId, {
        status: "Account Created",
        admin_notes: adminNotes || application.admin_notes,
        reviewed_at: now,
        approved_worker_id: workerId
      });

      const workerLoginLink = process.env.WORKER_LOGIN_URL || "http://localhost:3001/login";
      await sendEmail(
        application.email,
        "Tasko Worker Account Activated",
        `Employee ID: ${workerId}\nPassword: ${accountPassword}\nLogin: ${workerLoginLink}`
      );

      return res.status(201).json({
        message: "Worker account created successfully.",
        workerId,
        application: updatedApplication ? toApplicationResponse(req, sessionToken, updatedApplication) : null
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve application", error: getErrorMessage(error) });
    }
  });

  app.get("/api/admin/worker-applications/:applicationId/documents/:documentType", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const applicationId = readTrimmedString(req.params.applicationId);
      const documentType = readTrimmedString(req.params.documentType);
      const application = await getWorkerApplicationById(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const storedRelativePath =
        documentType === "id-proof"
          ? application.id_proof_url
          : documentType === "address-proof"
            ? application.address_proof_url
            : "";
      if (!storedRelativePath) {
        return res.status(404).json({ message: "Document not found" });
      }

      const absolutePath = path.resolve(uploadsRoot, storedRelativePath);
      const normalizedUploadsRoot = path.resolve(uploadsRoot);
      if (!absolutePath.startsWith(normalizedUploadsRoot)) {
        return res.status(400).json({ message: "Invalid document path" });
      }
      await fs.access(absolutePath);
      return res.sendFile(absolutePath);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch document", error: getErrorMessage(error) });
    }
  });

  app.post("/api/workers/login", async (req: Request, res: Response) => {
    try {
      const identifier = readTrimmedString((req.body as { identifier?: unknown }).identifier);
      const password = readTrimmedString((req.body as { password?: unknown }).password);
      if (!identifier || !password) {
        return res.status(400).json({ message: "identifier and password are required" });
      }

      const workerIdIdentifier = identifier.toUpperCase();
      const phoneIdentifier = normalizePhone(identifier);
      let worker: WorkerRecord | null = null;
      try {
        const [byDocId, byWorkerIdExact, byWorkerIdUpper, byPhone] = await Promise.all([
          db.collection("workers").doc(identifier).get(),
          db.collection("workers").where("worker_id", "==", identifier).limit(1).get(),
          db.collection("workers").where("worker_id", "==", workerIdIdentifier).limit(1).get(),
          phoneIdentifier
            ? db.collection("workers").where("phone", "==", phoneIdentifier).limit(1).get()
            : Promise.resolve(null)
        ]);

        if (byDocId.exists) {
          worker = normalizeWorkerRecord(byDocId.id, byDocId.data() || {});
        } else if (!byWorkerIdExact.empty) {
          worker = normalizeWorkerRecord(byWorkerIdExact.docs[0].id, byWorkerIdExact.docs[0].data());
        } else if (!byWorkerIdUpper.empty) {
          worker = normalizeWorkerRecord(byWorkerIdUpper.docs[0].id, byWorkerIdUpper.docs[0].data());
        } else if (byPhone && !byPhone.empty) {
          worker = normalizeWorkerRecord(byPhone.docs[0].id, byPhone.docs[0].data());
        }
      } catch (error) {
        if (!isFirestoreUnavailableError(error)) {
          throw error;
        }
      }

      if (!worker) {
        worker =
          inMemoryWorkers.get(identifier) ||
          inMemoryWorkers.get(workerIdIdentifier) ||
          Array.from(inMemoryWorkers.values()).find(
            (record) =>
              record.phone === phoneIdentifier ||
              record.worker_id.toUpperCase() === workerIdIdentifier
          ) ||
          null;
      }
      if (!worker || !verifyPassword(password, worker.password_hash)) {
        return res.status(401).json({ message: "Invalid worker credentials." });
      }
      if (worker.status !== "Active") {
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }

      const sessionToken = createWorkerSession(worker.worker_id);
      return res.json({
        sessionToken,
        worker: {
          workerId: worker.worker_id,
          fullName: worker.full_name,
          phone: worker.phone,
          email: worker.email,
          category: worker.category,
          status: worker.status
        }
      });
    } catch (error) {
      return res.status(500).json({ message: "Worker login failed", error: getErrorMessage(error) });
    }
  });

  app.post("/api/workers/session/validate", async (req: Request, res: Response) => {
    try {
      const sessionToken = getWorkerSessionToken(req);
      if (!sessionToken) {
        return res.status(400).json({ message: "sessionToken is required" });
      }

      const workerId = resolveWorkerSession(sessionToken);
      if (!workerId) {
        return res.status(401).json({ message: "Worker session is invalid or expired" });
      }

      const worker = await getWorkerById(workerId);
      if (!worker || worker.status !== "Active") {
        clearWorkerSession(sessionToken);
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }

      return res.json({
        valid: true,
        worker: {
          workerId: worker.worker_id,
          fullName: worker.full_name,
          phone: worker.phone,
          email: worker.email,
          category: worker.category,
          status: worker.status
        }
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to validate worker session", error: getErrorMessage(error) });
    }
  });

  app.post("/api/workers/logout", (req: Request, res: Response) => {
    const sessionToken = getWorkerSessionToken(req);
    if (sessionToken) {
      clearWorkerSession(sessionToken);
    }
    return res.json({ message: "Logged out" });
  });

  app.get("/api/workers/me", async (req: Request, res: Response) => {
    try {
      const sessionToken = getWorkerSessionToken(req);
      if (!sessionToken) {
        return res.status(401).json({ message: "Worker session token is required" });
      }

      const workerId = resolveWorkerSession(sessionToken);
      if (!workerId) {
        return res.status(401).json({ message: "Worker session is invalid or expired" });
      }

      const worker = await getWorkerById(workerId);
      if (!worker) {
        return res.status(404).json({ message: "Worker not found" });
      }
      if (worker.status !== "Active") {
        clearWorkerSession(sessionToken);
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }

      return res.json(toWorkerResponse(worker));
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch worker profile", error: getErrorMessage(error) });
    }
  });

  app.get("/api/workers/my-jobs", async (req: Request, res: Response) => {
    try {
      const sessionToken = getWorkerSessionToken(req);
      if (!sessionToken) {
        return res.status(401).json({ message: "Worker session token is required" });
      }

      const workerId = resolveWorkerSession(sessionToken);
      if (!workerId) {
        return res.status(401).json({ message: "Worker session is invalid or expired" });
      }

      const snapshot = await db.collection("bookings").where("assignedWorkerId", "==", workerId).get();
      const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.json(jobs);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch assigned jobs", error: getErrorMessage(error) });
    }
  });

  app.patch("/api/workers/me/status", async (req: Request, res: Response) => {
    try {
      const sessionToken = getWorkerSessionToken(req);
      if (!sessionToken) {
        return res.status(401).json({ message: "Worker session token is required" });
      }

      const workerId = resolveWorkerSession(sessionToken);
      if (!workerId) {
        return res.status(401).json({ message: "Worker session is invalid or expired" });
      }

      const online = (req.body as { online?: unknown }).online;
      if (typeof online !== "boolean") {
        return res.status(400).json({ message: "online must be a boolean" });
      }

      const worker = await getWorkerById(workerId);
      if (!worker) {
        return res.status(404).json({ message: "Worker not found" });
      }

      const updatedAt = new Date().toISOString();
      try {
        await db.collection("workers").doc(worker.worker_id).set(
          {
            online,
            updated_at: updatedAt
          },
          { merge: true }
        );
      } catch (error) {
        if (!isFirestoreUnavailableError(error)) {
          throw error;
        }
      }

      inMemoryWorkers.set(worker.worker_id, { ...worker, online, updated_at: updatedAt });
      return res.json({ message: "Worker availability updated" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update worker status", error: getErrorMessage(error) });
    }
  });

  app.get("/api/admin/worker-requests", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const applications = await listWorkerApplications();
      const pending = applications
        .filter((application) => application.status === "Under Review")
        .map((application) => ({
          id: application.id,
          name: application.full_name,
          phone: application.phone,
          category: application.category_applied,
          address: application.address,
          status: application.status,
          createdAt: application.applied_at
        }));

      return res.json(pending);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch worker requests", error: getErrorMessage(error) });
    }
  });
}
