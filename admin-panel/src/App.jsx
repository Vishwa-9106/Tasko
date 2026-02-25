import { useEffect, useMemo, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import api from "./api";
import { auth } from "./firebase";

function MetricCard({ label, value }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-panel-700">{value}</p>
    </div>
  );
}

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("tasko_admin_id_token") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [analytics, setAnalytics] = useState({
    userCount: 0,
    workerCount: 0,
    bookingCount: 0,
    pendingWorkers: 0
  });
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [assignSelection, setAssignSelection] = useState({});

  const approvedWorkers = useMemo(() => workers.filter((worker) => worker.status === "approved"), [workers]);

  const loadDashboard = async () => {
    const [analyticsRes, workersRes, usersRes, bookingsRes] = await Promise.all([
      api.get("/api/admin/analytics"),
      api.get("/api/workers"),
      api.get("/api/users"),
      api.get("/api/bookings")
    ]);

    setAnalytics(analyticsRes.data);
    setWorkers(workersRes.data);
    setUsers(usersRes.data);
    setBookings(bookingsRes.data);
  };

  useEffect(() => {
    if (!token) return;
    const validateAndLoad = async () => {
      await api.post("/api/auth/sync-role", { idToken: token, role: "admin" });
      await api.post("/api/auth/validate", { idToken: token, expectedRole: "admin" });
      await loadDashboard();
    };

    validateAndLoad().catch(async () => {
      setError("Admin session is invalid or does not have admin role");
      await logout();
    });
  }, [token]);

  const login = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      await api.post("/api/auth/sync-role", { idToken, role: "admin" });
      await api.post("/api/auth/validate", { idToken, expectedRole: "admin" });
      localStorage.setItem("tasko_admin_id_token", idToken);
      setToken(idToken);
      await loadDashboard();
    } catch (loginError) {
      setError(loginError.response?.data?.message || "Login failed");
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
    await signOut(auth);
    localStorage.removeItem("tasko_admin_id_token");
    setToken("");
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="card">
          <h1 className="mb-4 text-2xl font-bold text-panel-700">Tasko Admin Login</h1>
          <form className="space-y-3" onSubmit={login}>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              className="input"
              type="password"
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
