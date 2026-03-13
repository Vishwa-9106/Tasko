import crypto from "crypto";
import { db } from "../firebaseAdmin";

export type PasswordResetAudience = "user" | "worker";

export type PasswordResetTokenRecord = {
  tokenHash: string;
  audience: PasswordResetAudience;
  accountKey: string;
  email: string;
  displayName: string;
  userUid?: string;
  workerId?: string;
  firebaseUid?: string;
  expiresAt: number;
  createdAt: string;
  usedAt: string;
};

type IssuePasswordResetTokenParams = {
  audience: PasswordResetAudience;
  accountKey: string;
  email: string;
  displayName?: string;
  userUid?: string;
  workerId?: string;
  firebaseUid?: string;
  ttlMinutes?: number;
};

const PASSWORD_RESET_COLLECTION = "password_reset_tokens";
const DEFAULT_RESET_TTL_MINUTES = Math.max(1, Number(process.env.PASSWORD_RESET_TTL_MINUTES || 10));
const inMemoryPasswordResetTokens = new Map<string, PasswordResetTokenRecord>();

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function toAccountDisplayName(value: unknown): string {
  return readTrimmedString(value) || "Tasko member";
}

function normalizePasswordResetAudience(value: unknown): PasswordResetAudience {
  return value === "worker" ? "worker" : "user";
}

function normalizePasswordResetTokenRecord(
  tokenHash: string,
  data: Record<string, unknown>
): PasswordResetTokenRecord {
  return {
    tokenHash,
    audience: normalizePasswordResetAudience(data.audience),
    accountKey: readTrimmedString(data.accountKey),
    email: readTrimmedString(data.email).toLowerCase(),
    displayName: toAccountDisplayName(data.displayName),
    userUid: readTrimmedString(data.userUid) || undefined,
    workerId: readTrimmedString(data.workerId) || undefined,
    firebaseUid: readTrimmedString(data.firebaseUid) || undefined,
    expiresAt: Number(data.expiresAt) || 0,
    createdAt: readTrimmedString(data.createdAt),
    usedAt: readTrimmedString(data.usedAt)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExpired(record: PasswordResetTokenRecord): boolean {
  return !record.expiresAt || Date.now() >= record.expiresAt;
}

async function deletePasswordResetToken(tokenHash: string): Promise<void> {
  inMemoryPasswordResetTokens.delete(tokenHash);

  try {
    await db.collection(PASSWORD_RESET_COLLECTION).doc(tokenHash).delete();
  } catch {
    // Ignore Firestore cleanup failures and fall back to memory.
  }
}

async function readPasswordResetTokenRecord(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
  const memoryRecord = inMemoryPasswordResetTokens.get(tokenHash);
  if (memoryRecord) {
    return memoryRecord;
  }

  try {
    const document = await db.collection(PASSWORD_RESET_COLLECTION).doc(tokenHash).get();
    if (!document.exists) {
      return null;
    }

    const data = document.data();
    if (!isRecord(data)) {
      return null;
    }

    const record = normalizePasswordResetTokenRecord(document.id, data);
    inMemoryPasswordResetTokens.set(record.tokenHash, record);
    return record;
  } catch {
    return null;
  }
}

async function invalidateExistingAccountTokens(accountKey: string): Promise<void> {
  if (!accountKey) {
    return;
  }

  Array.from(inMemoryPasswordResetTokens.entries()).forEach(([tokenHash, record]) => {
    if (record.accountKey === accountKey) {
      inMemoryPasswordResetTokens.delete(tokenHash);
    }
  });

  try {
    const snapshot = await db.collection(PASSWORD_RESET_COLLECTION).where("accountKey", "==", accountKey).get();
    if (snapshot.empty) {
      return;
    }

    await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
  } catch {
    // Ignore Firestore invalidation failures and continue with in-memory invalidation.
  }
}

export async function issuePasswordResetToken(
  params: IssuePasswordResetTokenParams
): Promise<{ token: string; expiresAt: number; expiresInMinutes: number }> {
  const ttlMinutes =
    Number.isFinite(Number(params.ttlMinutes)) && Number(params.ttlMinutes) > 0
      ? Math.trunc(Number(params.ttlMinutes))
      : DEFAULT_RESET_TTL_MINUTES;
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const createdAt = new Date().toISOString();
  const record: PasswordResetTokenRecord = {
    tokenHash,
    audience: params.audience,
    accountKey: readTrimmedString(params.accountKey),
    email: readTrimmedString(params.email).toLowerCase(),
    displayName: toAccountDisplayName(params.displayName),
    userUid: readTrimmedString(params.userUid) || undefined,
    workerId: readTrimmedString(params.workerId) || undefined,
    firebaseUid: readTrimmedString(params.firebaseUid) || undefined,
    expiresAt,
    createdAt,
    usedAt: ""
  };

  await invalidateExistingAccountTokens(record.accountKey);
  inMemoryPasswordResetTokens.set(tokenHash, record);

  try {
    await db.collection(PASSWORD_RESET_COLLECTION).doc(tokenHash).set(record);
  } catch {
    // Allow in-memory storage to back the flow if Firestore is unavailable.
  }

  return {
    token,
    expiresAt,
    expiresInMinutes: ttlMinutes
  };
}

export async function validatePasswordResetToken(
  audience: PasswordResetAudience,
  token: string
): Promise<PasswordResetTokenRecord | null> {
  const normalizedToken = readTrimmedString(token);
  if (!normalizedToken) {
    return null;
  }

  const tokenHash = hashResetToken(normalizedToken);
  const record = await readPasswordResetTokenRecord(tokenHash);

  if (!record || record.audience !== audience) {
    return null;
  }

  if (record.usedAt || isExpired(record)) {
    await deletePasswordResetToken(record.tokenHash);
    return null;
  }

  return record;
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  const normalizedToken = readTrimmedString(token);
  if (!normalizedToken) {
    return;
  }

  const tokenHash = hashResetToken(normalizedToken);
  const existingRecord = await readPasswordResetTokenRecord(tokenHash);
  if (!existingRecord) {
    return;
  }

  const usedAt = new Date().toISOString();
  const nextRecord = {
    ...existingRecord,
    usedAt
  };

  inMemoryPasswordResetTokens.set(tokenHash, nextRecord);

  try {
    await db.collection(PASSWORD_RESET_COLLECTION).doc(tokenHash).set({ usedAt }, { merge: true });
  } catch {
    // Ignore Firestore write failures and keep the in-memory used marker.
  }
}
