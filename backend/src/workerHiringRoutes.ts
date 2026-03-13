import bcrypt from "bcrypt";
import crypto from "crypto";
import fs from "fs/promises";
import { Express, Request, Response } from "express";
import { Query } from "firebase-admin/firestore";
import path from "path";
import { auth as adminAuth, db, timestamp } from "./firebaseAdmin";
import {
  PricingConfiguration,
  PricingModel,
  calculateStartingPrice,
  getSuggestedPricingDefinition,
  normalizePricingConfiguration,
  normalizePricingModel,
  validatePricingModelPayload
} from "./pricingModels";
import {
  isWorkerApplicationStatusNotifiable,
  sendEmail,
  sendPasswordResetEmail,
  sendWorkerApplicationStatusEmail
} from "./services/mailService";
import { issuePasswordResetToken, markPasswordResetTokenUsed, validatePasswordResetToken } from "./services/passwordResetService";

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

export type WorkerRecord = {
  worker_id: string;
  full_name: string;
  phone: string;
  email: string;
  category: string;
  salary: number;
  password_hash: string;
  firebase_uid?: string;
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
  pricingModel: PricingModel;
  pricingConfig: PricingConfiguration;
};

type ServiceCatalogEntry = {
  category: CategoryRecord;
  subcategory: SubcategoryRecord;
};

type RegisterWorkerHiringOptions = {
  validateAdminSession: (token: string) => boolean;
  clearBookingCache?: () => void;
};

const inMemoryWorkerApplications = new Map<string, WorkerApplicationRecord>();
const inMemoryWorkers = new Map<string, WorkerRecord>();
const inMemoryCategories = new Map<string, CategoryRecord>();
const inMemorySubcategories = new Map<string, SubcategoryRecord>();
const workerReadCacheTtlMs = Math.max(10000, Number(process.env.WORKER_READ_CACHE_MS || 60000));
const workerProfileCache = new Map<string, { expiresAt: number; value: WorkerRecord }>();
const workerJobsCache = new Map<string, { expiresAt: number; value: Array<Record<string, unknown>> }>();
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

function readPositiveIntQuery(value: unknown, fallback: number, max = 100): number {
  const parsed = Number(readTrimmedString(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.trunc(parsed));
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

function maskEmailAddress(email: string): string {
  const normalizedEmail = readTrimmedString(email).toLowerCase();
  const [localPart, domain] = normalizedEmail.split("@");
  if (!localPart || !domain) {
    return normalizedEmail;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || ""}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function getBaseUrl(envValue: string | undefined, fallback: string): string {
  const normalized = readTrimmedString(envValue);
  if (!normalized) {
    return fallback;
  }

  return normalized.replace(/\/+$/, "");
}

function getWorkerAppBaseUrl(): string {
  return getBaseUrl(process.env.TASKO_WORKER_APP_URL || process.env.WORKER_APP_URL, "http://localhost:3001");
}

function generateNumericOtp(length = 4): string {
  const min = 10 ** Math.max(0, length - 1);
  const max = 10 ** Math.max(1, length);
  return String(crypto.randomInt(min, max));
}

function getWorkerProfileFromCache(workerId: string): WorkerRecord | null {
  const cached = workerProfileCache.get(workerId);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    workerProfileCache.delete(workerId);
    return null;
  }
  return cached.value;
}

function setWorkerProfileCache(workerId: string, value: WorkerRecord): void {
  workerProfileCache.set(workerId, {
    value,
    expiresAt: Date.now() + workerReadCacheTtlMs
  });
}

function getWorkerJobsFromCache(workerId: string): Array<Record<string, unknown>> | null {
  const cached = workerJobsCache.get(workerId);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    workerJobsCache.delete(workerId);
    return null;
  }
  return cached.value;
}

function setWorkerJobsCache(workerId: string, value: Array<Record<string, unknown>>): void {
  workerJobsCache.set(workerId, {
    value,
    expiresAt: Date.now() + workerReadCacheTtlMs
  });
}

function clearWorkerJobsCache(workerId: string): void {
  workerJobsCache.delete(workerId);
}

function uniqueNonEmptyStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = readTrimmedString(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function normalizeWorkerJobRecord(
  bookingId: string,
  data: Record<string, unknown>,
  userData?: Record<string, unknown> | null
): Record<string, unknown> {
  const normalizedBookingId =
    readTrimmedString(data.booking_id) || readTrimmedString(data.bookingId) || readTrimmedString(data.id) || bookingId;
  const normalizedUserId = readTrimmedString(data.userId) || readTrimmedString(data.user_id);
  const normalizedUserName =
    readTrimmedString(data.userName) ||
    readTrimmedString(data.user_name) ||
    readTrimmedString(userData?.name) ||
    readTrimmedString(userData?.full_name) ||
    readTrimmedString(userData?.fullName);
  const normalizedUserPhone =
    readTrimmedString(data.userPhone) ||
    readTrimmedString(data.user_phone) ||
    readTrimmedString(userData?.mobile) ||
    readTrimmedString(userData?.number) ||
    readTrimmedString(userData?.phone);
  const normalizedAddress =
    readTrimmedString(data.address) ||
    readTrimmedString(data.serviceAddress) ||
    readTrimmedString(data.service_address) ||
    readTrimmedString(userData?.address);
  const normalizedUserEmail =
    readTrimmedString(data.userEmail) ||
    readTrimmedString(data.user_email) ||
    readTrimmedString(userData?.email) ||
    readTrimmedString(userData?.mail);

  return {
    id: bookingId,
    ...data,
    booking_id: normalizedBookingId,
    bookingId: normalizedBookingId,
    userId: normalizedUserId,
    user_id: normalizedUserId,
    userName: normalizedUserName,
    user_name: normalizedUserName,
    userPhone: normalizedUserPhone,
    user_phone: normalizedUserPhone,
    userEmail: normalizedUserEmail,
    user_email: normalizedUserEmail,
    address: normalizedAddress,
    serviceAddress: normalizedAddress,
    service_address: normalizedAddress
  };
}

function isFirestoreUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();
  const rawCode = (error as { code?: unknown })?.code;
  const code =
    typeof rawCode === "string"
      ? rawCode.toLowerCase()
      : typeof rawCode === "number"
        ? String(rawCode)
        : "";
  return (
    normalizedMessage.includes("5 not_found") ||
    normalizedMessage.includes("not_found") ||
    normalizedMessage.includes("7 permission_denied") ||
    normalizedMessage.includes("permission_denied") ||
    normalizedMessage.includes("8 resource_exhausted") ||
    normalizedMessage.includes("resource_exhausted") ||
    normalizedMessage.includes("quota exceeded") ||
    normalizedMessage.includes("missing or insufficient permissions") ||
    normalizedMessage.includes("the caller does not have permission") ||
    (normalizedMessage.includes("database") && normalizedMessage.includes("does not exist")) ||
    normalizedMessage.includes("14 unavailable") ||
    normalizedMessage.includes("deadline exceeded") ||
    code.includes("not-found") ||
    code.includes("permission-denied") ||
    code.includes("resource-exhausted") ||
    code === "5" ||
    code === "7" ||
    code === "8" ||
    code === "14"
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

function parseWorkerApplicationStatus(value: unknown): WorkerApplicationStatus | null {
  const normalized = readTrimmedString(value).toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (!normalized) return null;
  if (normalized === "under review") return "Under Review";
  if (normalized === "visit required") return "Visit Required";
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "account created") return "Account Created";
  return null;
}

function normalizeWorkerStatus(value: unknown): WorkerStatus {
  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "suspended") return "Suspended";
  if (normalized === "terminated") return "Terminated";
  return "Active";
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

export function getWorkerSessionToken(req: Request): string {
  const authorizationHeader = readTrimmedString(req.header("authorization"));
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  return readTrimmedString((req.body as { idToken?: unknown; sessionToken?: unknown })?.idToken);
}

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    try {
      return bcrypt.compareSync(password, storedHash);
    } catch {
      return false;
    }
  }

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
  return /^[A-Z0-9@_-]{4,32}$/.test(workerId);
}

