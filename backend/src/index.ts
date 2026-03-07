import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { Query } from "firebase-admin/firestore";
import path from "path";
import { auth as adminAuth, db, timestamp } from "./firebaseAdmin";
import { ensurePackagesBootstrapData, registerPackageRoutes } from "./packagesRoutes";
import { registerTaskoMartRoutes } from "./taskomartRoutes";
import { registerWorkerHiringRoutes } from "./workerHiringRoutes";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOrigins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];
const fixedAdminEmail = "kit27.ad63@gmail.com";
const fixedAdminPassword = "Tasko@123";
const configuredAdminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const bootstrapAdminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || fixedAdminEmail).trim().toLowerCase();
const bootstrapAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || fixedAdminPassword;
const adminEmails = new Set(
  [fixedAdminEmail, bootstrapAdminEmail, ...configuredAdminEmails].filter(Boolean)
);
const adminPasswords = new Set([fixedAdminPassword, bootstrapAdminPassword]);
const adminSessions = new Map<string, { email: string; createdAt: number }>();
const adminSessionTtlMs = 1000 * 60 * 60 * 24;
const inMemoryUsers = new Map<string, Record<string, unknown>>();
const inMemoryWorkers = new Map<string, Record<string, unknown>>();
const dashboardReadCache = new Map<string, { expiresAt: number; value: unknown }>();
const dashboardReadCacheTtlMs = Math.max(5000, Number(process.env.DASHBOARD_READ_CACHE_MS || 30000));
const adminAnalyticsCacheTtlMs = Math.max(5000, Number(process.env.ADMIN_ANALYTICS_CACHE_MS || 60000));
let adminAnalyticsCache: { expiresAt: number; value: Record<string, number> } | null = null;

app.use(
  cors({
    origin: allowedOrigins
  })
);
// The apply form sends two base64 documents in one JSON payload.
// 25mb allows both documents plus JSON overhead without tripping 413.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

type RoleType = "user" | "worker" | "admin" | "unknown";
type WritableRole = Exclude<RoleType, "unknown">;

function isWritableRole(role: unknown): role is WritableRole {
  return role === "user" || role === "worker" || role === "admin";
}

function isAllowedAdminEmail(email: string): boolean {
  return adminEmails.has(email.trim().toLowerCase());
}

function createAdminSession(email: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, {
    email: email.trim().toLowerCase(),
    createdAt: Date.now()
  });
  return token;
}

function isValidAdminSession(sessionToken: string): boolean {
  const session = adminSessions.get(sessionToken);
  if (!session) return false;

  if (Date.now() - session.createdAt > adminSessionTtlMs) {
    adminSessions.delete(sessionToken);
    void removePersistedAdminSession(sessionToken);
    return false;
  }

  return true;
}

function clearAdminSession(sessionToken: string): void {
  adminSessions.delete(sessionToken);
  void removePersistedAdminSession(sessionToken);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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

function toInMemoryWorkerList(): Array<Record<string, unknown>> {
  return Array.from(inMemoryWorkers.entries()).map(([id, worker]) => ({ id, ...worker }));
}

function toInMemoryUserList(): Array<Record<string, unknown>> {
  return Array.from(inMemoryUsers.entries()).map(([id, user]) => ({ id, ...user }));
}

function getDashboardReadCache<T>(cacheKey: string): T | null {
  const entry = dashboardReadCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    dashboardReadCache.delete(cacheKey);
    return null;
  }
  return entry.value as T;
}

function setDashboardReadCache<T>(cacheKey: string, value: T): void {
  dashboardReadCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + dashboardReadCacheTtlMs
  });
}

function clearDashboardReadCache(prefix: "users:" | "workers:" | "bookings:"): void {
  Array.from(dashboardReadCache.keys()).forEach((cacheKey) => {
    if (cacheKey.startsWith(prefix)) {
      dashboardReadCache.delete(cacheKey);
    }
  });
}

function getAdminAnalyticsCache(): Record<string, number> | null {
  if (!adminAnalyticsCache) return null;
  if (Date.now() >= adminAnalyticsCache.expiresAt) {
    adminAnalyticsCache = null;
    return null;
  }
  return adminAnalyticsCache.value;
}

function setAdminAnalyticsCache(value: Record<string, number>): void {
  adminAnalyticsCache = {
    value,
    expiresAt: Date.now() + adminAnalyticsCacheTtlMs
  };
}

function clearAdminAnalyticsCache(): void {
  adminAnalyticsCache = null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const OMIT_FROM_FIRESTORE = Symbol("omit-from-firestore");
type FirestoreSanitizedValue = unknown | typeof OMIT_FROM_FIRESTORE;

function sanitizeForFirestore(value: unknown): FirestoreSanitizedValue {
  if (value === undefined) {
    return OMIT_FROM_FIRESTORE;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeForFirestore(entry))
      .filter((entry) => entry !== OMIT_FROM_FIRESTORE);
  }

  if (isRecord(value)) {
    const cleanedEntries = Object.entries(value)
      .map(([key, entry]) => [key, sanitizeForFirestore(entry)] as const)
      .filter(([, entry]) => entry !== OMIT_FROM_FIRESTORE);
    return Object.fromEntries(cleanedEntries);
  }

  return value;
}

function normalizeWorkerAssessment(assessment: unknown): Record<string, unknown> | null {
  if (!isRecord(assessment)) {
    return null;
  }

  const answers =
    Array.isArray(assessment.answers) &&
    assessment.answers
      .filter((answer): answer is Record<string, unknown> => isRecord(answer))
      .map((answer) => {
        const sanitizedAnswer = sanitizeForFirestore({
          questionId: answer.questionId,
          question: answer.question,
          selectedOptionIndex: answer.selectedOptionIndex,
          selectedOption: answer.selectedOption,
          correctOptionIndex: answer.correctOptionIndex,
          correctOption: answer.correctOption,
          isCorrect: answer.isCorrect
        });

        return isRecord(sanitizedAnswer) ? sanitizedAnswer : null;
      })
      .filter((answer): answer is Record<string, unknown> => answer !== null);

  const sanitizedAssessment = sanitizeForFirestore({
    category: assessment.category,
    totalQuestions: assessment.totalQuestions,
    score: assessment.score,
    percentage: assessment.percentage,
    passed: assessment.passed,
    answers: Array.isArray(answers) ? answers : [],
    submittedAt: assessment.submittedAt || new Date().toISOString(),
    reviewedByAdmin: false
  });

  return isRecord(sanitizedAssessment) ? sanitizedAssessment : null;
}

