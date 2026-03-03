import { useEffect, useMemo, useState } from "react";
import api, { ADMIN_SESSION_TOKEN_KEY } from "./api";

const NAV = ["Dashboard", "Worker Hiring Requests", "Worker Management", "Category"];

const defaultRequestNotes = {};
const defaultSalaryDraft = {};
const defaultCategories = [
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

const date = (value) => {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const statusLabel = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "visit required") return "Visit Required";
  if (normalized === "account created") return "Account Created";
  if (normalized === "under review") return "Under Review";
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  return status || "Under Review";
};

const statusBadgeClass = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (["approved", "account created", "active"].includes(normalized)) return "erp-badge erp-badge-positive";
  if (["rejected", "terminated"].includes(normalized)) return "erp-badge erp-badge-negative";
  if (["under review", "suspended"].includes(normalized)) return "erp-badge erp-badge-neutral";
  if (["visit required"].includes(normalized)) return "erp-badge erp-badge-warn";
  return "erp-badge";
};

function Badge({ value }) {
  return <span className={statusBadgeClass(value)}>{value}</span>;
}

function normalizeApplication(record) {
  return {
    id: record.id,
    fullName: record.full_name || record.name || "-",
    phone: record.phone || "-",
    email: record.email || "-",
    address: record.address || "-",
    categoryApplied: record.category_applied || record.category || "-",
    idProofUrl: record.id_proof_url || "",
    addressProofUrl: record.address_proof_url || "",
    status: statusLabel(record.status),
    adminNotes: record.admin_notes || "",
    appliedAt: record.applied_at || record.createdAt || ""
  };
}

function normalizeWorker(record) {
  return {
    workerId: record.worker_id || record.id || "-",
    fullName: record.full_name || record.name || "-",
    phone: record.phone || record.mobile || "-",
    email: record.email || "-",
    category: record.category || "-",
    salary: Number.isFinite(Number(record.salary)) ? Number(record.salary) : 0,
    status: String(record.status || "Active"),
    joiningDate: record.joining_date || record.created_at || ""
  };
}