function buildAutoWorkerId(sequenceNumber: number): string {
  return `TASKO@${String(sequenceNumber).padStart(3, "0")}`;
}

function generateWorkerPassword(phone: string): string {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 4) {
    throw new Error("Worker phone number must contain at least 4 digits.");
  }
  return `Tasko@${normalizedPhone.slice(0, 4)}`;
}

function getUsedWorkerIds(workers: WorkerRecord[]): Set<string> {
  const usedIds = new Set<string>();

  workers.forEach((worker) => {
    const workerId = normalizeWorkerId(worker.worker_id);
    if (workerId) {
      usedIds.add(workerId);
    }
  });

  inMemoryWorkers.forEach((worker) => {
    const workerId = normalizeWorkerId(worker.worker_id);
    if (workerId) {
      usedIds.add(workerId);
    }
  });

  return usedIds;
}

function generateNextWorkerId(workers: WorkerRecord[]): string {
  const usedWorkerIds = getUsedWorkerIds(workers);
  let nextSequence = workers.length + 1;
  let nextWorkerId = buildAutoWorkerId(nextSequence);

  while (usedWorkerIds.has(nextWorkerId)) {
    nextSequence += 1;
    nextWorkerId = buildAutoWorkerId(nextSequence);
  }

  return nextWorkerId;
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
    firebase_uid: readTrimmedString(data.firebase_uid) || undefined,
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

async function persistWorkerFirebaseUid(worker: WorkerRecord, firebaseUid: string): Promise<WorkerRecord> {
  const updatedAt = new Date().toISOString();
  const nextWorker = {
    ...worker,
    firebase_uid: firebaseUid,
    updated_at: updatedAt
  };

  try {
    await db.collection("workers").doc(worker.worker_id).set(
      {
        firebase_uid: firebaseUid,
        updated_at: updatedAt
      },
      { merge: true }
    );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryWorkers.set(worker.worker_id, nextWorker);
  setWorkerProfileCache(worker.worker_id, nextWorker);
  return nextWorker;
}

async function syncWorkerRoleRecord(worker: WorkerRecord, firebaseUid: string): Promise<void> {
  const now = new Date().toISOString();

  try {
    await db.collection("users").doc(firebaseUid).set(
      {
        uid: firebaseUid,
        email: worker.email,
        name: worker.full_name,
        role: "worker",
        workerId: worker.worker_id,
        workerStatus: worker.status,
        updatedAt: now
      },
      { merge: true }
    );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
}

async function findWorkerByFirebaseUid(firebaseUid: string): Promise<WorkerRecord | null> {
  const normalizedUid = readTrimmedString(firebaseUid);
  if (!normalizedUid) {
    return null;
  }

  const memoryMatch =
    Array.from(inMemoryWorkers.values()).find((worker) => worker.firebase_uid === normalizedUid) || null;
  if (memoryMatch) {
    return memoryMatch;
  }

  try {
    const snapshot = await db.collection("workers").where("firebase_uid", "==", normalizedUid).limit(1).get();
    if (!snapshot.empty) {
      const worker = normalizeWorkerRecord(snapshot.docs[0].id, snapshot.docs[0].data());
      inMemoryWorkers.set(worker.worker_id, worker);
      setWorkerProfileCache(worker.worker_id, worker);
      return worker;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return null;
}

async function findWorkerByEmail(email: string): Promise<WorkerRecord | null> {
  const normalizedEmail = readTrimmedString(email).toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const memoryMatch =
    Array.from(inMemoryWorkers.values()).find((worker) => worker.email === normalizedEmail) || null;
  if (memoryMatch) {
    return memoryMatch;
  }

  try {
    const snapshot = await db.collection("workers").where("email", "==", normalizedEmail).limit(1).get();
    if (!snapshot.empty) {
      const worker = normalizeWorkerRecord(snapshot.docs[0].id, snapshot.docs[0].data());
      inMemoryWorkers.set(worker.worker_id, worker);
      setWorkerProfileCache(worker.worker_id, worker);
      return worker;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  const allWorkers = await listWorkers();
  return allWorkers.find((worker) => worker.email === normalizedEmail) || null;
}

async function findWorkerByPhone(phone: string): Promise<WorkerRecord | null> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const memoryMatch =
    Array.from(inMemoryWorkers.values()).find((worker) => worker.phone === normalizedPhone) || null;
  if (memoryMatch) {
    return memoryMatch;
  }

  try {
    const snapshot = await db.collection("workers").where("phone", "==", normalizedPhone).limit(1).get();
    if (!snapshot.empty) {
      const worker = normalizeWorkerRecord(snapshot.docs[0].id, snapshot.docs[0].data());
      inMemoryWorkers.set(worker.worker_id, worker);
      setWorkerProfileCache(worker.worker_id, worker);
      return worker;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  const allWorkers = await listWorkers();
  return allWorkers.find((worker) => worker.phone === normalizedPhone) || null;
}

async function findWorkerByLoginIdentifier(identifier: string): Promise<WorkerRecord | null> {
  const normalizedIdentifier = readTrimmedString(identifier);
  if (!normalizedIdentifier) {
    return null;
  }

  if (isValidEmail(normalizedIdentifier)) {
    return findWorkerByEmail(normalizedIdentifier);
  }

  const normalizedWorkerId = normalizedIdentifier.toUpperCase();
  const byId = await getWorkerById(normalizedWorkerId);
  if (byId) {
    return byId;
  }

  const normalizedPhone = normalizePhone(normalizedIdentifier);
  if (normalizedPhone) {
    const byPhone = await findWorkerByPhone(normalizedPhone);
    if (byPhone) {
      return byPhone;
    }
  }

  return findWorkerByEmail(normalizedIdentifier);
}

async function ensureWorkerFirebaseAccount(
  worker: WorkerRecord,
  initialPassword: string = generateWorkerPassword(worker.phone)
): Promise<{ uid: string; email: string; worker: WorkerRecord }> {
  const normalizedEmail = readTrimmedString(worker.email).toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Worker account is missing a login email.");
  }

  let authUser = null;

  if (worker.firebase_uid) {
    try {
      authUser = await adminAuth.getUser(worker.firebase_uid);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "auth/user-not-found") {
        throw error;
      }
    }
  }

  if (!authUser) {
    try {
      authUser = await adminAuth.getUserByEmail(normalizedEmail);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "auth/user-not-found") {
        throw error;
      }
    }
  }

  if (!authUser) {
    try {
      authUser = await adminAuth.createUser({
        email: normalizedEmail,
        password: initialPassword,
        displayName: worker.full_name || worker.worker_id,
        disabled: worker.status !== "Active"
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "auth/email-already-exists") {
        throw error;
      }
      authUser = await adminAuth.getUserByEmail(normalizedEmail);
    }
  } else {
    authUser = await adminAuth.updateUser(authUser.uid, {
      email: normalizedEmail,
      displayName: worker.full_name || worker.worker_id,
      disabled: worker.status !== "Active"
    });
  }

  let syncedWorker = worker;
  if (syncedWorker.firebase_uid !== authUser.uid) {
    syncedWorker = await persistWorkerFirebaseUid(worker, authUser.uid);
  }

  await syncWorkerRoleRecord(syncedWorker, authUser.uid);

  return {
    uid: authUser.uid,
    email: normalizedEmail,
    worker: syncedWorker
  };
}

async function setWorkerFirebasePassword(worker: WorkerRecord, password: string): Promise<{ uid: string; email: string; worker: WorkerRecord }> {
  const firebaseAccount = await ensureWorkerFirebaseAccount(worker, password);
  await adminAuth.updateUser(firebaseAccount.uid, {
    password,
    disabled: firebaseAccount.worker.status !== "Active"
  });

  return firebaseAccount;
}

async function resolveWorkerFromFirebaseToken(idToken: string): Promise<WorkerRecord | null> {
  const normalizedToken = readTrimmedString(idToken);
  if (!normalizedToken) {
    return null;
  }

  const decoded = await adminAuth.verifyIdToken(normalizedToken);
  let worker = await findWorkerByFirebaseUid(decoded.uid);

  if (!worker && decoded.email) {
    worker = await findWorkerByEmail(decoded.email);
  }

  if (!worker) {
    return null;
  }

  if (!worker.firebase_uid || worker.firebase_uid !== decoded.uid) {
    worker = await persistWorkerFirebaseUid(worker, decoded.uid);
  }

  await syncWorkerRoleRecord(worker, decoded.uid);
  return worker;
}

export async function resolveAuthenticatedWorker(req: Request): Promise<WorkerRecord | null> {
  const idToken = getWorkerSessionToken(req);
  if (!idToken) {
    return null;
  }

  return resolveWorkerFromFirebaseToken(idToken);
}

export async function resolveAuthenticatedWorkerId(req: Request): Promise<string | null> {
  const worker = await resolveAuthenticatedWorker(req);
  return worker?.worker_id || null;
}

async function syncExistingWorkersToFirebase(): Promise<void> {
  const workers = await listWorkers();
  for (const worker of workers) {
    if (!worker.email) {
      continue;
    }

    try {
      await ensureWorkerFirebaseAccount(worker);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to sync Firebase worker account for ${worker.worker_id}: ${getErrorMessage(error)}`);
    }
  }
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

async function resolveWorkerApplicationForStatusUpdate(
  workerIdentifier: string
): Promise<WorkerApplicationRecord | null> {
  const normalizedIdentifier = readTrimmedString(workerIdentifier);
  if (!normalizedIdentifier) {
    return null;
  }

  const byApplicationId = await getWorkerApplicationById(normalizedIdentifier);
  if (byApplicationId) {
    return byApplicationId;
  }

  const allApplications = await listWorkerApplications();
  const normalizedWorkerId = normalizedIdentifier.toUpperCase();
  return (
    allApplications.find(
      (application) => readTrimmedString(application.approved_worker_id).toUpperCase() === normalizedWorkerId
    ) || null
  );
}

async function listWorkerApplications(limit?: number): Promise<WorkerApplicationRecord[]> {
  try {
    let query: Query = db.collection("worker_applications").orderBy("applied_at", "desc");
    if (typeof limit === "number" && limit > 0) {
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((document) => normalizeWorkerApplicationRecord(document.id, document.data()));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  const fallbackRows = Array.from(inMemoryWorkerApplications.values()).sort(
    (left, right) => new Date(right.applied_at).getTime() - new Date(left.applied_at).getTime()
  );
  if (typeof limit === "number" && limit > 0) {
    return fallbackRows.slice(0, limit);
  }
  return fallbackRows;
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

async function deleteWorkerApplication(
  applicationId: string
): Promise<{ deleted: boolean; application: WorkerApplicationRecord | null }> {
  const current = await getWorkerApplicationById(applicationId);
  if (!current) {
    return { deleted: false, application: null };
  }

  try {
    await db.collection("worker_applications").doc(applicationId).delete();
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryWorkerApplications.delete(applicationId);
  return { deleted: true, application: current };
}

async function deleteWorkerDocument(storedRelativePath: string): Promise<void> {
  const relative = readTrimmedString(storedRelativePath);
  if (!relative) return;

  const absolutePath = path.resolve(uploadsRoot, relative);
  const normalizedUploadsRoot = path.resolve(uploadsRoot);
  if (!absolutePath.startsWith(normalizedUploadsRoot)) return;

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

async function getWorkerById(workerId: string): Promise<WorkerRecord | null> {
  const cachedRecord = getWorkerProfileFromCache(workerId);
  if (cachedRecord) {
    return cachedRecord;
  }

  const inMemoryRecord = inMemoryWorkers.get(workerId);
  if (inMemoryRecord) {
    setWorkerProfileCache(workerId, inMemoryRecord);
    return inMemoryRecord;
  }

  try {
    const document = await db.collection("workers").doc(workerId).get();
    if (document.exists) {
      const normalized = normalizeWorkerRecord(document.id, document.data() || {});
      inMemoryWorkers.set(workerId, normalized);
      setWorkerProfileCache(workerId, normalized);
      return normalized;
    }

    const querySnapshot = await db.collection("workers").where("worker_id", "==", workerId).limit(1).get();
    if (!querySnapshot.empty) {
      const normalized = normalizeWorkerRecord(querySnapshot.docs[0].id, querySnapshot.docs[0].data());
      inMemoryWorkers.set(workerId, normalized);
      setWorkerProfileCache(workerId, normalized);
      return normalized;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
  return inMemoryRecord || null;
}

async function listWorkers(limit?: number): Promise<WorkerRecord[]> {
  try {
    let query: Query = db.collection("workers");
    if (typeof limit === "number" && limit > 0) {
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((document) => normalizeWorkerRecord(document.id, document.data()));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
  const fallbackRows = Array.from(inMemoryWorkers.values());
  if (typeof limit === "number" && limit > 0) {
    return fallbackRows.slice(0, limit);
  }
  return fallbackRows;
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
  const categoryId = readTrimmedString(data.categoryId) || readTrimmedString(data.category_id);
  const name = normalizeCategoryName(data.name);
  const categoryName =
    readTrimmedString(data.categoryName) ||
    readTrimmedString(data.category_name) ||
    inMemoryCategories.get(categoryId)?.name ||
    "";
  const suggested = getSuggestedPricingDefinition(categoryName, name);
  const pricingModel =
    normalizePricingModel(data.pricingModel) ||
    normalizePricingModel(data.pricing_model) ||
    suggested.pricingModel;
  const pricingConfig = normalizePricingConfiguration(data, pricingModel, name, categoryName);

  return {
    id: subcategoryId,
    categoryId,
    name,
    pricingModel,
    pricingConfig,
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
    pricingModel: subcategory.pricingModel,
    pricingConfig: subcategory.pricingConfig,
    startingPrice: calculateStartingPrice(subcategory.pricingModel, subcategory.pricingConfig),
    paymentFlow: subcategory.pricingModel === "inspection" ? "postpaid" : "prepaid",
    createdAt: subcategory.createdAt,
    updatedAt: subcategory.updatedAt
  };
}

function readIsoTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function compareRecordsForCanonicalKeep<
  T extends {
    id: string;
    createdAt: string;
    updatedAt: string;
  }
>(left: T, right: T): number {
  const createdDelta = readIsoTime(left.createdAt) - readIsoTime(right.createdAt);
  if (createdDelta !== 0) {
    return createdDelta;
  }

  const updatedDelta = readIsoTime(left.updatedAt) - readIsoTime(right.updatedAt);
  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return left.id.localeCompare(right.id);
}

function splitDuplicateSubcategories(records: SubcategoryRecord[]): {
  unique: SubcategoryRecord[];
  duplicates: SubcategoryRecord[];
} {
  const grouped = new Map<string, SubcategoryRecord[]>();
  records.forEach((record) => {
    const key = `${record.categoryId.toLowerCase()}::${record.name.toLowerCase()}`;
    const current = grouped.get(key) || [];
    current.push(record);
    grouped.set(key, current);
  });

  const unique: SubcategoryRecord[] = [];
  const duplicates: SubcategoryRecord[] = [];

  grouped.forEach((group) => {
    const sorted = [...group].sort(compareRecordsForCanonicalKeep);
    unique.push(sorted[0]);
    duplicates.push(...sorted.slice(1));
  });

  unique.sort((left, right) => left.name.localeCompare(right.name));
  return { unique, duplicates };
}

async function cleanupDuplicateSubcategories(records: SubcategoryRecord[]): Promise<SubcategoryRecord[]> {
  const { unique, duplicates } = splitDuplicateSubcategories(records);
  if (duplicates.length === 0) {
    return unique;
  }

  duplicates.forEach((record) => inMemorySubcategories.delete(record.id));
  unique.forEach((record) => inMemorySubcategories.set(record.id, record));

  try {
    await Promise.all(duplicates.map((record) => db.collection("subcategories").doc(record.id).delete()));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return unique;
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
      const pricing = getSuggestedPricingDefinition(category.name, normalizedName);
      const baseId = `sub-${category.id}-${toSlug(normalizedName)}`;
      recordsToSeed.push({
        id: baseId,
        categoryId: category.id,
        name: normalizedName,
        pricingModel: pricing.pricingModel,
        pricingConfig: pricing.pricingConfig,
        createdAt: now,
        updatedAt: now
      });
    });
  });

  if (recordsToSeed.length === 0) {
    return;
  }

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  try {
    await Promise.all(
      recordsToSeed.map((record) =>
        db.collection("subcategories").doc(record.id).set(
          {
            categoryId: record.categoryId,
            categoryName: categoryNameById.get(record.categoryId) || "",
            name: record.name,
            pricingModel: record.pricingModel,
            pricingConfig: record.pricingConfig,
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
    return await cleanupDuplicateSubcategories(subcategories);
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  const deduped = Array.from(inMemorySubcategories.values())
    .filter((record) => !categoryId || record.categoryId === categoryId)
    .sort((left, right) => left.name.localeCompare(right.name));
  return cleanupDuplicateSubcategories(deduped);
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
  payload: Record<string, unknown>
): Promise<{ subcategory: SubcategoryRecord | null; created: boolean }> {
  const normalizedName = normalizeCategoryName(payload.name);
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

  const { pricingModel, pricingConfig, error } = validatePricingModelPayload(
    payload,
    category.name,
    normalizedName
  );
  if (!pricingModel || !pricingConfig) {
    throw new Error(error || "Pricing details are required.");
  }

  const now = new Date().toISOString();
  const subcategoryId = `sub-${crypto.randomUUID()}`;
  const subcategory: SubcategoryRecord = {
    id: subcategoryId,
    categoryId,
    name: normalizedName,
    pricingModel,
    pricingConfig,
    createdAt: now,
    updatedAt: now
  };

  try {
    await db.collection("subcategories").doc(subcategoryId).set(
      {
        categoryId: subcategory.categoryId,
        categoryName: category.name,
        name: subcategory.name,
        pricingModel: subcategory.pricingModel,
        pricingConfig: subcategory.pricingConfig,
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
  payload: Record<string, unknown>
): Promise<{ subcategory: SubcategoryRecord | null; updated: boolean }> {
  const normalizedName = normalizeCategoryName(payload.name);
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

  const category = await getCategoryById(categoryId);
  if (!category) {
    return { subcategory: null, updated: false };
  }

  const { pricingModel, pricingConfig, error } = validatePricingModelPayload(
    payload,
    category.name,
    normalizedName
  );
  if (!pricingModel || !pricingConfig) {
    throw new Error(error || "Pricing details are required.");
  }

  const next: SubcategoryRecord = {
    ...current,
    name: normalizedName,
    pricingModel,
    pricingConfig,
    updatedAt: new Date().toISOString()
  };

  try {
    await db.collection("subcategories").doc(subcategoryId).set(
      {
        name: next.name,
        categoryName: category.name,
        pricingModel: next.pricingModel,
        pricingConfig: next.pricingConfig,
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

function namesMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export async function getServiceCatalogEntry(options: {
  categoryId?: string;
  subcategoryId?: string;
  categoryName?: string;
  subcategoryName?: string;
}): Promise<ServiceCatalogEntry | null> {
  const categoryId = readTrimmedString(options.categoryId);
  const subcategoryId = readTrimmedString(options.subcategoryId);
  const categoryName = normalizeCategoryName(options.categoryName);
  const subcategoryName = normalizeCategoryName(options.subcategoryName);

  if (subcategoryId) {
    const subcategory = await getSubcategoryById(subcategoryId);
    if (!subcategory) {
      return null;
    }
    const category = await getCategoryById(subcategory.categoryId);
    if (!category) {
      return null;
    }
    if (categoryId && category.id !== categoryId) {
      return null;
    }
    if (categoryName && !namesMatch(category.name, categoryName)) {
      return null;
    }
    if (subcategoryName && !namesMatch(subcategory.name, subcategoryName)) {
      return null;
    }
    return { category, subcategory };
  }

  let category: CategoryRecord | null = null;
  if (categoryId) {
    category = await getCategoryById(categoryId);
  } else if (categoryName) {
    const categories = await listCategories();
    category = categories.find((record) => namesMatch(record.name, categoryName)) || null;
  }

  if (!category) {
    return null;
  }

  if (!subcategoryName) {
    return null;
  }

  const subcategories = await listSubcategories(category.id);
  const subcategory =
    subcategories.find((record) => namesMatch(record.name, subcategoryName)) || null;
  if (!subcategory) {
    return null;
  }

  return { category, subcategory };
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
  void syncExistingWorkersToFirebase().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`Failed to sync existing workers to Firebase: ${getErrorMessage(error)}`);
  });

  const resolveWorkerLoginIdentifier = async (req: Request, res: Response) => {
    try {
      const identifier = readTrimmedString((req.body as { identifier?: unknown }).identifier);
      if (!identifier) {
        return res.status(400).json({ message: "identifier is required" });
      }

      const worker = await findWorkerByLoginIdentifier(identifier);
      if (!worker) {
        return res.status(404).json({ message: "Worker account not found." });
      }
      if (worker.status !== "Active") {
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }
      if (!worker.email) {
        return res.status(400).json({ message: "Worker account is missing a login email." });
      }

      const firebaseAccount = await ensureWorkerFirebaseAccount(worker);
      return res.json({
        email: firebaseAccount.email,
        workerId: firebaseAccount.worker.worker_id,
        firebaseUid: firebaseAccount.uid
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to resolve worker login", error: getErrorMessage(error) });
    }
  };

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
      const limit = readPositiveIntQuery(req.query.limit, 20, 100);
      const applications = await listWorkerApplications(limit);
      return res.json(applications.map((application) => toApplicationResponse(req, sessionToken, application)));
    } catch (error) {
      return res.status(500).json({ message: "Failed to load worker applications", error: getErrorMessage(error) });
    }
  });

  app.get("/api/service-catalog", async (_req: Request, res: Response) => {
    try {
      const categories = await listCategories();
      const subcategories = await listSubcategories();
      const subcategoriesByCategoryId = new Map<string, SubcategoryRecord[]>();
      subcategories.forEach((subcategory) => {
        const current = subcategoriesByCategoryId.get(subcategory.categoryId) || [];
        current.push(subcategory);
        subcategoriesByCategoryId.set(subcategory.categoryId, current);
      });

      return res.json({
        categories: categories.map((category) => {
          const categorySubcategories =
            (subcategoriesByCategoryId.get(category.id) || []).sort((left, right) =>
              left.name.localeCompare(right.name)
            );
          return {
            ...toCategoryResponse(category, categorySubcategories.length),
            subcategories: categorySubcategories.map((subcategory) => toSubcategoryResponse(subcategory))
          };
        })
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to load service catalog", error: getErrorMessage(error) });
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

      const payload = (req.body as Record<string, unknown>) || {};
      const name = normalizeCategoryName(payload.name);
      if (!name) {
        return res.status(400).json({ message: "Subcategory name is required." });
      }

      const { subcategory, created } = await createSubcategory(categoryId, payload);
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

      const payload = (req.body as Record<string, unknown>) || {};
      const name = normalizeCategoryName(payload.name);
      if (!name) {
        return res.status(400).json({ message: "Subcategory name is required." });
      }

      const { subcategory, updated } = await updateSubcategory(categoryId, subcategoryId, payload);
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

      const rawStatus = (req.body as { status?: unknown }).status;
      const status = parseWorkerApplicationStatus(rawStatus);
      const adminNotes = readTrimmedString((req.body as { adminNotes?: unknown }).adminNotes);
      if (rawStatus !== undefined && rawStatus !== null && !status) {
        return res.status(400).json({ message: "Invalid application status" });
      }

      const existingApplication = await getWorkerApplicationById(applicationId);
      if (!existingApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      const updatedApplication = await updateWorkerApplication(applicationId, {
        status: status || undefined,
        admin_notes: adminNotes || undefined,
        reviewed_at: new Date().toISOString()
      });

      if (!updatedApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      const emailNotification = {
        attempted: false,
        sent: false,
        skipped: false,
        error: ""
      };

      if (
        Boolean(status) &&
        existingApplication.status !== updatedApplication.status &&
        isWorkerApplicationStatusNotifiable(updatedApplication.status)
      ) {
        emailNotification.attempted = true;
        const delivery = await sendWorkerApplicationStatusEmail({
          workerEmail: updatedApplication.email,
          workerName: updatedApplication.full_name,
          applicationStatus: updatedApplication.status,
          optionalMessage: adminNotes || undefined
        });
        emailNotification.sent = delivery.sent;
        emailNotification.skipped = delivery.skipped;
        emailNotification.error = delivery.error || "";
        if (!delivery.sent && delivery.error) {
          // eslint-disable-next-line no-console
          console.error(
            `Failed to send status email for worker application ${updatedApplication.id}: ${delivery.error}`
          );
        }
      }

      const message =
        emailNotification.attempted && !emailNotification.sent
          ? "Application updated, but status email could not be sent."
          : "Application updated";

      return res.json({
        message,
        email: emailNotification,
        application: toApplicationResponse(req, sessionToken, updatedApplication)
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update application", error: getErrorMessage(error) });
    }
  });

  app.patch("/api/admin/worker/status/:workerId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const workerId = readTrimmedString(req.params.workerId);
      if (!workerId) {
        return res.status(400).json({ message: "workerId is required" });
      }

      const status = parseWorkerApplicationStatus((req.body as { status?: unknown }).status);
      if (!status) {
        return res.status(400).json({ message: "Invalid application status" });
      }
      if (!isWorkerApplicationStatusNotifiable(status)) {
        return res
          .status(400)
          .json({ message: "Only Approved, Rejected, or Visit Required are allowed for this endpoint." });
      }
      const adminNotes = readTrimmedString((req.body as { adminNotes?: unknown }).adminNotes);

      const application = await resolveWorkerApplicationForStatusUpdate(workerId);
      if (!application) {
        return res.status(404).json({ message: "Worker application not found" });
      }

      const statusChanged = application.status !== status;
      const updatedApplication = await updateWorkerApplication(application.id, {
        status,
        admin_notes: adminNotes || undefined,
        reviewed_at: new Date().toISOString()
      });

      if (!updatedApplication) {
        return res.status(404).json({ message: "Worker application not found" });
      }

      const emailNotification = {
        attempted: false,
        sent: false,
        skipped: false,
        error: ""
      };
      if (statusChanged) {
        emailNotification.attempted = true;
        const delivery = await sendWorkerApplicationStatusEmail({
          workerEmail: updatedApplication.email,
          workerName: updatedApplication.full_name,
          applicationStatus: status,
          optionalMessage: adminNotes || undefined
        });
        emailNotification.sent = delivery.sent;
        emailNotification.skipped = delivery.skipped;
        emailNotification.error = delivery.error || "";
        if (!delivery.sent && delivery.error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to send worker status email for ${workerId}: ${delivery.error}`);
        }
      }

      const message =
        emailNotification.attempted && !emailNotification.sent
          ? "Worker application status updated, but email could not be sent."
          : "Worker application status updated.";

      return res.json({
        message,
        workerId,
        email: emailNotification,
        application: toApplicationResponse(req, sessionToken, updatedApplication)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update worker application status",
        error: getErrorMessage(error)
      });
    }
  });

  app.delete("/api/admin/worker-applications/:applicationId", async (req: Request, res: Response) => {
    const sessionToken = getAdminSessionToken(req);
    if (!sessionToken || !options.validateAdminSession(sessionToken)) {
      return res.status(401).json({ message: "Admin session is invalid or expired" });
    }

    try {
      const applicationId = readTrimmedString(req.params.applicationId);
      if (!applicationId) {
        return res.status(400).json({ message: "applicationId is required" });
      }

      const { deleted, application } = await deleteWorkerApplication(applicationId);
      if (!deleted || !application) {
        return res.status(404).json({ message: "Application not found" });
      }

      await Promise.all([
        deleteWorkerDocument(application.id_proof_url).catch(() => {}),
        deleteWorkerDocument(application.address_proof_url).catch(() => {})
      ]);

      return res.json({ message: "Application deleted successfully." });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete application", error: getErrorMessage(error) });
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

      const workerId = generateNextWorkerId(allWorkers);
      if (!isValidWorkerId(workerId)) {
        return res.status(500).json({ message: "Generated workerId is invalid." });
      }
      const accountPassword = generateWorkerPassword(application.phone);
      const now = new Date().toISOString();
      const salary = Number.isFinite(Number((req.body as { salary?: unknown }).salary))
        ? Math.max(0, Number((req.body as { salary?: unknown }).salary))
        : 18000;
      const workerPayload: WorkerRecord = {
        worker_id: workerId.toUpperCase(),
        full_name: application.full_name,
        phone: normalizePhone(application.phone),
        email: readTrimmedString(application.email).toLowerCase(),
        category: application.category_applied,
        salary,
        password_hash: "",
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
        status: "Approved",
        admin_notes: adminNotes || application.admin_notes,
        reviewed_at: now,
        approved_worker_id: workerId
      });

      let firebaseUid = "";
      let loginEmail = workerPayload.email;
      let provisioningError = "";
      try {
        const firebaseAccount = await ensureWorkerFirebaseAccount(workerPayload, accountPassword);
        firebaseUid = firebaseAccount.uid;
        loginEmail = firebaseAccount.email;
      } catch (error) {
        provisioningError = getErrorMessage(error);
        // eslint-disable-next-line no-console
        console.error(`Failed to provision Firebase worker account for ${workerId}: ${provisioningError}`);
      }

      const emailDelivery = await sendEmail(
        application.email,
        "Your Tasko Worker Account Has Been Created",
        `Hello ${application.full_name},

Congratulations! Your worker account has been approved and created successfully on Tasko.

Here are your login credentials:

Worker ID: ${workerId}
Login Email: ${loginEmail}
Temporary Password: ${accountPassword}

You can log in to the Tasko Worker App using your worker ID or login email with this password.

If you forget the password later, use the "Forgot password" option in the worker app to receive a Firebase reset link on your email.

Welcome to Tasko!

Regards,
Tasko Team`
      );

      if (!emailDelivery.sent && emailDelivery.error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to send worker account email for ${workerId}: ${emailDelivery.error}`);
      }

      return res.status(201).json({
        message: provisioningError
          ? "Worker account created, but Firebase sync will retry automatically."
          : emailDelivery.sent
            ? "Worker account created successfully and login details sent to email."
            : "Worker account created but email notification failed.",
        workerId,
        firebaseUid,
        loginEmail,
        provisioningError,
        email: {
          attempted: true,
          sent: emailDelivery.sent,
          skipped: emailDelivery.skipped,
          error: emailDelivery.error || ""
        },
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

  app.post("/api/workers/auth/resolve-identifier", resolveWorkerLoginIdentifier);
  app.post("/api/workers/resolve-identifier", resolveWorkerLoginIdentifier);
  app.post("/api/workers/auth/login", async (req: Request, res: Response) => {
    try {
      const identifier = readTrimmedString((req.body as { identifier?: unknown }).identifier);
      const password = readTrimmedString((req.body as { password?: unknown }).password);

      if (!identifier || !password) {
        return res.status(400).json({ message: "identifier and password are required" });
      }

      const worker = await findWorkerByLoginIdentifier(identifier);
      if (!worker || !worker.password_hash || !verifyPassword(password, worker.password_hash)) {
        return res.status(401).json({ message: "Invalid worker ID/email or password." });
      }
      if (worker.status !== "Active") {
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }

      const firebaseAccount = await setWorkerFirebasePassword(worker, password);
      const customToken = await adminAuth.createCustomToken(firebaseAccount.uid);

      return res.json({
        customToken,
        email: firebaseAccount.email,
        worker: {
          workerId: firebaseAccount.worker.worker_id,
          fullName: firebaseAccount.worker.full_name,
          phone: firebaseAccount.worker.phone,
          email: firebaseAccount.worker.email,
          category: firebaseAccount.worker.category,
          status: firebaseAccount.worker.status
        }
      });
    } catch (error) {
      return res.status(500).json({ message: "Worker login failed", error: getErrorMessage(error) });
    }
  });
  app.post("/api/workers/login", async (req: Request, res: Response) => {
    try {
      const identifier = readTrimmedString((req.body as { identifier?: unknown }).identifier);
      const password = readTrimmedString((req.body as { password?: unknown }).password);

      if (!identifier || !password) {
        return res.status(400).json({ message: "identifier and password are required" });
      }

      const worker = await findWorkerByLoginIdentifier(identifier);
      if (!worker || !worker.password_hash || !verifyPassword(password, worker.password_hash)) {
        return res.status(401).json({ message: "Invalid worker ID/email or password." });
      }
      if (worker.status !== "Active") {
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }

      const firebaseAccount = await setWorkerFirebasePassword(worker, password);
      const customToken = await adminAuth.createCustomToken(firebaseAccount.uid);

      return res.json({
        customToken,
        email: firebaseAccount.email,
        worker: {
          workerId: firebaseAccount.worker.worker_id,
          fullName: firebaseAccount.worker.full_name,
          phone: firebaseAccount.worker.phone,
          email: firebaseAccount.worker.email,
          category: firebaseAccount.worker.category,
          status: firebaseAccount.worker.status
        }
      });
    } catch (error) {
      return res.status(500).json({ message: "Worker login failed", error: getErrorMessage(error) });
    }
  });

  app.post("/api/workers/auth/forgot-password", async (req: Request, res: Response) => {
    const genericMessage = "If an account with that email exists, a password reset link has been sent.";

    try {
      const email = readTrimmedString((req.body as { email?: unknown }).email).toLowerCase();

      if (!email) {
        return res.status(400).json({ message: "Email is required." });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Please enter a valid email address." });
      }

      const worker = await findWorkerByEmail(email);
      if (!worker) {
        return res.json({ message: genericMessage });
      }

      const displayName = worker.full_name || worker.worker_id || "Tasko worker";
      const { token, expiresInMinutes } = await issuePasswordResetToken({
        audience: "worker",
        accountKey: `worker:${worker.worker_id}`,
        email,
        displayName,
        workerId: worker.worker_id,
        firebaseUid: worker.firebase_uid
      });
      const resetUrl = `${getWorkerAppBaseUrl()}/reset-password/${encodeURIComponent(token)}`;
      const emailDelivery = await sendPasswordResetEmail({
        recipientEmail: email,
        recipientName: displayName,
        resetUrl,
        expiresInMinutes,
        audience: "worker"
      });

      if (!emailDelivery.sent && !emailDelivery.skipped) {
        return res.status(500).json({ message: "Failed to send password reset email." });
      }

      return res.json({ message: genericMessage });
    } catch (error) {
      return res.status(500).json({ message: "Failed to process password reset request", error: getErrorMessage(error) });
    }
  });

  app.get("/api/workers/auth/reset-password/:token", async (req: Request, res: Response) => {
    try {
      const token = readTrimmedString(req.params.token);
      const resetRecord = await validatePasswordResetToken("worker", token);

      if (!resetRecord) {
        return res.status(400).json({ message: "This password reset link is invalid or has expired." });
      }

      return res.json({
        valid: true,
        email: maskEmailAddress(resetRecord.email),
        expiresAt: resetRecord.expiresAt
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to validate password reset token", error: getErrorMessage(error) });
    }
  });

  app.post("/api/workers/auth/reset-password/:token", async (req: Request, res: Response) => {
    try {
      const token = readTrimmedString(req.params.token);
      const password = readTrimmedString((req.body as { password?: unknown }).password);
      const confirmPassword = readTrimmedString((req.body as { confirmPassword?: unknown }).confirmPassword);

      if (!password || !confirmPassword) {
        return res.status(400).json({ message: "Both password fields are required." });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Password and confirm password must match." });
      }

      const resetRecord = await validatePasswordResetToken("worker", token);
      if (!resetRecord) {
        return res.status(400).json({ message: "This password reset link is invalid or has expired." });
      }

      let worker = resetRecord.workerId ? await getWorkerById(resetRecord.workerId) : null;
      if (!worker) {
        worker = await findWorkerByEmail(resetRecord.email);
      }
      if (!worker) {
        return res.status(400).json({ message: "This password reset link is invalid or has expired." });
      }

      const updatedAt = new Date().toISOString();
      const nextWorker: WorkerRecord = {
        ...worker,
        password_hash: hashPassword(password),
        updated_at: updatedAt
      };

      try {
        await db.collection("workers").doc(worker.worker_id).set(
          {
            password_hash: nextWorker.password_hash,
            updated_at: updatedAt
          },
          { merge: true }
        );
      } catch (error) {
        if (!isFirestoreUnavailableError(error)) {
          throw error;
        }
      }

      inMemoryWorkers.set(nextWorker.worker_id, nextWorker);
      setWorkerProfileCache(nextWorker.worker_id, nextWorker);

      try {
        await setWorkerFirebasePassword(nextWorker, password);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to sync Firebase worker password for ${nextWorker.worker_id}: ${getErrorMessage(error)}`);
      }

      await markPasswordResetTokenUsed(token);

      return res.json({
        message: "Your password has been successfully updated. Please log in."
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to reset worker password", error: getErrorMessage(error) });
    }
  });

  app.post("/api/workers/session/validate", async (req: Request, res: Response) => {
    try {
      const worker = await resolveAuthenticatedWorker(req);
      if (!worker) {
        return res.status(401).json({ message: "Worker authentication is invalid or expired" });
      }
      if (!worker || worker.status !== "Active") {
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

  app.post("/api/workers/logout", (_req: Request, res: Response) => {
    return res.json({ message: "Logged out" });
  });

  app.get("/api/workers/me", async (req: Request, res: Response) => {
    try {
      const worker = await resolveAuthenticatedWorker(req);
      if (!worker) {
        return res.status(401).json({ message: "Worker authentication is required" });
      }
      if (worker.status !== "Active") {
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }

      return res.json(toWorkerResponse(worker));
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch worker profile", error: getErrorMessage(error) });
    }
  });

  app.get("/api/workers/my-jobs", async (req: Request, res: Response) => {
    try {
      const worker = await resolveAuthenticatedWorker(req);
      if (!worker) {
        return res.status(401).json({ message: "Worker authentication is required" });
      }
      if (worker.status !== "Active") {
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }
      const workerId = worker.worker_id;

      const cachedJobs = getWorkerJobsFromCache(workerId);
      if (cachedJobs) {
        return res.json(cachedJobs);
      }

      const snapshot = await db.collection("bookings").where("assignedWorkerId", "==", workerId).limit(20).get();
      const rawJobs: Array<Record<string, unknown>> = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>)
      }));
      const userIdsNeedingBackfill = uniqueNonEmptyStrings(
        rawJobs
          .filter((job) => {
            const hasPhone = readTrimmedString(job.userPhone) || readTrimmedString(job.user_phone);
            const hasAddress =
              readTrimmedString(job.address) || readTrimmedString(job.serviceAddress) || readTrimmedString(job.service_address);
            return !hasPhone || !hasAddress;
          })
          .map((job) => job.userId || job.user_id)
      );

      const usersById = new Map<string, Record<string, unknown>>();
      if (userIdsNeedingBackfill.length > 0) {
        const userSnapshots = await Promise.all(
          userIdsNeedingBackfill.map(async (userId) => {
            const userDoc = await db.collection("users").doc(userId).get();
            if (!userDoc.exists) return null;
            return [userId, userDoc.data() as Record<string, unknown>] as const;
          })
        );

        userSnapshots.forEach((entry) => {
          if (!entry) return;
          usersById.set(entry[0], entry[1]);
        });
      }

      const jobs = rawJobs.map((job) => {
        const userId = readTrimmedString(job.userId) || readTrimmedString(job.user_id);
        const userData = userId ? usersById.get(userId) || null : null;
        return normalizeWorkerJobRecord(String(job.id || ""), job, userData);
      });
      setWorkerJobsCache(workerId, jobs);
      return res.json(jobs);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch assigned jobs", error: getErrorMessage(error) });
    }
  });

  app.post("/api/workers/my-jobs/:bookingId/arrived", async (req: Request, res: Response) => {
    try {
      const worker = await resolveAuthenticatedWorker(req);
      if (!worker) {
        return res.status(401).json({ message: "Worker authentication is required" });
      }
      if (worker.status !== "Active") {
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }
      const workerId = worker.worker_id;

      const bookingId = readTrimmedString(req.params.bookingId);
      if (!bookingId) {
        return res.status(400).json({ message: "bookingId is required" });
      }

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      if (!bookingDoc.exists) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const bookingData = (bookingDoc.data() || {}) as Record<string, unknown>;
      const assignedWorkerId =
        readTrimmedString(bookingData.assignedWorkerId) || readTrimmedString(bookingData.assigned_worker_id);
      if (!assignedWorkerId || assignedWorkerId !== workerId) {
        return res.status(403).json({ message: "This booking is not assigned to the current worker." });
      }

      const normalizedStatus = readTrimmedString(bookingData.status).toLowerCase().replace(/[\s-]+/g, "_");
      if (["in_progress", "completed", "cancelled"].includes(normalizedStatus)) {
        return res.status(400).json({ message: "This booking cannot be marked as arrived." });
      }

      const existingStartOtp =
        readTrimmedString(bookingData.startOtp) ||
        readTrimmedString(bookingData.start_otp) ||
        readTrimmedString(bookingData.jobStartOtp) ||
        readTrimmedString(bookingData.job_start_otp);
      const startOtp = existingStartOtp || generateNumericOtp(4);
      const arrivedAtIso = new Date().toISOString();
      const serviceName =
        readTrimmedString(bookingData.subCategory) ||
        readTrimmedString(bookingData.category) ||
        readTrimmedString(bookingData.serviceCategory) ||
        "your service";
      const notificationMessage = `Your worker has arrived for ${serviceName}. Share OTP ${startOtp} to start the job.`;

      await db.collection("bookings").doc(bookingId).set(
        {
          startOtp,
          start_otp: startOtp,
          workerArrivedAt: timestamp(),
          worker_arrived_at: timestamp(),
          arrivalNotificationTitle: "Worker Arrived",
          arrival_notification_title: "Worker Arrived",
          arrivalNotificationMessage: notificationMessage,
          arrival_notification_message: notificationMessage,
          updatedAt: timestamp(),
          updated_at: timestamp()
        },
        { merge: true }
      );

      clearWorkerJobsCache(workerId);
      options.clearBookingCache?.();

      return res.json({
        message: "Arrival recorded and OTP shared with the user.",
        bookingId,
        startOtp,
        start_otp: startOtp,
        workerArrivedAt: arrivedAtIso,
        worker_arrived_at: arrivedAtIso,
        arrivalNotificationTitle: "Worker Arrived",
        arrival_notification_title: "Worker Arrived",
        arrivalNotificationMessage: notificationMessage,
        arrival_notification_message: notificationMessage
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to record arrival", error: getErrorMessage(error) });
    }
  });

  app.post("/api/workers/my-jobs/:bookingId/request-completion-otp", async (req: Request, res: Response) => {
    try {
      const worker = await resolveAuthenticatedWorker(req);
      if (!worker) {
        return res.status(401).json({ message: "Worker authentication is required" });
      }
      if (worker.status !== "Active") {
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }
      const workerId = worker.worker_id;

      const bookingId = readTrimmedString(req.params.bookingId);
      if (!bookingId) {
        return res.status(400).json({ message: "bookingId is required" });
      }

      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      if (!bookingDoc.exists) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const bookingData = (bookingDoc.data() || {}) as Record<string, unknown>;
      const assignedWorkerId =
        readTrimmedString(bookingData.assignedWorkerId) || readTrimmedString(bookingData.assigned_worker_id);
      if (!assignedWorkerId || assignedWorkerId !== workerId) {
        return res.status(403).json({ message: "This booking is not assigned to the current worker." });
      }

      const normalizedStatus = readTrimmedString(bookingData.status).toLowerCase().replace(/[\s-]+/g, "_");
      if (normalizedStatus !== "in_progress") {
        return res.status(400).json({ message: "Completion OTP can only be requested for in-progress jobs." });
      }

      const existingCompletionOtp =
        readTrimmedString(bookingData.completionOtp) ||
        readTrimmedString(bookingData.completion_otp) ||
        readTrimmedString(bookingData.jobCompletionOtp) ||
        readTrimmedString(bookingData.job_completion_otp);
      const completionOtp = existingCompletionOtp || generateNumericOtp(4);
      const requestedAtIso = new Date().toISOString();
      const serviceName =
        readTrimmedString(bookingData.subCategory) ||
        readTrimmedString(bookingData.category) ||
        readTrimmedString(bookingData.serviceCategory) ||
        "your service";
      const notificationMessage = `Your worker is ready to complete ${serviceName}. Share OTP ${completionOtp} to finish the job.`;

      await db.collection("bookings").doc(bookingId).set(
        {
          completionOtp,
          completion_otp: completionOtp,
          completionOtpRequestedAt: timestamp(),
          completion_otp_requested_at: timestamp(),
          completionNotificationTitle: "Completion OTP Ready",
          completion_notification_title: "Completion OTP Ready",
          completionNotificationMessage: notificationMessage,
          completion_notification_message: notificationMessage,
          updatedAt: timestamp(),
          updated_at: timestamp()
        },
        { merge: true }
      );

      clearWorkerJobsCache(workerId);
      options.clearBookingCache?.();

      return res.json({
        message: "Completion OTP shared with the user.",
        bookingId,
        completionOtp,
        completion_otp: completionOtp,
        completionOtpRequestedAt: requestedAtIso,
        completion_otp_requested_at: requestedAtIso,
        completionNotificationTitle: "Completion OTP Ready",
        completion_notification_title: "Completion OTP Ready",
        completionNotificationMessage: notificationMessage,
        completion_notification_message: notificationMessage
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to request completion OTP", error: getErrorMessage(error) });
    }
  });

  app.patch("/api/workers/me/status", async (req: Request, res: Response) => {
    try {
      const worker = await resolveAuthenticatedWorker(req);
      if (!worker) {
        return res.status(401).json({ message: "Worker authentication is required" });
      }
      if (worker.status !== "Active") {
        return res.status(403).json({ message: "Your account is not activated. Please contact Tasko admin." });
      }

      const online = (req.body as { online?: unknown }).online;
      if (typeof online !== "boolean") {
        return res.status(400).json({ message: "online must be a boolean" });
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
      setWorkerProfileCache(worker.worker_id, { ...worker, online, updated_at: updatedAt });
      clearWorkerJobsCache(worker.worker_id);
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