function toWorkerAssessmentSummary(assessment: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!assessment) {
    return null;
  }

  const summary = sanitizeForFirestore({
    category: assessment.category,
    totalQuestions: assessment.totalQuestions,
    score: assessment.score,
    percentage: assessment.percentage,
    passed: assessment.passed,
    submittedAt: assessment.submittedAt,
    reviewedByAdmin: false
  });

  return isRecord(summary) ? summary : null;
}

async function upsertWorkerRegistration({
  firebaseUid,
  name,
  mobile,
  email,
  categories,
  assessment
}: {
  firebaseUid: string;
  name: string;
  mobile: string;
  email: string;
  categories: string[];
  assessment: Record<string, unknown> | null;
}): Promise<void> {
  const workerPayload: Record<string, unknown> = {
    firebaseUid,
    name,
    mail: email,
    number: mobile,
    mobile,
    email,
    categories,
    primaryCategory: categories[0] || "",
    role: "worker",
    status: "pending",
    online: false,
    createdAt: timestamp(),
    updatedAt: timestamp()
  };

  if (assessment) {
    workerPayload.assessment = assessment;
  }

  try {
    await Promise.all([
      db.collection("workers").doc(firebaseUid).set(workerPayload, { merge: true }),
      db.collection("users").doc(firebaseUid).set(
        {
          uid: firebaseUid,
          name,
          mail: email,
          number: mobile,
          mobile,
          email,
          role: "worker",
          workerStatus: "pending",
          createdAt: timestamp(),
          updatedAt: timestamp()
        },
        { merge: true }
      )
    ]);
    return;
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  const now = new Date().toISOString();
  const memoryWorkerPayload: Record<string, unknown> = {
    firebaseUid,
    name,
    mail: email,
    number: mobile,
    mobile,
    email,
    categories,
    primaryCategory: categories[0] || "",
    role: "worker",
    status: "pending",
    online: false,
    createdAt: now,
    updatedAt: now
  };

  if (assessment) {
    memoryWorkerPayload.assessment = assessment;
  }

  inMemoryWorkers.set(firebaseUid, memoryWorkerPayload);

  const existingUser = inMemoryUsers.get(firebaseUid);
  const existingCreatedAt =
    existingUser && Object.prototype.hasOwnProperty.call(existingUser, "createdAt") ? existingUser.createdAt : now;

  inMemoryUsers.set(firebaseUid, {
    ...(existingUser || {}),
    uid: firebaseUid,
    name,
    mail: email,
    number: mobile,
    mobile,
    email,
    role: "worker",
    workerStatus: "pending",
    createdAt: existingCreatedAt,
    updatedAt: now
  });
}

function sendDashboardReadFallback<T>(
  res: Response,
  route: string,
  fallbackPayload: T,
  error: unknown
): Response {
  // eslint-disable-next-line no-console
  console.error(`${route} failed, using fallback payload: ${getErrorMessage(error)}`);
  return res.json(fallbackPayload);
}

function readRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] || "";
  }

  return param || "";
}

function readQueryText(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : "";
  }
  return typeof value === "string" ? value.trim() : "";
}

function readQueryLimit(value: unknown, fallback: number, max = 100): number {
  const parsed = Number(readQueryText(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.trunc(parsed));
}

function getAdminSessionToken(req: Request): string {
  const headerToken = readQueryText(req.header("x-admin-session-token"));
  if (headerToken) {
    return headerToken;
  }

  const authorizationHeader = readQueryText(req.header("authorization"));
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  const queryToken = readQueryText(req.query.sessionToken);
  if (queryToken) {
    return queryToken;
  }

  return isRecord(req.body) ? readQueryText(req.body.sessionToken) : "";
}

function ensureValidAdminSessionRequest(req: Request, res: Response): string | null {
  const sessionToken = getAdminSessionToken(req);
  if (!sessionToken || !isValidAdminSession(sessionToken)) {
    res.status(401).json({ message: "Admin session is invalid or expired" });
    return null;
  }
  return sessionToken;
}

async function syncUserRoleRecord({
  uid,
  email,
  name,
  role
}: {
  uid: string;
  email: string;
  name: string;
  role: WritableRole;
}): Promise<void> {
  const now = new Date().toISOString();
  const existingInMemoryUser = inMemoryUsers.get(uid);
  const existingNumber =
    existingInMemoryUser && typeof existingInMemoryUser.number === "string" ? existingInMemoryUser.number : "";
  const payload: Record<string, unknown> = {
    uid,
    email,
    mail: email,
    number: existingNumber,
    mobile: existingNumber,
    name,
    role,
    updatedAt: now
  };

  if (role === "worker") {
    let workerStatus: unknown = "pending";
    const memoryWorker = inMemoryWorkers.get(uid);

    if (memoryWorker && typeof memoryWorker.status === "string") {
      workerStatus = memoryWorker.status;
      if (typeof memoryWorker.number === "string") {
        payload.number = memoryWorker.number;
        payload.mobile = memoryWorker.number;
      } else if (typeof memoryWorker.mobile === "string") {
        payload.number = memoryWorker.mobile;
        payload.mobile = memoryWorker.mobile;
      }
    } else {
      try {
        const workerDoc = await db.collection("workers").doc(uid).get();
        const workerData = workerDoc.data();
        workerStatus = workerData?.status || "pending";
        if (typeof workerData?.number === "string") {
          payload.number = workerData.number;
          payload.mobile = workerData.number;
        } else if (typeof workerData?.mobile === "string") {
          payload.number = workerData.mobile;
          payload.mobile = workerData.mobile;
        }
      } catch (error) {
        if (!isFirestoreUnavailableError(error)) {
          throw error;
        }
      }
    }

    payload.workerStatus = workerStatus;
  }

  try {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      payload.createdAt = now;
    }
    await userRef.set(payload, { merge: true });
    return;
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  const existingUser = inMemoryUsers.get(uid);
  const existingCreatedAt =
    existingUser && Object.prototype.hasOwnProperty.call(existingUser, "createdAt") ? existingUser.createdAt : now;

  inMemoryUsers.set(uid, {
    ...(existingUser || {}),
    ...payload,
    createdAt: existingCreatedAt
  });
}

async function resolveRole(uid: string): Promise<RoleType> {
  const memoryUser = inMemoryUsers.get(uid);
  if (memoryUser) {
    const memoryRole = memoryUser.role;
    if (memoryRole === "user" || memoryRole === "worker" || memoryRole === "admin") {
      return memoryRole;
    }
  }

  if (inMemoryWorkers.has(uid)) {
    return "worker";
  }

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const role = userDoc.data()?.role;
      if (role === "user" || role === "worker" || role === "admin") {
        return role;
      }
    }

    const workerDoc = await db.collection("workers").doc(uid).get();
    if (workerDoc.exists) {
      return "worker";
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return "unknown";
}

async function ensureAdminAccountRecord(email: string, password: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  let adminUser;

  try {
    adminUser = await adminAuth.getUserByEmail(normalizedEmail);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== "auth/user-not-found") {
      throw error;
    }

    adminUser = await adminAuth.createUser({
      email: normalizedEmail,
      password,
      displayName: "Tasko Admin"
    });
  }

  await adminAuth.updateUser(adminUser.uid, {
    password,
    displayName: adminUser.displayName || "Tasko Admin",
    disabled: false
  });

  const now = new Date().toISOString();
  await Promise.all([
    db
      .collection("users")
      .doc(adminUser.uid)
      .set(
        {
          uid: adminUser.uid,
          email: normalizedEmail,
          name: "Tasko Admin",
          role: "admin",
          updatedAt: now,
          createdAt: now
        },
        { merge: true }
      ),
    db
      .collection("admin_accounts")
      .doc(normalizedEmail)
      .set(
        {
          uid: adminUser.uid,
          email: normalizedEmail,
          role: "admin",
          status: "active",
          updatedAt: now,
          createdAt: now
        },
        { merge: true }
      )
  ]);
}

