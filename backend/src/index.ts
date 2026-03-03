import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { Query } from "firebase-admin/firestore";
import path from "path";
import { auth as adminAuth, db, timestamp } from "./firebaseAdmin";
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

app.use(
  cors({
    origin: allowedOrigins
  })
);
// The apply form sends two base64 documents in one JSON payload.
// 25mb allows both documents plus JSON overhead without tripping 413.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

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
  return (
    message.includes("5 NOT_FOUND") ||
    message.includes("database (default) does not exist") ||
    message.includes("The caller does not have permission")
  );
}

function toInMemoryWorkerList(): Array<Record<string, unknown>> {
  return Array.from(inMemoryWorkers.entries()).map(([id, worker]) => ({ id, ...worker }));
}

function toInMemoryUserList(): Array<Record<string, unknown>> {
  return Array.from(inMemoryUsers.entries()).map(([id, user]) => ({ id, ...user }));
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

    return res.json({
      sessionToken,
      email: normalizedEmail
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login as admin", error });
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

app.get("/api/services", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("services").get();
    const services = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch services", error });
  }
});

app.get("/api/packages", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("packages").get();
    const packages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch packages", error });
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

app.get("/api/users", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(users);
  } catch (error) {
    return sendDashboardReadFallback(res, "/api/users", toInMemoryUserList(), error);
  }
});

app.post("/api/bookings", async (req: Request, res: Response) => {
  try {
    const { userId, category, date, time, notes, planType, packageId } = req.body;
    if (!userId || !category || !date || !time) {
      return res.status(400).json({ message: "userId, category, date and time are required" });
    }

    const bookingRef = await db.collection("bookings").add({
      userId,
      category,
      date,
      time,
      notes: notes || "",
      planType: typeof planType === "string" ? planType : "one-time",
      packageId: typeof packageId === "string" ? packageId : "",
      status: "pending",
      createdAt: timestamp()
    });

    return res.status(201).json({ id: bookingRef.id, message: "Booking created" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create booking", error });
  }
});

app.get("/api/bookings", async (req: Request, res: Response) => {
  try {
    const { userId, workerId } = req.query;
    let query: Query = db.collection("bookings");

    if (typeof userId === "string") {
      query = query.where("userId", "==", userId);
    }

    if (typeof workerId === "string") {
      query = query.where("assignedWorkerId", "==", workerId);
    }

    const snapshot = await query.get();
    const bookings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(bookings);
  } catch (error) {
    return sendDashboardReadFallback(res, "/api/bookings", [], error);
  }
});

app.patch("/api/bookings/:bookingId/status", async (req: Request, res: Response) => {
  try {
    const bookingId = readRouteParam(req.params.bookingId);
    const { status } = req.body as { status?: string };
    const allowedStatuses = ["pending", "assigned", "in_progress", "completed", "cancelled"];

    if (!bookingId) {
      return res.status(400).json({ message: "bookingId is required" });
    }

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid booking status" });
    }

    await db.collection("bookings").doc(bookingId).set(
      {
        status,
        updatedAt: timestamp()
      },
      { merge: true }
    );

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

app.get("/api/workers", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("workers").get();
    const workers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
      return res.json({ message: "Worker availability updated" });
    }

    return res.status(500).json({ message: "Failed to update worker status", error });
  }
});

app.get("/api/workers/:workerId/jobs", async (req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection("bookings")
      .where("assignedWorkerId", "==", req.params.workerId)
      .get();

    const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(jobs);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch assigned jobs", error });
  }
});

app.post("/api/jobs/assign", async (req: Request, res: Response) => {
  try {
    const { bookingId, workerId } = req.body;
    if (!bookingId || !workerId) {
      return res.status(400).json({ message: "bookingId and workerId are required" });
    }

    await db.collection("bookings").doc(bookingId).update({
      assignedWorkerId: workerId,
      status: "assigned",
      assignedAt: timestamp()
    });

    return res.json({ message: "Job assigned" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to assign job", error });
  }
});

app.get("/api/admin/analytics", async (_req: Request, res: Response) => {
  try {
    const [users, workers, bookings] = await Promise.all([
      db.collection("users").get(),
      db.collection("workers").get(),
      db.collection("bookings").get()
    ]);

    const pendingWorkers = workers.docs.filter((doc) => doc.data().status === "pending").length;

    return res.json({
      userCount: users.size,
      workerCount: workers.size,
      bookingCount: bookings.size,
      pendingWorkers
    });
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

async function startServer() {
  await loadPersistedAdminSessions();
  await ensureAdminAccount();

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Tasko backend running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start backend:", error);
  process.exit(1);
});
