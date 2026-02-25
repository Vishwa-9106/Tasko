import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { Query } from "firebase-admin/firestore";
import { auth as adminAuth, db, timestamp } from "./firebaseAdmin";

dotenv.config();

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

app.use(
  cors({
    origin: allowedOrigins
  })
);
app.use(express.json());

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
    return false;
  }

  return true;
}

function clearAdminSession(sessionToken: string): void {
  adminSessions.delete(sessionToken);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    uid,
    email,
    name,
    role,
    updatedAt: now
  };

  if (!userDoc.exists) {
    payload.createdAt = now;
  }

  if (role === "worker") {
    const workerDoc = await db.collection("workers").doc(uid).get();
    payload.workerStatus = workerDoc.data()?.status || "pending";
  }

  await userRef.set(payload, { merge: true });
}

async function resolveRole(uid: string): Promise<RoleType> {
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

  await db
    .collection("users")
    .doc(adminUser.uid)
    .set(
      {
        uid: adminUser.uid,
        email: normalizedEmail,
        name: "Tasko Admin",
        role: "admin",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      { merge: true }
    );
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
    const { uid, name, email } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ message: "uid and email are required" });
    }

    await db.collection("users").doc(uid).set(
      {
        uid,
        name: name || "",
        email,
        role: "user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    return res.status(201).json({ message: "User saved", role: "user" });
  } catch (error) {
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
    return sendDashboardReadFallback(res, "/api/users", [], error);
  }
});

app.post("/api/bookings", async (req: Request, res: Response) => {
  try {
    const { userId, category, date, time, notes } = req.body;
    if (!userId || !category || !date || !time) {
      return res.status(400).json({ message: "userId, category, date and time are required" });
    }

    const bookingRef = await db.collection("bookings").add({
      userId,
      category,
      date,
      time,
      notes: notes || "",
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

app.post("/api/workers/register", async (req: Request, res: Response) => {
  try {
    const { firebaseUid, name, mobile, email, categories, assessment } = req.body;
    if (!firebaseUid || !name || !mobile || !email) {
      return res.status(400).json({ message: "firebaseUid, name, mobile and email are required" });
    }

    const normalizedCategories = Array.isArray(categories)
      ? categories.filter((category) => typeof category === "string" && category.trim().length > 0)
      : [];

    const normalizedAssessment =
      assessment && typeof assessment === "object"
        ? {
            ...assessment,
            reviewedByAdmin: false
          }
        : null;

    await Promise.all([
      db.collection("workers").doc(firebaseUid).set(
        {
          firebaseUid,
          name,
          mobile,
          email,
          categories: normalizedCategories,
          primaryCategory: normalizedCategories[0] || "",
          assessment: normalizedAssessment,
          role: "worker",
          status: "pending",
          online: false,
          createdAt: timestamp(),
          updatedAt: timestamp()
        },
        { merge: true }
      ),
      db.collection("users").doc(firebaseUid).set(
        {
          uid: firebaseUid,
          name,
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

    return res.status(201).json({ workerId: firebaseUid, status: "pending", role: "worker" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to register worker", error });
  }
});

app.get("/api/workers", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("workers").get();
    const workers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(workers);
  } catch (error) {
    return sendDashboardReadFallback(res, "/api/workers", [], error);
  }
});

app.get("/api/admin/worker-requests", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("workers").where("status", "==", "pending").get();
    const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(requests);
  } catch (error) {
    return sendDashboardReadFallback(res, "/api/admin/worker-requests", [], error);
  }
});

app.get("/api/workers/:workerId", async (req: Request, res: Response) => {
  try {
    const workerId = readRouteParam(req.params.workerId);
    const workerDoc = await db.collection("workers").doc(workerId).get();
    if (!workerDoc.exists) {
      return res.status(404).json({ message: "Worker not found" });
    }

    return res.json({ id: workerDoc.id, ...workerDoc.data() });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch worker", error });
  }
});

app.patch("/api/workers/:workerId/approval", async (req: Request, res: Response) => {
  try {
    const workerId = readRouteParam(req.params.workerId);
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be approved or rejected" });
    }

    await Promise.all([
      db.collection("workers").doc(workerId).update({
        status,
        reviewedAt: timestamp()
      }),
      db.collection("users").doc(workerId).set(
        {
          role: "worker",
          workerStatus: status,
          reviewedAt: timestamp()
        },
        { merge: true }
      )
    ]);

    return res.json({ message: `Worker ${status}` });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update worker approval", error });
  }
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

    return res.json({ message: "Worker availability updated" });
  } catch (error) {
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
    return sendDashboardReadFallback(
      res,
      "/api/admin/analytics",
      { userCount: 0, workerCount: 0, bookingCount: 0, pendingWorkers: 0 },
      error
    );
  }
});

async function startServer() {
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