async function syncAdminAccessRecord({
  uid,
  email,
  name
}: {
  uid: string;
  email: string;
  name: string;
}): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim() || "Tasko Admin";
  const now = new Date().toISOString();

  await syncUserRoleRecord({
    uid,
    email: normalizedEmail,
    name: normalizedName,
    role: "admin"
  });

  try {
    await db
      .collection("admin_accounts")
      .doc(normalizedEmail)
      .set(
        {
          uid,
          email: normalizedEmail,
          role: "admin",
          status: "active",
          updatedAt: now,
          createdAt: now
        },
        { merge: true }
      );
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }
}

async function persistAdminSession(sessionToken: string, email: string, createdAt: number): Promise<void> {
  const now = new Date().toISOString();
  const expiresAt = createdAt + adminSessionTtlMs;
  await db.collection("admin_sessions").doc(sessionToken).set(
    {
      token: sessionToken,
      email: email.trim().toLowerCase(),
      createdAt,
      created_at: new Date(createdAt).toISOString(),
      expiresAt,
      expires_at: new Date(expiresAt).toISOString(),
      updatedAt: now
    },
    { merge: true }
  );
}

async function createPersistedAdminSession(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const sessionToken = createAdminSession(normalizedEmail);
  const createdAt = adminSessions.get(sessionToken)?.createdAt || Date.now();

  try {
    await persistAdminSession(sessionToken, normalizedEmail, createdAt);
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      // eslint-disable-next-line no-console
      console.error("Failed to persist admin session:", error);
    }
  }

  return sessionToken;
}

async function removePersistedAdminSession(sessionToken: string): Promise<void> {
  try {
    await db.collection("admin_sessions").doc(sessionToken).delete();
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      // eslint-disable-next-line no-console
      console.error(`Failed to remove admin session ${sessionToken}: ${getErrorMessage(error)}`);
    }
  }
}

async function loadPersistedAdminSessions(): Promise<void> {
  try {
    const snapshot = await db.collection("admin_sessions").get();
    const now = Date.now();
    const staleSessionTokens: string[] = [];

    snapshot.docs.forEach((document) => {
      const data = document.data() || {};
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      const createdAtNumber = Number(data.createdAt);
      const expiresAtNumber = Number(data.expiresAt);
      const createdAtIso =
        typeof data.created_at === "string" ? Date.parse(data.created_at) : Number.NaN;
      const expiresAtIso =
        typeof data.expires_at === "string" ? Date.parse(data.expires_at) : Number.NaN;
      const createdAt = Number.isFinite(createdAtNumber)
        ? createdAtNumber
        : Number.isFinite(createdAtIso)
          ? createdAtIso
          : now;
      const expiresAt = Number.isFinite(expiresAtNumber)
        ? expiresAtNumber
        : Number.isFinite(expiresAtIso)
          ? expiresAtIso
          : createdAt + adminSessionTtlMs;

      if (!email || expiresAt <= now) {
        staleSessionTokens.push(document.id);
        return;
      }

      adminSessions.set(document.id, {
        email,
        createdAt
      });
    });

    if (staleSessionTokens.length > 0) {
      await Promise.all(
        staleSessionTokens.map((token) =>
          db
            .collection("admin_sessions")
            .doc(token)
            .delete()
            .catch(() => {})
        )
      );
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      // eslint-disable-next-line no-console
      console.error("Failed to load persisted admin sessions:", error);
    }
  }
}

