import { useEffect, useMemo, useState } from "react";
import api from "./api";

const ADMIN_LOGIN_EMAIL = "kit27.ad63@gmail.com";
const ADMIN_LOGIN_PASSWORD = "Tasko@123";
const LOGIN_PATH = "/";
const DASHBOARD_PATH = "/dashboard";

function normalizePathname(pathname) {
  return pathname === DASHBOARD_PATH ? DASHBOARD_PATH : LOGIN_PATH;
}

function navigateTo(pathname) {
  const targetPath = normalizePathname(pathname);
  if (window.location.pathname !== targetPath) {
    window.history.pushState({}, "", targetPath);
  }
}

function MetricCard({ label, value }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-panel-700">{value}</p>
    </div>
  );
}

export default function App() {
  const [email, setEmail] = useState(ADMIN_LOGIN_EMAIL);
  const [password, setPassword] = useState(ADMIN_LOGIN_PASSWORD);
  const [token, setToken] = useState(localStorage.getItem("tasko_admin_session_token") || "");
  const [pathname, setPathname] = useState(() => normalizePathname(window.location.pathname));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [analytics, setAnalytics] = useState({
    userCount: 0,
    workerCount: 0,
    bookingCount: 0,
    pendingWorkers: 0
  });
  const [workers, setWorkers] = useState([]);
  const [workerRequests, setWorkerRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [assignSelection, setAssignSelection] = useState({});

  const approvedWorkers = useMemo(() => workers.filter((worker) => worker.status === "approved"), [workers]);

  useEffect(() => {
    const onPopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (token && pathname !== DASHBOARD_PATH) {
      navigateTo(DASHBOARD_PATH);
      setPathname(DASHBOARD_PATH);
      return;
    }

    if (!token && pathname !== LOGIN_PATH) {
      navigateTo(LOGIN_PATH);
      setPathname(LOGIN_PATH);
    }
  }, [token, pathname]);

  const loadDashboard = async () => {
    const [analyticsRes, workersRes, workerRequestsRes, usersRes, bookingsRes] = await Promise.all([
      api.get("/api/admin/analytics"),
      api.get("/api/workers"),
      api.get("/api/admin/worker-requests"),
      api.get("/api/users"),
      api.get("/api/bookings")
    ]);

    setAnalytics(analyticsRes.data);
    setWorkers(workersRes.data);
    setWorkerRequests(workerRequestsRes.data);
    setUsers(usersRes.data);
    setBookings(bookingsRes.data);
  };

  useEffect(() => {
    if (!token) return;
    const validateAndLoad = async () => {
      await api.post("/api/admin/session/validate", { sessionToken: token });
      await loadDashboard();
    };

    validateAndLoad().catch(async () => {
      setError("Admin session is invalid or expired");
      await logout();
    });
  }, [token]);

  const login = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/api/admin/login", {
        email: email.trim().toLowerCase(),
        password
      });
      const sessionToken = response.data.sessionToken;
      if (!sessionToken) {
        throw new Error("Missing admin session token");
      }
      localStorage.setItem("tasko_admin_session_token", sessionToken);
      setToken(sessionToken);
      navigateTo(DASHBOARD_PATH);
      setPathname(DASHBOARD_PATH);
      await loadDashboard();
    } catch (loginError) {
      setError(loginError.response?.data?.message || "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  const updateWorkerApproval = async (workerId, status) => {
    await api.patch(`/api/workers/${workerId}/approval`, { status });
    await loadDashboard();
  };

  const assignJob = async (bookingId) => {
    const workerId = assignSelection[bookingId];
    if (!workerId) return;

    await api.post("/api/jobs/assign", {
      bookingId,
      workerId
    });
    await loadDashboard();
  };

  const logout = async () => {
    await api.post("/api/admin/logout", { sessionToken: token }).catch(() => {});
    localStorage.removeItem("tasko_admin_session_token");
    setToken("");
    navigateTo(LOGIN_PATH);
    setPathname(LOGIN_PATH);
  };

  if (!token || pathname !== DASHBOARD_PATH) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="card">
          <h1 className="mb-4 text-2xl font-bold text-panel-700">Tasko Admin Login</h1>
          <p className="mb-4 text-sm text-slate-600">Authorized account: {ADMIN_LOGIN_EMAIL}</p>
          <p className="mb-4 text-sm text-slate-600">Default password: {ADMIN_LOGIN_PASSWORD}</p>
          <form className="space-y-3" onSubmit={login}>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin email"
              required
            />
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-panel-700">Tasko Admin Dashboard</h1>
          <p className="text-sm text-slate-600">Manage workers, users, bookings, and assignments.</p>
        </div>
        <button type="button" className="btn btn-soft" onClick={logout}>
          Logout
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Users" value={analytics.userCount} />
        <MetricCard label="Workers" value={analytics.workerCount} />
        <MetricCard label="Bookings" value={analytics.bookingCount} />
        <MetricCard label="Pending Workers" value={analytics.pendingWorkers} />
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-xl font-semibold">Worker Requests</h2>
        {workerRequests.length === 0 ? (
          <p className="text-sm text-slate-600">No pending worker requests.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-100 text-slate-500">
                <th className="py-2">Name</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Category</th>
                <th>Test Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workerRequests.map((worker) => (
                <tr key={worker.id} className="border-b border-emerald-50">
                  <td className="py-2">{worker.name}</td>
                  <td>{worker.mobile || "-"}</td>
                  <td>{worker.email}</td>
                  <td>{worker.primaryCategory || worker.categories?.[0] || "-"}</td>
                  <td>
                    {worker.assessment?.totalQuestions
                      ? `${worker.assessment.score}/${worker.assessment.totalQuestions} (${worker.assessment.percentage || 0}%)`
                      : "-"}
                  </td>
                  <td className="space-x-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => updateWorkerApproval(worker.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => updateWorkerApproval(worker.id, "rejected")}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-xl font-semibold">Workers</h2>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-emerald-100 text-slate-500">
              <th className="py-2">Name</th>
              <th>Mobile</th>
              <th>Email</th>
              <th>Category</th>
              <th>Test Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.id} className="border-b border-emerald-50">
                <td className="py-2">{worker.name}</td>
                <td>{worker.mobile || "-"}</td>
                <td>{worker.email}</td>
                <td>{worker.primaryCategory || worker.categories?.[0] || "-"}</td>
                <td>
                  {worker.assessment?.totalQuestions
                    ? `${worker.assessment.score}/${worker.assessment.totalQuestions} (${worker.assessment.percentage || 0}%)`
                    : "-"}
                </td>
                <td className="capitalize">{worker.status}</td>
                <td className="space-x-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => updateWorkerApproval(worker.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => updateWorkerApproval(worker.id, "rejected")}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-xl font-semibold">Users</h2>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-emerald-100 text-slate-500">
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>UID</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-emerald-50">
                <td className="py-2">{user.name || "-"}</td>
                <td>{user.email || "-"}</td>
                <td>{user.uid || user.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-xl font-semibold">Bookings</h2>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-emerald-100 text-slate-500">
              <th className="py-2">Category</th>
              <th>User</th>
              <th>Date</th>
              <th>Status</th>
              <th>Assign Job</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id} className="border-b border-emerald-50">
                <td className="py-2">{booking.category}</td>
                <td>{booking.userId}</td>
                <td>
                  {booking.date} {booking.time}
                </td>
                <td className="capitalize">{booking.status}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <select
                      className="input max-w-44"
                      value={assignSelection[booking.id] || ""}
                      onChange={(event) =>
                        setAssignSelection((prev) => ({
                          ...prev,
                          [booking.id]: event.target.value
                        }))
                      }
                    >
                      <option value="">Select worker</option>
                      {approvedWorkers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-soft" onClick={() => assignJob(booking.id)}>
                      Assign
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