export default function AdminApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToken, setSessionToken] = useState(localStorage.getItem(ADMIN_SESSION_TOKEN_KEY) || "");
  const [active, setActive] = useState("Dashboard");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  const [applications, setApplications] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [requestNotes, setRequestNotes] = useState(defaultRequestNotes);
  const [salaryDraft, setSalaryDraft] = useState(defaultSalaryDraft);
  const [createAccountModal, setCreateAccountModal] = useState(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [applicationsRes, workersRes, usersRes, bookingsRes, categoriesRes] = await Promise.allSettled([
        api.get("/api/admin/worker-applications", { params: { sessionToken } }),
        api.get("/api/workers"),
        api.get("/api/users"),
        api.get("/api/bookings"),
        api.get("/api/admin/categories", { params: { sessionToken } })
      ]);

      const nextApplications =
        applicationsRes.status === "fulfilled" && Array.isArray(applicationsRes.value.data)
          ? applicationsRes.value.data.map(normalizeApplication)
          : [];
      const nextWorkers =
        workersRes.status === "fulfilled" && Array.isArray(workersRes.value.data)
          ? workersRes.value.data.map(normalizeWorker)
          : [];
      const nextCategoriesRaw =
        categoriesRes.status === "fulfilled" && Array.isArray(categoriesRes.value.data?.categories)
          ? categoriesRes.value.data.categories
          : [];
      const nextCategories = nextCategoriesRaw
        .map((item) => String(item || "").trim())
        .filter(Boolean);

      setApplications(nextApplications);
      setWorkers(nextWorkers);
      setUsers(usersRes.status === "fulfilled" && Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
      setBookings(bookingsRes.status === "fulfilled" && Array.isArray(bookingsRes.value.data) ? bookingsRes.value.data : []);
      setCategories(nextCategories.length > 0 ? nextCategories : defaultCategories);
      setError("");
    } catch (loadError) {
      setError(loadError?.response?.data?.message || "Failed to load admin data.");
    } finally {
      setLoadingData(false);
    }
  };

  const logout = async () => {
    const token = sessionToken;
    setSessionToken("");
    localStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
    setDrawer(null);
    if (token) {
      await api.post("/api/admin/logout", { sessionToken: token }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!sessionToken) return;
    const initialize = async () => {
      await api.post("/api/admin/session/validate", { sessionToken });
      await loadData();
    };

    initialize().catch(() => {
      setError("Admin session is invalid or expired.");
      logout().catch(() => {});
    });
  }, [sessionToken]);

  const login = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/api/admin/login", {
        email: email.trim().toLowerCase(),
        password
      });
      const token = response.data?.sessionToken;
      if (!token) throw new Error("Missing session token.");
      localStorage.setItem(ADMIN_SESSION_TOKEN_KEY, token);
      setSessionToken(token);
    } catch (loginError) {
      setError(loginError?.response?.data?.message || "Admin login failed.");
    } finally {
      setLoading(false);
    }
  };

  const refreshApplicationInState = (updated) => {
    const normalized = normalizeApplication(updated);
    setApplications((current) => current.map((application) => (application.id === normalized.id ? normalized : application)));
    if (drawer?.id === normalized.id) {
      setDrawer(normalized);
    }
  };

  const updateApplicationStatus = async (applicationId, statusValue) => {
    try {
      const response = await api.patch(`/api/admin/worker-applications/${applicationId}`, {
        status: statusValue,
        adminNotes: requestNotes[applicationId] || "",
        sessionToken
      });
      if (response.data?.application) {
        refreshApplicationInState(response.data.application);
      } else {
        await loadData();
      }
      setBanner(`Application ${applicationId} updated to ${statusValue}.`);
    } catch (updateError) {
      if (updateError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      setError(updateError?.response?.data?.message || "Failed to update application.");
    }
  };

  const openCreateAccountModal = (application) => {
    if (!application?.id) return;
    setError("");
    setCreateAccountModal({
      applicationId: application.id,
      applicantName: application.fullName || "-",
      workerId: "",
      password: "",
      salary: String(salaryDraft[application.id] ?? 18000)
    });
  };

  const closeCreateAccountModal = () => {
    if (creatingAccount) return;
    setCreateAccountModal(null);
  };

  const approveAndCreateAccount = async ({ applicationId, workerId, password, salary }) => {
    setCreatingAccount(true);
    try {
      const response = await api.post(`/api/admin/worker-applications/${applicationId}/approve-create-account`, {
        workerId,
        password,
        salary: Number.isFinite(Number(salary)) ? Number(salary) : Number(salaryDraft[applicationId] || 18000),
        adminNotes: requestNotes[applicationId] || "",
        sessionToken
      });

      if (response.data?.application) {
        refreshApplicationInState(response.data.application);
      } else {
        await loadData();
      }
      await loadData();

      const createdWorkerId = response.data?.workerId || "-";
      setSalaryDraft((current) => ({ ...current, [applicationId]: Number.isFinite(Number(salary)) ? Number(salary) : 18000 }));
      setCreateAccountModal(null);
      setBanner(`Account created for ${createdWorkerId}.`);
    } catch (approveError) {
      if (approveError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      setError(
        approveError?.response?.data?.message ||
          approveError?.response?.data?.error ||
          approveError?.message ||
          "Failed to approve and create worker account."
      );
    } finally {
      setCreatingAccount(false);
    }
  };

  const submitCreateAccount = async (event) => {
    event.preventDefault();
    if (!createAccountModal) return;

    const workerId = createAccountModal.workerId.trim().toUpperCase();
    const password = createAccountModal.password.trim();
    const salary = Number(createAccountModal.salary);

    if (!workerId) {
      setError("Worker ID is required.");
      return;
    }
    if (!/^[A-Z0-9_-]{4,32}$/.test(workerId)) {
      setError("Worker ID must be 4-32 characters and can contain A-Z, 0-9, _ and -.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!Number.isFinite(salary) || salary < 0) {
      setError("Salary must be a valid positive number.");
      return;
    }

    setError("");
    await approveAndCreateAccount({
      applicationId: createAccountModal.applicationId,
      workerId,
      password,
      salary
    });
  };

  const addCategory = async (event) => {
    event.preventDefault();
    const normalizedCategory = newCategoryName.trim().replace(/\s+/g, " ");
    if (!normalizedCategory) {
      setError("Category name is required.");
      return;
    }

    if (categories.some((item) => item.toLowerCase() === normalizedCategory.toLowerCase())) {
      setError("Category already exists.");
      return;
    }

    setAddingCategory(true);
    setError("");
    try {
      const response = await api.post("/api/admin/categories", {
        name: normalizedCategory,
        sessionToken
      });
      const updatedCategories = Array.isArray(response.data?.categories)
        ? response.data.categories.map((item) => String(item || "").trim()).filter(Boolean)
        : [...categories, normalizedCategory];
      setCategories(updatedCategories);
      setNewCategoryName("");
      setBanner(`Category "${normalizedCategory}" added.`);
    } catch (addCategoryError) {
      if (addCategoryError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      setError(
        addCategoryError?.response?.data?.message ||
          addCategoryError?.response?.data?.error ||
          addCategoryError?.message ||
          "Failed to add category."
      );
    } finally {
      setAddingCategory(false);
    }
  };

  const counts = useMemo(
    () => ({
      applications: applications.length,
      underReview: applications.filter((application) => application.status === "Under Review").length,
      visitRequired: applications.filter((application) => application.status === "Visit Required").length,
      accountCreated: applications.filter((application) => application.status === "Account Created").length
    }),
    [applications]
  );

  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecf2ff,_#f7f8fb_45%,_#ffffff_100%)] px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="erp-card p-8">
            <h1 className="erp-heading text-2xl text-slate-900">Tasko Admin Login</h1>
            <p className="mt-2 text-sm text-slate-500">Sign in to manage worker hiring requests and employee accounts.</p>

            <form className="mt-6 space-y-4" onSubmit={login}>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
                <input
                  type="email"
                  className="erp-input mt-1"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@tasko.com"
                  required
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Password
                <input
                  type="password"
                  className="erp-input mt-1"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  required
                />
              </label>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}

              <button type="submit" className="erp-btn erp-btn-primary w-full py-3 text-sm" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="erp-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="erp-eyebrow">Tasko Admin Panel</p>
            <h1 className="erp-heading text-2xl text-slate-900">Worker Hiring Console</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="erp-btn erp-btn-soft" onClick={loadData} disabled={loadingData}>
              {loadingData ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" className="erp-btn erp-btn-danger" onClick={() => logout().catch(() => {})}>
              Logout
            </button>
          </div>
        </header>

        {error ? <div className="erp-card border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        {banner ? <div className="erp-card border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{banner}</div> : null}

        <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
          <aside className="erp-card p-3">
            <nav className="space-y-2">
              {NAV.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`erp-sidebar-item ${active === item ? "erp-sidebar-item-active" : ""}`}
                  onClick={() => setActive(item)}
                >
                  {item}
                </button>
              ))}
            </nav>
          </aside>

          <main className="space-y-4">
            {active === "Dashboard" ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="erp-card p-4"><p className="erp-eyebrow">Applications</p><h2 className="text-2xl font-bold">{counts.applications}</h2></div>
                <div className="erp-card p-4"><p className="erp-eyebrow">Under Review</p><h2 className="text-2xl font-bold">{counts.underReview}</h2></div>
                <div className="erp-card p-4"><p className="erp-eyebrow">Visit Required</p><h2 className="text-2xl font-bold">{counts.visitRequired}</h2></div>
                <div className="erp-card p-4"><p className="erp-eyebrow">Account Created</p><h2 className="text-2xl font-bold">{counts.accountCreated}</h2></div>
                <div className="erp-card p-4 md:col-span-2 xl:col-span-4">
                  <p className="text-sm text-slate-600">Users: {users.length} | Workers: {workers.length} | Bookings: {bookings.length}</p>
                </div>
              </section>
            ) : null}

            {active === "Worker Hiring Requests" ? (
              <section className="erp-card overflow-x-auto p-5">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Worker Hiring Requests</h2>
                  <p className="text-sm text-slate-500">Review applications and create employee accounts after verification.</p>
                </div>

                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Applicant Name</th>
                      <th>Phone</th>
                      <th>Category</th>
                      <th>Applied Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-slate-500">No worker applications found.</td>
                      </tr>
                    ) : (
                      applications.map((application) => (
                        <tr key={application.id}>
                          <td>{application.fullName}</td>
                          <td>{application.phone}</td>
                          <td>{application.categoryApplied}</td>
                          <td>{date(application.appliedAt)}</td>
                          <td><Badge value={application.status} /></td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className="erp-btn erp-btn-soft" onClick={() => setDrawer(application)}>View Details</button>
                              <button type="button" className="erp-btn erp-btn-soft" onClick={() => updateApplicationStatus(application.id, "Visit Required")}>Mark as Visit Required</button>
                              <button type="button" className="erp-btn erp-btn-danger" onClick={() => updateApplicationStatus(application.id, "Rejected")}>Reject</button>
                              <button
                                type="button"
                                className="erp-btn erp-btn-primary"
                                onClick={() => openCreateAccountModal(application)}
                              >
                                Approve & Create Account
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>
            ) : null}

            {active === "Worker Management" ? (
              <section className="erp-card overflow-x-auto p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Workers</h2>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Worker ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Category</th>
                      <th>Salary</th>
                      <th>Status</th>
                      <th>Joining Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-slate-500">No workers found.</td>
                      </tr>
                    ) : (
                      workers.map((worker) => (
                        <tr key={worker.workerId}>
                          <td>{worker.workerId}</td>
                          <td>{worker.fullName}</td>
                          <td>{worker.phone}</td>
                          <td>{worker.category}</td>
                          <td>{money(worker.salary)}</td>
                          <td><Badge value={worker.status} /></td>
                          <td>{date(worker.joiningDate)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>
            ) : null}

            {active === "Category" ? (
              <section className="erp-card p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Category</h2>
                    <p className="text-sm text-slate-500">
                      Manage worker service categories. You can add new categories here.
                    </p>
                  </div>
                  <span className="erp-badge">{categories.length} categories</span>
                </div>

                <form className="mb-5 flex flex-wrap items-end gap-2" onSubmit={addCategory}>
                  <label className="block flex-1 min-w-[220px]">
                    <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Add Category</span>
                    <input
                      type="text"
                      className="erp-input"
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="Enter category name"
                      maxLength={80}
                    />
                  </label>
                  <button type="submit" className="erp-btn erp-btn-primary" disabled={addingCategory}>
                    {addingCategory ? "Adding..." : "Add Category"}
                  </button>
                </form>

                <div className="overflow-x-auto">
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Category Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-center text-slate-500">No categories found.</td>
                        </tr>
                      ) : (
                        categories.map((category, index) => (
                          <tr key={`${category}-${index}`}>
                            <td>{index + 1}</td>
                            <td>{category}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </main>
        </div>
      </div>

      {drawer ? (
        <div className="erp-drawer-overlay" onClick={() => setDrawer(null)}>
          <aside className="erp-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Application Details</h3>
                <p className="text-sm text-slate-500">{drawer.fullName}</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={() => setDrawer(null)}>X</button>
            </div>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Phone</p><p className="mt-1 font-medium text-slate-900">{drawer.phone}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Email</p><p className="mt-1 font-medium text-slate-900">{drawer.email}</p></div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Address</p><p className="mt-1 text-sm text-slate-900">{drawer.address}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Category Applied</p><p className="mt-1 text-sm text-slate-900">{drawer.categoryApplied}</p></div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">ID Proof</p>
                  {drawer.idProofUrl ? <a href={drawer.idProofUrl} target="_blank" rel="noreferrer" className="erp-link">Preview / Download</a> : <p className="text-xs text-slate-500">Not uploaded</p>}
                </div>
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Address Proof</p>
                  {drawer.addressProofUrl ? <a href={drawer.addressProofUrl} target="_blank" rel="noreferrer" className="erp-link">Preview / Download</a> : <p className="text-xs text-slate-500">Not uploaded</p>}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Admin Notes</span>
                <textarea
                  rows={4}
                  className="erp-input resize-none"
                  value={requestNotes[drawer.id] ?? drawer.adminNotes}
                  onChange={(event) => setRequestNotes((current) => ({ ...current, [drawer.id]: event.target.value }))}
                  placeholder="Add verification notes..."
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Status</span>
                <select
                  className="erp-select"
                  value={drawer.status}
                  onChange={(event) => setDrawer((current) => (current ? { ...current, status: event.target.value } : current))}
                >
                  {["Under Review", "Visit Required", "Approved", "Rejected", "Account Created"].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Salary (for account creation)</span>
                <input
                  type="number"
                  min="0"
                  className="erp-input"
                  value={salaryDraft[drawer.id] ?? 18000}
                  onChange={(event) => setSalaryDraft((current) => ({ ...current, [drawer.id]: event.target.value }))}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="erp-btn erp-btn-soft" onClick={() => updateApplicationStatus(drawer.id, drawer.status)}>Save Review</button>
                <button type="button" className="erp-btn erp-btn-danger" onClick={() => updateApplicationStatus(drawer.id, "Rejected")}>Reject</button>
                <button
                  type="button"
                  className="erp-btn erp-btn-primary"
                  onClick={() => openCreateAccountModal(drawer)}
                >
                  Approve & Create Account
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {createAccountModal ? (
        <div className="erp-drawer-overlay items-center justify-center" onClick={closeCreateAccountModal}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Create Worker Account</h3>
                <p className="text-sm text-slate-500">{createAccountModal.applicantName}</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={closeCreateAccountModal} disabled={creatingAccount}>
                X
              </button>
            </div>

            <form className="space-y-3" onSubmit={submitCreateAccount}>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Worker ID</span>
                <input
                  type="text"
                  className="erp-input"
                  value={createAccountModal.workerId}
                  onChange={(event) =>
                    setCreateAccountModal((current) =>
                      current
                        ? { ...current, workerId: event.target.value.toUpperCase().replace(/\s+/g, "") }
                        : current
                    )
                  }
                  placeholder="TASKO-W-1001"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Password</span>
                <input
                  type="password"
                  className="erp-input"
                  value={createAccountModal.password}
                  onChange={(event) =>
                    setCreateAccountModal((current) => (current ? { ...current, password: event.target.value } : current))
                  }
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Salary</span>
                <input
                  type="number"
                  min="0"
                  className="erp-input"
                  value={createAccountModal.salary}
                  onChange={(event) =>
                    setCreateAccountModal((current) => (current ? { ...current, salary: event.target.value } : current))
                  }
                  required
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button type="button" className="erp-btn erp-btn-soft" onClick={closeCreateAccountModal} disabled={creatingAccount}>
                  Cancel
                </button>
                <button type="submit" className="erp-btn erp-btn-primary" disabled={creatingAccount}>
                  {creatingAccount ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