async function ensureAdminAccount(): Promise<void> {
  const seedAdminAccounts = [
    { email: fixedAdminEmail, password: fixedAdminPassword },
    { email: bootstrapAdminEmail, password: bootstrapAdminPassword }
  ];
  const seededByEmail = new Map(seedAdminAccounts.map((account) => [account.email, account]));

  try {
    await Promise.all(
      Array.from(seededByEmail.values()).map((account) => ensureAdminAccountRecord(account.email, account.password))
    );
    // eslint-disable-next-line no-console
    console.log(`Admin account ready: ${Array.from(seededByEmail.keys()).join(", ")}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to ensure bootstrap admin account:", error);
  }
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req: Request, res: Response) => {
  res.type("application/json").json({});
});

app.get("/api/config/client", (_req: Request, res: Response) => {
  res.json({
    apiBaseUrl: "http://localhost:5000",
    firebaseConfig: {
      apiKey: process.env.FIREBASE_WEB_API_KEY || "",
      authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN || "",
      projectId: process.env.FIREBASE_WEB_PROJECT_ID || "",
      storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET || "",
      messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID || "",
      appId: process.env.FIREBASE_WEB_APP_ID || ""
    }
  });
});

app.post("/api/auth/validate", async (req: Request, res: Response) => {
  try {
    const { idToken, expectedRole } = req.body as { idToken?: string; expectedRole?: RoleType };
    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const role = await resolveRole(decoded.uid);

    if (expectedRole === "admin" && !isAllowedAdminEmail(decoded.email || "")) {
      return res.status(403).json({ message: "This account is not authorized for admin access" });
    }

    if (expectedRole && role !== expectedRole) {
      return res.status(403).json({ message: `Access denied for role '${role}'` });
    }

    return res.json({
      uid: decoded.uid,
      email: decoded.email || "",
      role
    });
  } catch (error) {
    return res.status(401).json({ message: "Token validation failed", error });
  }
});

app.post("/api/auth/sync-role", async (req: Request, res: Response) => {
  try {
    const { idToken, role, name } = req.body as { idToken?: string; role?: RoleType; name?: string };

    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }
    if (!isWritableRole(role)) {
      return res.status(400).json({ message: "role must be user, worker, or admin" });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    if (role === "admin" && !isAllowedAdminEmail(decoded.email || "")) {
      return res.status(403).json({ message: "This account is not authorized for admin access" });
    }

    await syncUserRoleRecord({
      uid: decoded.uid,
      email: decoded.email || "",
      name: name || decoded.name || "",
      role
    });

    return res.json({
      uid: decoded.uid,
      email: decoded.email || "",
      role
    });
  } catch (error) {
    return res.status(401).json({ message: "Role sync failed", error });
  }
});

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
    };

    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedDisplayName = (displayName || "").trim();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    let createdUser;

    try {
      createdUser = await adminAuth.createUser({
        email: normalizedEmail,
        password,
        displayName: normalizedDisplayName || undefined,
        disabled: false
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/email-already-exists") {
        return res.status(409).json({ message: "This email is already in use." });
      }
      if (code === "auth/invalid-email") {
        return res.status(400).json({ message: "Please enter a valid email address." });
      }
      if (code === "auth/invalid-password") {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
      }
      throw error;
    }

    const customToken = await adminAuth.createCustomToken(createdUser.uid);

    return res.status(201).json({
      uid: createdUser.uid,
      email: createdUser.email || normalizedEmail,
      customToken
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to register auth account: ${getErrorMessage(error)}`);
    return res.status(500).json({
      message: "Failed to register auth account",
      error: getErrorMessage(error)
    });
  }
});

app.post("/api/admin/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    if (!isAllowedAdminEmail(normalizedEmail)) {
      return res.status(403).json({ message: "This account is not authorized for admin access" });
    }

    if (!adminPasswords.has(password)) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    try {
      await ensureAdminAccountRecord(normalizedEmail, password);
    } catch (error) {
      // Allow admin login to proceed even if Firebase Auth user provisioning fails.
      // This dashboard login uses backend session tokens, not Firebase ID tokens.
      // eslint-disable-next-line no-console
      console.error("Admin account sync failed during login:", error);
    }

    const sessionToken = await createPersistedAdminSession(normalizedEmail);

    return res.json({
      sessionToken,
      email: normalizedEmail
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login as admin", error });
  }
});

app.post("/api/admin/firebase-login", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const normalizedEmail = (decoded.email || "").trim().toLowerCase();
    const adminName = (decoded.name || "Tasko Admin").trim();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Google account email is required for admin access" });
    }

    if (!isAllowedAdminEmail(normalizedEmail)) {
      return res.status(403).json({ message: "This account is not authorized for admin access" });
    }

    try {
      await syncAdminAccessRecord({
        uid: decoded.uid,
        email: normalizedEmail,
        name: adminName
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Admin account sync failed during Firebase login:", error);
    }

    const sessionToken = await createPersistedAdminSession(normalizedEmail);

    return res.json({
      sessionToken,
      email: normalizedEmail,
      name: adminName
    });
  } catch (error) {
    return res.status(401).json({ message: "Failed to login with Google", error: getErrorMessage(error) });
  }
});

app.post("/api/admin/session/validate", (req: Request, res: Response) => {
  const { sessionToken } = req.body as { sessionToken?: string };
  if (!sessionToken) {
    return res.status(400).json({ message: "sessionToken is required" });
  }

  if (!isValidAdminSession(sessionToken)) {
    return res.status(401).json({ message: "Admin session is invalid or expired" });
  }

  return res.json({ valid: true });
});

app.post("/api/admin/logout", (req: Request, res: Response) => {
  const { sessionToken } = req.body as { sessionToken?: string };
  if (sessionToken) {
    clearAdminSession(sessionToken);
  }
  return res.json({ message: "Logged out" });
});

registerWorkerHiringRoutes(app, {
  validateAdminSession: (sessionToken) => isValidAdminSession(sessionToken)
});

registerTaskoMartRoutes(app, {
  validateAdminSession: (sessionToken) => isValidAdminSession(sessionToken)
});
registerPackageRoutes(app);

app.get("/api/services", async (req: Request, res: Response) => {
  const limit = readQueryLimit(req.query.limit, 20, 100);
  const cacheKey = `services:limit:${limit}`;
  const cachedServices = getDashboardReadCache<Array<Record<string, unknown>>>(cacheKey);
  if (cachedServices) {
    return res.json(cachedServices);
  }

  try {
    const snapshot = await db.collection("services").limit(limit).get();
    const services = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setDashboardReadCache(cacheKey, services);
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch services", error });
  }
});

