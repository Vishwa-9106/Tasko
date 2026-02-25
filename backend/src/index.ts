import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { Query } from "firebase-admin/firestore";
import { auth as adminAuth, db, timestamp } from "./firebaseAdmin";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOrigins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];

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
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error });
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
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings", error });
  }
});

app.post("/api/workers/register", async (req: Request, res: Response) => {
  try {
    const { firebaseUid, name, email, categories } = req.body;
    if (!firebaseUid || !name || !email) {
      return res.status(400).json({ message: "firebaseUid, name and email are required" });
    }

    await Promise.all([
      db.collection("workers").doc(firebaseUid).set(
        {
          firebaseUid,
          name,
          email,
          categories: Array.isArray(categories) ? categories : [],
          role: "worker",
          status: "pending",
          online: false,
          createdAt: timestamp()
        },
        { merge: true }
      ),
      db.collection("users").doc(firebaseUid).set(
        {
          uid: firebaseUid,
          name,
          email,
          role: "worker",
          workerStatus: "pending",
          createdAt: timestamp()
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
    res.json(workers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch workers", error });
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
    return res.status(500).json({ message: "Failed to fetch analytics", error });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Tasko backend running on http://localhost:${port}`);
});