app.post("/api/users/register", async (req: Request, res: Response) => {
  try {
    const { uid, name, email, mobile, number, address } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ message: "uid and email are required" });
    }
    const normalizedNumber =
      typeof number === "string"
        ? number.trim()
        : typeof mobile === "string"
          ? mobile.trim()
          : "";
    const normalizedAddress = typeof address === "string" ? address.trim() : "";

    await db.collection("users").doc(uid).set(
      {
        uid,
        name: name || "",
        mail: email,
        number: normalizedNumber,
        mobile: normalizedNumber,
        address: normalizedAddress,
        email,
        role: "user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    clearDashboardReadCache("users:");
    clearAdminAnalyticsCache();

    return res.status(201).json({ message: "User saved", role: "user" });
  } catch (error) {
    if (isFirestoreUnavailableError(error)) {
      const now = new Date().toISOString();
      const fallbackNumber =
        typeof req.body.number === "string"
          ? req.body.number.trim()
          : typeof req.body.mobile === "string"
            ? req.body.mobile.trim()
            : "";
      const existingUser = inMemoryUsers.get(req.body.uid);
      const existingCreatedAt =
        existingUser && Object.prototype.hasOwnProperty.call(existingUser, "createdAt")
          ? existingUser.createdAt
          : now;

      inMemoryUsers.set(req.body.uid, {
        ...(existingUser || {}),
        uid: req.body.uid,
        name: req.body.name || "",
        mail: req.body.email,
        number: fallbackNumber,
        mobile: fallbackNumber,
        address: typeof req.body.address === "string" ? req.body.address.trim() : "",
        email: req.body.email,
        role: "user",
        createdAt: existingCreatedAt,
        updatedAt: now
      });
      clearDashboardReadCache("users:");
      clearAdminAnalyticsCache();

      return res.status(201).json({ message: "User saved", role: "user" });
    }

    // eslint-disable-next-line no-console
    console.error("Failed to register user:", error);
    return res.status(500).json({
      message: "Failed to register user",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/api/users", async (req: Request, res: Response) => {
  const userId = readQueryText(req.query.userId);
  if (userId) {
    const singleUserCacheKey = `users:single:${userId}`;
    const cachedSingleUser = getDashboardReadCache<Array<Record<string, unknown>>>(singleUserCacheKey);
    if (cachedSingleUser) {
      return res.json(cachedSingleUser);
    }

    try {
      const userDocument = await db.collection("users").doc(userId).get();
      if (userDocument.exists) {
        const payload = [{ id: userDocument.id, ...userDocument.data() }];
        setDashboardReadCache(singleUserCacheKey, payload);
        return res.json(payload);
      }
      const inMemoryUser = inMemoryUsers.get(userId);
      const payload = inMemoryUser ? [{ id: userId, ...inMemoryUser }] : [];
      setDashboardReadCache(singleUserCacheKey, payload);
      return res.json(payload);
    } catch (error) {
      const inMemoryUser = inMemoryUsers.get(userId);
      return sendDashboardReadFallback(res, "/api/users", inMemoryUser ? [{ id: userId, ...inMemoryUser }] : [], error);
    }
  }

  const limit = readQueryLimit(req.query.limit, 20, 100);
  const allUsersCacheKey = `users:all:limit:${limit}`;
  const cachedUsers = getDashboardReadCache<Array<Record<string, unknown>>>(allUsersCacheKey);
  if (cachedUsers) {
    return res.json(cachedUsers);
  }

  try {
    const snapshot = await db.collection("users").limit(limit).get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setDashboardReadCache(allUsersCacheKey, users);
    return res.json(users);
  } catch (error) {
    return sendDashboardReadFallback(res, "/api/users", toInMemoryUserList(), error);
  }
});

app.get("/api/admin/users", async (req: Request, res: Response) => {
  if (!ensureValidAdminSessionRequest(req, res)) {
    return;
  }

  const limit = readQueryLimit(req.query.limit, 100, 250);
  const normalizeText = (value: unknown) => readQueryText(value);
  const normalizeDateText = (value: unknown) => {
    const text = normalizeText(value);
    if (!text) return "";
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  };
  const toDateValue = (value: string) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  try {
    const [usersResult, bookingsResult, taskoMartOrdersResult, packagesResult] = await Promise.allSettled([
      db.collection("users").limit(limit).get(),
      db.collection("bookings").get(),
      db.collection("taskomart_orders").get(),
      db.collection("packages").get()
    ]);

    const usersRaw: Array<Record<string, unknown>> =
      usersResult.status === "fulfilled"
        ? usersResult.value.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Record<string, unknown>)
          }))
        : toInMemoryUserList().slice(0, limit);
    const bookingsRaw: Array<Record<string, unknown>> =
      bookingsResult.status === "fulfilled"
        ? bookingsResult.value.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Record<string, unknown>)
          }))
        : [];
    const taskoMartOrdersRaw: Array<Record<string, unknown>> =
      taskoMartOrdersResult.status === "fulfilled"
        ? taskoMartOrdersResult.value.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Record<string, unknown>)
          }))
        : [];
    const packagesRaw: Array<Record<string, unknown>> =
      packagesResult.status === "fulfilled"
        ? packagesResult.value.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Record<string, unknown>)
          }))
        : [];
    const packageNameById = new Map<string, string>(
      packagesRaw
        .map((record) => {
          const packageId = normalizeText(record.package_id || record.id);
          const packageName =
            normalizeText(record.package_name || record.name || record.title) || `Package ${packageId || "-"}`;
          return [packageId, packageName] as const;
        })
        .filter(([packageId]) => packageId)
    );

    const users = usersRaw
      .map((record) => {
        const uid = normalizeText(record.uid || record.id);
        const role = normalizeText(record.role).toLowerCase();
        if (!uid) return null;
        if (role === "worker" || role === "admin") return null;

        const name =
          normalizeText(record.name || record.full_name || record.fullName) ||
          normalizeText(record.email || record.mail) ||
          uid;
        const email = normalizeText(record.email || record.mail);
        const phone = normalizeText(record.mobile || record.number || record.phone);
        const address = normalizeText(record.address);
        const createdAt = normalizeDateText(record.createdAt || record.created_at);
        const updatedAt = normalizeDateText(record.updatedAt || record.updated_at);

        const serviceBookings = bookingsRaw
          .filter((booking) => normalizeText(booking.userId || booking.user_id) === uid)
          .map((booking) => {
            const bookingType = normalizeText(booking.booking_type || booking.bookingType || booking.serviceType || booking.planType);
            const packageId = normalizeText(booking.packageId || booking.package_id);
            return {
              bookingId: normalizeText(booking.booking_id || booking.bookingId || booking.id),
              category: normalizeText(
                booking.serviceCategory ||
                  booking.service_category ||
                  booking.service_category_name ||
                  booking.service_category_id ||
                  booking.category
              ),
              subCategory: normalizeText(
                booking.subCategory ||
                  booking.sub_category ||
                  booking.sub_category_name ||
                  booking.sub_category_id ||
                  booking.category
              ),
              bookingType: bookingType === "package" ? "package" : "one-time",
              status: normalizeText(booking.status) || "pending",
              serviceDate: normalizeDateText(booking.booking_date || booking.serviceDate || booking.date),
              packageId,
              packageName: packageId ? packageNameById.get(packageId) || `Package ${packageId}` : "",
              address: normalizeText(booking.address || booking.serviceAddress || booking.service_address || address)
            };
          })
          .sort((left, right) => toDateValue(right.serviceDate) - toDateValue(left.serviceDate));

        const taskoMartOrders = taskoMartOrdersRaw
          .filter((order) => {
            const orderUserId = normalizeText(order.userId);
            const orderEmail = normalizeText(order.userEmail).toLowerCase();
            const orderPhone = normalizeText(order.userPhone);
            if (orderUserId && orderUserId === uid) return true;
            if (email && orderEmail && orderEmail === email.toLowerCase()) return true;
            if (phone && orderPhone && orderPhone === phone) return true;
            return false;
          })
          .map((order) => ({
            orderId: normalizeText(order.orderId || order.id),
            totalAmount: Number.isFinite(Number(order.totalAmount)) ? Number(order.totalAmount) : 0,
            orderStatus: normalizeText(order.orderStatus) || "pending",
            paymentStatus: normalizeText(order.paymentStatus) || "pending",
            orderDate: normalizeDateText(order.orderDate || order.createdAt),
            deliveryAddress: normalizeText(order.deliveryAddress || address)
          }))
          .sort((left, right) => toDateValue(right.orderDate) - toDateValue(left.orderDate));

        const packageMap = new Map<string, { packageId: string; packageName: string; bookingCount: number; lastBookedAt: string }>();
        serviceBookings
          .filter((booking) => booking.bookingType === "package" && booking.packageId)
          .forEach((booking) => {
            const packageKey = booking.packageId;
            const current = packageMap.get(packageKey) || {
              packageId: booking.packageId,
              packageName: booking.packageName || `Package ${booking.packageId}`,
              bookingCount: 0,
              lastBookedAt: ""
            };
            current.bookingCount += 1;
            if (toDateValue(booking.serviceDate) > toDateValue(current.lastBookedAt)) {
              current.lastBookedAt = booking.serviceDate;
            }
            packageMap.set(packageKey, current);
          });

        const packages = Array.from(packageMap.values()).sort(
          (left, right) => toDateValue(right.lastBookedAt) - toDateValue(left.lastBookedAt)
        );
        const latestActivity = Math.max(
          toDateValue(updatedAt),
          toDateValue(createdAt),
          toDateValue(serviceBookings[0]?.serviceDate || ""),
          toDateValue(taskoMartOrders[0]?.orderDate || "")
        );

        return {
          id: uid,
          uid,
          name,
          email,
          phone,
          address,
          role: role || "user",
          createdAt,
          updatedAt,
          orderCount: serviceBookings.length + taskoMartOrders.length,
          serviceBookingCount: serviceBookings.length,
          taskoMartOrderCount: taskoMartOrders.length,
          packageCount: packages.length,
          packageNames: packages.map((item) => item.packageName),
          latestActivityAt: latestActivity ? new Date(latestActivity).toISOString() : "",
          serviceBookings,
          taskoMartOrders,
          packages
        };
      })
      .filter((record): record is NonNullable<typeof record> => record !== null)
      .sort((left, right) => toDateValue(right.latestActivityAt) - toDateValue(left.latestActivityAt));

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch admin users",
      error: getErrorMessage(error)
    });
  }
});

app.post("/api/bookings", async (req: Request, res: Response) => {
  try {
    const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

    const userId = readText(req.body.userId);
    const serviceCategory = readText(req.body.serviceCategory) || readText(req.body.category);
    const subCategory = readText(req.body.subCategory) || readText(req.body.category);
    const serviceDate = readText(req.body.serviceDate) || readText(req.body.date);
    const preferredTimeSlot = readText(req.body.preferredTimeSlot) || readText(req.body.time);
    const workDescription = readText(req.body.workDescription);
    const duration = readText(req.body.duration);
    const normalizedServiceType = (readText(req.body.serviceType) || readText(req.body.planType) || "one-time").toLowerCase();
    const serviceType = normalizedServiceType === "package" ? "package" : "one-time";
    const packageId = readText(req.body.packageId);
    const recurringDays = serviceType === "package" ? readText(req.body.recurringDays) : "";
    const specialInstructions = readText(req.body.specialInstructions) || readText(req.body.notes);
    const directAddress = readText(req.body.address) || readText(req.body.serviceAddress);
    let userName = readText(req.body.userName);
    let userEmail = readText(req.body.userEmail);
    let userPhone = readText(req.body.userPhone) || readText(req.body.mobile) || readText(req.body.number);

    if (!userId || !serviceCategory || !subCategory || !serviceDate || !preferredTimeSlot) {
      return res
        .status(400)
        .json({ message: "userId, serviceCategory, subCategory, serviceDate and preferredTimeSlot are required" });
    }

    if (serviceType === "package" && !packageId) {
      return res.status(400).json({ message: "packageId is required when serviceType is package" });
    }

    if (serviceType === "package" && !recurringDays) {
      return res.status(400).json({ message: "recurringDays is required when serviceType is package" });
    }

    let address = directAddress;
    if (!address && userId) {
      const inMemoryUser = inMemoryUsers.get(userId);
      if (inMemoryUser) {
        address = address || readText(inMemoryUser.address);
        userName = userName || readText(inMemoryUser.name);
        userEmail = userEmail || readText(inMemoryUser.email) || readText(inMemoryUser.mail);
        userPhone = userPhone || readText(inMemoryUser.mobile) || readText(inMemoryUser.number);
      }

      try {
        if (!address || !userName || !userEmail || !userPhone) {
          const userDoc = await db.collection("users").doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data() || {};
            address = address || readText(userData.address);
            userName = userName || readText(userData.name);
            userEmail = userEmail || readText(userData.email) || readText(userData.mail);
            userPhone = userPhone || readText(userData.mobile) || readText(userData.number);
          }
        }
      } catch (error) {
        if (!isFirestoreUnavailableError(error)) {
          // eslint-disable-next-line no-console
          console.warn("Failed to fetch user address for booking:", error);
        }
      }

      if (!address) {
        address = readText(inMemoryUser?.address);
      }
    }

    const bookingRef = db.collection("bookings").doc();
    await bookingRef.set({
      booking_id: bookingRef.id,
      user_id: userId,
      service_category_id: serviceCategory,
      sub_category_id: subCategory,
      booking_date: serviceDate,
      time_slot: preferredTimeSlot,
      address,
      booking_type: serviceType,
      assigned_worker_id: "",
      created_at: timestamp(),
      userId,
      serviceCategory,
      subCategory,
      serviceType,
      workDescription,
      serviceDate,
      preferredTimeSlot,
      duration,
      recurringDays,
      specialInstructions,
      category: subCategory || serviceCategory,
      date: serviceDate,
      time: preferredTimeSlot,
      notes: specialInstructions,
      planType: serviceType,
      packageId: serviceType === "package" ? packageId : "",
      bookingId: bookingRef.id,
      bookingDate: serviceDate,
      timeSlot: preferredTimeSlot,
      bookingType: serviceType,
      assignedWorkerId: "",
      assignedWorkerName: "",
      assigned_worker_name: "",
      assignedWorkerPhone: "",
      assigned_worker_phone: "",
      userName,
      user_name: userName,
      userEmail,
      user_email: userEmail,
      userPhone,
      user_phone: userPhone,
      status: "pending",
      createdAt: timestamp()
    });
    clearDashboardReadCache("bookings:");
    clearAdminAnalyticsCache();

    return res.status(201).json({ id: bookingRef.id, bookingId: bookingRef.id, message: "Booking created" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create booking", error });
  }
});

app.get("/api/bookings", async (req: Request, res: Response) => {
  const userIdParam = readQueryText(req.query.userId);
  const workerIdParam = readQueryText(req.query.workerId);
  const limit = readQueryLimit(req.query.limit, 20, 100);
  const cacheKey = `bookings:user:${userIdParam || "*"}:worker:${workerIdParam || "*"}:limit:${limit}`;
  const cachedBookings = getDashboardReadCache<Array<Record<string, unknown>>>(cacheKey);
  if (cachedBookings) {
    return res.json(cachedBookings);
  }

  try {
    let query: Query = db.collection("bookings");

    if (userIdParam) {
      query = query.where("userId", "==", userIdParam);
    }

    if (workerIdParam) {
      query = query.where("assignedWorkerId", "==", workerIdParam);
    }

    const snapshot = await query.limit(limit).get();
    const bookings = snapshot.docs.map((doc) => {
      const data = doc.data();
      const bookingId =
        typeof data.booking_id === "string" && data.booking_id.trim()
          ? data.booking_id.trim()
          : typeof data.bookingId === "string" && data.bookingId.trim()
          ? data.bookingId.trim()
          : doc.id;
      const assignedWorkerName =
        typeof data.assignedWorkerName === "string"
          ? data.assignedWorkerName
          : typeof data.assigned_worker_name === "string"
            ? data.assigned_worker_name
            : "";
      const assignedWorkerPhone =
        typeof data.assignedWorkerPhone === "string"
          ? data.assignedWorkerPhone
          : typeof data.assigned_worker_phone === "string"
            ? data.assigned_worker_phone
            : "";
      const normalizedUserName =
        typeof data.userName === "string"
          ? data.userName
          : typeof data.user_name === "string"
            ? data.user_name
            : "";
      const normalizedUserPhone =
        typeof data.userPhone === "string"
          ? data.userPhone
          : typeof data.user_phone === "string"
            ? data.user_phone
            : "";
      const normalizedUserEmail =
        typeof data.userEmail === "string"
          ? data.userEmail
          : typeof data.user_email === "string"
            ? data.user_email
            : "";

      return {
        id: doc.id,
        ...data,
        booking_id: bookingId,
        bookingId,
        assignedWorkerName,
        assigned_worker_name: assignedWorkerName,
        assignedWorkerPhone,
        assigned_worker_phone: assignedWorkerPhone,
        userName: normalizedUserName,
        user_name: normalizedUserName,
        userPhone: normalizedUserPhone,
        user_phone: normalizedUserPhone,
        userEmail: normalizedUserEmail,
        user_email: normalizedUserEmail
      };
    });
    setDashboardReadCache(cacheKey, bookings);
    return res.json(bookings);
  } catch (error) {
    return sendDashboardReadFallback(res, "/api/bookings", [], error);
  }
});

app.patch("/api/bookings/:bookingId/status", async (req: Request, res: Response) => {
  try {
    const bookingId = readRouteParam(req.params.bookingId);
    const { status } = req.body as { status?: string };
    const normalizedStatus =
      typeof status === "string"
        ? status
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_")
        : "";
    const allowedStatuses = ["pending", "assigned", "in_progress", "completed", "cancelled"];

    if (!bookingId) {
      return res.status(400).json({ message: "bookingId is required" });
    }

    if (!normalizedStatus || !allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid booking status" });
    }

    await db.collection("bookings").doc(bookingId).set(
      {
        status: normalizedStatus,
        updatedAt: timestamp(),
        updated_at: timestamp()
      },
      { merge: true }
    );
    clearDashboardReadCache("bookings:");

    return res.json({ message: "Booking status updated" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update booking status", error });
  }
});

app.post("/api/workers/register", async (req: Request, res: Response) => {
  return res.status(410).json({
    message: "Worker self-registration is removed. Use /api/worker-applications to submit hiring applications."
  });
});

app.get("/api/workers", async (req: Request, res: Response) => {
  const limit = readQueryLimit(req.query.limit, 20, 100);
  const cacheKey = `workers:all:limit:${limit}`;
  const cachedWorkers = getDashboardReadCache<Array<Record<string, unknown>>>(cacheKey);
  if (cachedWorkers) {
    return res.json(cachedWorkers);
  }

  try {
    const snapshot = await db.collection("workers").limit(limit).get();
    const workers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setDashboardReadCache(cacheKey, workers);
    return res.json(workers);
  } catch (error) {
    return sendDashboardReadFallback(res, "/api/workers", toInMemoryWorkerList(), error);
  }
});

app.get("/api/admin/worker-requests", async (_req: Request, res: Response) => {
  return res.status(410).json({
    message: "Legacy worker request endpoint removed. Use /api/admin/worker-applications."
  });
});

app.get("/api/workers/:workerId", async (req: Request, res: Response) => {
  const workerId = readRouteParam(req.params.workerId);
  const inMemoryWorker = inMemoryWorkers.get(workerId);

  try {
    const workerDoc = await db.collection("workers").doc(workerId).get();
    if (!workerDoc.exists) {
      if (inMemoryWorker) {
        return res.json({ id: workerId, ...inMemoryWorker });
      }
      return res.status(404).json({ message: "Worker not found" });
    }

    return res.json({ id: workerDoc.id, ...workerDoc.data() });
  } catch (error) {
    if (inMemoryWorker) {
      return res.json({ id: workerId, ...inMemoryWorker });
    }
    return res.status(500).json({ message: "Failed to fetch worker", error });
  }
});

app.patch("/api/workers/:workerId/approval", async (req: Request, res: Response) => {
  return res.status(410).json({
    message: "Legacy worker approval endpoint is removed. Use admin worker application review endpoints."
  });
});

app.patch("/api/workers/:workerId/status", async (req: Request, res: Response) => {
  try {
    const workerId = readRouteParam(req.params.workerId);
    const { online } = req.body;
    if (typeof online !== "boolean") {
      return res.status(400).json({ message: "online must be a boolean" });
    }

    await db.collection("workers").doc(workerId).update({
      online,
      updatedAt: timestamp()
    });
    clearDashboardReadCache("workers:");

    const inMemoryWorker = inMemoryWorkers.get(workerId);
    if (inMemoryWorker) {
      inMemoryWorkers.set(workerId, {
        ...inMemoryWorker,
        online,
        updatedAt: new Date().toISOString()
      });
    }

    return res.json({ message: "Worker availability updated" });
  } catch (error) {
    if (isFirestoreUnavailableError(error)) {
      const workerId = readRouteParam(req.params.workerId);
      const { online } = req.body as { online?: boolean };
      const inMemoryWorker = inMemoryWorkers.get(workerId);
      if (!inMemoryWorker) {
        return res.status(404).json({ message: "Worker not found" });
      }
      inMemoryWorkers.set(workerId, {
        ...inMemoryWorker,
        online,
        updatedAt: new Date().toISOString()
      });
      clearDashboardReadCache("workers:");
      return res.json({ message: "Worker availability updated" });
    }

    return res.status(500).json({ message: "Failed to update worker status", error });
  }
});

app.get("/api/workers/:workerId/jobs", async (req: Request, res: Response) => {
  try {
    const limit = readQueryLimit(req.query.limit, 20, 100);
    const snapshot = await db
      .collection("bookings")
      .where("assignedWorkerId", "==", req.params.workerId)
      .limit(limit)
      .get();

    const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(jobs);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch assigned jobs", error });
  }
});

app.post("/api/jobs/assign", async (req: Request, res: Response) => {
  try {
    const bookingId = typeof req.body.bookingId === "string" ? req.body.bookingId.trim() : "";
    const workerId = typeof req.body.workerId === "string" ? req.body.workerId.trim() : "";
    if (!bookingId || !workerId) {
      return res.status(400).json({ message: "bookingId and workerId are required" });
    }

    const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    let assignedWorkerName = "";
    let assignedWorkerPhone = "";
    const inMemoryWorker = inMemoryWorkers.get(workerId);
    if (inMemoryWorker) {
      assignedWorkerName =
        readText(inMemoryWorker.full_name) || readText(inMemoryWorker.name) || readText(inMemoryWorker.worker_id);
      assignedWorkerPhone =
        readText(inMemoryWorker.mobile) || readText(inMemoryWorker.number) || readText(inMemoryWorker.phone);
    }

    if (!assignedWorkerName || !assignedWorkerPhone) {
      try {
        const workerDoc = await db.collection("workers").doc(workerId).get();
        if (workerDoc.exists) {
          const workerData = workerDoc.data() || {};
          assignedWorkerName =
            assignedWorkerName ||
            readText(workerData.full_name) ||
            readText(workerData.name) ||
            readText(workerData.worker_id);
          assignedWorkerPhone =
            assignedWorkerPhone ||
            readText(workerData.mobile) ||
            readText(workerData.number) ||
            readText(workerData.phone);
        }
      } catch (error) {
        if (!isFirestoreUnavailableError(error)) {
          // eslint-disable-next-line no-console
          console.warn("Failed to fetch worker details during assignment:", error);
        }
      }
    }

    await db.collection("bookings").doc(bookingId).set(
      {
        assignedWorkerId: workerId,
        assigned_worker_id: workerId,
        assignedWorkerName,
        assigned_worker_name: assignedWorkerName,
        assignedWorkerPhone,
        assigned_worker_phone: assignedWorkerPhone,
        status: "assigned",
        assignedAt: timestamp(),
        assigned_at: timestamp(),
        updatedAt: timestamp(),
        updated_at: timestamp()
      },
      { merge: true }
    );
    clearDashboardReadCache("bookings:");

    return res.json({ message: "Job assigned" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to assign job", error });
  }
});

app.get("/api/admin/analytics", async (_req: Request, res: Response) => {
  const cachedAnalytics = getAdminAnalyticsCache();
  if (cachedAnalytics) {
    return res.json(cachedAnalytics);
  }

  try {
    const [usersCountSnapshot, workersCountSnapshot, bookingsCountSnapshot, pendingWorkersSnapshot] = await Promise.all([
      db.collection("users").count().get(),
      db.collection("workers").count().get(),
      db.collection("bookings").count().get(),
      db.collection("workers").where("status", "==", "pending").count().get()
    ]);

    const payload = {
      userCount: Number(usersCountSnapshot.data().count || 0),
      workerCount: Number(workersCountSnapshot.data().count || 0),
      bookingCount: Number(bookingsCountSnapshot.data().count || 0),
      pendingWorkers: Number(pendingWorkersSnapshot.data().count || 0)
    };
    setAdminAnalyticsCache(payload);

    return res.json(payload);
  } catch (error) {
    const memoryWorkers = toInMemoryWorkerList();
    const pendingWorkers = memoryWorkers.filter((worker) => worker.status === "pending").length;

    return sendDashboardReadFallback(
      res,
      "/api/admin/analytics",
      { userCount: inMemoryUsers.size, workerCount: memoryWorkers.length, bookingCount: 0, pendingWorkers },
      error
    );
  }
});

async function runStartupTasks(): Promise<void> {
  const startupTasks: Array<{ label: string; run: () => Promise<void> }> = [
    { label: "load persisted admin sessions", run: loadPersistedAdminSessions },
    { label: "ensure admin account", run: ensureAdminAccount },
    { label: "ensure package bootstrap data", run: ensurePackagesBootstrapData }
  ];

  for (const task of startupTasks) {
    try {
      await task.run();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Startup task failed (${task.label}):`, error);
    }
  }
}

function startServer() {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Tasko backend running on http://localhost:${port}`);
    void runStartupTasks();
  });
}

startServer();
