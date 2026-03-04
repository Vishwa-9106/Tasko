import { useEffect, useMemo, useState } from "react";
import api, { ADMIN_SESSION_TOKEN_KEY } from "./api";
import BookingsManagement from "./BookingsManagement";
import TaskoMartManagement from "./TaskoMartManagement";

const NAV = ["Dashboard", "Worker Hiring Requests", "Worker Management", "Bookings", "Category", "TaskoMart Management"];
const CATEGORY_LIST_PATH = "/admin/categories";

const defaultRequestNotes = {};
const defaultSalaryDraft = {};

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
    joiningDate: record.joining_date || record.created_at || "",
    online: Boolean(record.online),
    rating: Number.isFinite(Number(record.rating)) ? Number(record.rating) : 0,
    experience: record.experience ?? record.yearsOfExperience ?? record.experienceYears ?? ""
  };
}

function normalizeCategory(record) {
  return {
    id: String(record?.id || "").trim(),
    name: String(record?.name || "").trim(),
    createdAt: record?.createdAt || "",
    updatedAt: record?.updatedAt || "",
    subcategoryCount: Number.isFinite(Number(record?.subcategoryCount)) ? Number(record.subcategoryCount) : 0
  };
}

function normalizeSubcategory(record) {
  return {
    id: String(record?.id || "").trim(),
    categoryId: String(record?.categoryId || record?.category_id || "").trim(),
    name: String(record?.name || "").trim(),
    createdAt: record?.createdAt || "",
    updatedAt: record?.updatedAt || ""
  };
}

function parseSubcategoryRoute(pathname) {
  const match = String(pathname || "").match(/^\/admin\/category\/([^/]+)\/subcategories\/?$/i);
  return match ? decodeURIComponent(match[1]) : "";
}

export default function AdminApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToken, setSessionToken] = useState(localStorage.getItem(ADMIN_SESSION_TOKEN_KEY) || "");
  const [active, setActive] = useState(() =>
    window.location.pathname === CATEGORY_LIST_PATH || window.location.pathname.startsWith("/admin/category/")
      ? "Category"
      : "Dashboard"
  );
  const [locationPath, setLocationPath] = useState(() => window.location.pathname);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [toasts, setToasts] = useState([]);

  const [applications, setApplications] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [loadedSubcategoryCategoryId, setLoadedSubcategoryCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingSubcategory, setAddingSubcategory] = useState(false);
  const [categoryEditModal, setCategoryEditModal] = useState(null);
  const [subcategoryEditModal, setSubcategoryEditModal] = useState(null);
  const [savingCategoryEdit, setSavingCategoryEdit] = useState(false);
  const [savingSubcategoryEdit, setSavingSubcategoryEdit] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [requestNotes, setRequestNotes] = useState(defaultRequestNotes);
  const [salaryDraft, setSalaryDraft] = useState(defaultSalaryDraft);
  const [createAccountModal, setCreateAccountModal] = useState(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const subcategoryRouteCategoryId = useMemo(() => parseSubcategoryRoute(locationPath), [locationPath]);

  const pushToast = (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  };

  const navigateToPath = (nextPath) => {
    if (window.location.pathname === nextPath) {
      setLocationPath(nextPath);
      return;
    }
    window.history.pushState({}, "", nextPath);
    setLocationPath(nextPath);
  };

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
        .map(normalizeCategory)
        .filter((item) => item.id && item.name)
        .sort((left, right) => left.name.localeCompare(right.name));

      setApplications(nextApplications);
      setWorkers(nextWorkers);
      setUsers(usersRes.status === "fulfilled" && Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
      setBookings(bookingsRes.status === "fulfilled" && Array.isArray(bookingsRes.value.data) ? bookingsRes.value.data : []);
      setCategories(nextCategories);
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

  const loadSubcategories = async (categoryId) => {
    if (!categoryId) return;
    setLoadingSubcategories(true);
    try {
      const response = await api.get(`/api/admin/categories/${categoryId}/subcategories`, {
        params: { sessionToken }
      });
      const nextCategory = normalizeCategory(response.data?.category || {});
      const nextSubcategories = Array.isArray(response.data?.subcategories)
        ? response.data.subcategories.map(normalizeSubcategory).filter((item) => item.id && item.name)
        : [];

      if (nextCategory.id) {
        setSelectedCategory(nextCategory);
        setCategories((current) =>
          current.map((item) => (item.id === nextCategory.id ? { ...item, ...nextCategory } : item))
        );
      }
      setSubcategories(nextSubcategories);
      setLoadedSubcategoryCategoryId(categoryId);
      setError("");
    } catch (loadError) {
      if (loadError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      const message =
        loadError?.response?.data?.message || loadError?.response?.data?.error || "Failed to load subcategories.";
      setError(message);
      pushToast("error", message);
    } finally {
      setLoadingSubcategories(false);
    }
  };

  useEffect(() => {
    const onPopState = () => setLocationPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (locationPath === CATEGORY_LIST_PATH || subcategoryRouteCategoryId) {
      setActive("Category");
    }
  }, [locationPath, subcategoryRouteCategoryId]);

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

  useEffect(() => {
    if (!sessionToken) return;
    if (!subcategoryRouteCategoryId) {
      setSelectedCategory(null);
      setSubcategories([]);
      setLoadedSubcategoryCategoryId("");
      return;
    }

    setActive("Category");
    const found = categories.find((item) => item.id === subcategoryRouteCategoryId);
    if (!found) {
      if (categories.length > 0) {
        pushToast("error", "Category not found.");
        navigateToPath(CATEGORY_LIST_PATH);
      }
      return;
    }

    setSelectedCategory(found);
    if (loadedSubcategoryCategoryId !== found.id) {
      loadSubcategories(found.id).catch(() => {});
    }
  }, [sessionToken, subcategoryRouteCategoryId, categories, loadedSubcategoryCategoryId]);

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

    if (categories.some((item) => item.name.toLowerCase() === normalizedCategory.toLowerCase())) {
      setError("Category already exists.");
      return;
    }

    setAddingCategory(true);
    setError("");
    try {
      await api.post("/api/admin/categories", {
        name: normalizedCategory,
        sessionToken
      });
      await loadData();
      setNewCategoryName("");
      pushToast("success", `Category "${normalizedCategory}" added.`);
    } catch (addCategoryError) {
      if (addCategoryError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      const message =
        addCategoryError?.response?.data?.message ||
          addCategoryError?.response?.data?.error ||
          addCategoryError?.message ||
          "Failed to add category.";
      setError(message);
      pushToast("error", message);
    } finally {
      setAddingCategory(false);
    }
  };

  const handleNavClick = (item) => {
    setActive(item);
    if (item === "Category") {
      navigateToPath(CATEGORY_LIST_PATH);
      return;
    }
    if (subcategoryRouteCategoryId || locationPath === CATEGORY_LIST_PATH) {
      navigateToPath("/");
    }
    setSelectedCategory(null);
    setSubcategories([]);
    setLoadedSubcategoryCategoryId("");
  };

  const openManageSubcategories = (category) => {
    if (!category?.id) return;
    setActive("Category");
    setSelectedCategory(category);
    navigateToPath(`/admin/category/${encodeURIComponent(category.id)}/subcategories`);
    loadSubcategories(category.id).catch(() => {});
  };

  const goBackToCategoryList = () => {
    setSelectedCategory(null);
    setSubcategories([]);
    setLoadedSubcategoryCategoryId("");
    navigateToPath(CATEGORY_LIST_PATH);
  };

  const openCategoryEdit = (category) => {
    setCategoryEditModal({ id: category.id, name: category.name });
  };

  const saveCategoryEdit = async (event) => {
    event.preventDefault();
    if (!categoryEditModal?.id) return;
    const normalizedName = categoryEditModal.name.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      setError("Category name is required.");
      return;
    }

    setSavingCategoryEdit(true);
    setError("");
    try {
      await api.patch(`/api/admin/categories/${categoryEditModal.id}`, {
        name: normalizedName,
        sessionToken
      });
      await loadData();
      if (selectedCategory?.id === categoryEditModal.id) {
        setSelectedCategory((current) => (current ? { ...current, name: normalizedName } : current));
      }
      setCategoryEditModal(null);
      pushToast("success", "Category updated successfully.");
    } catch (updateError) {
      if (updateError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      const message =
        updateError?.response?.data?.message ||
          updateError?.response?.data?.error ||
          updateError?.message ||
          "Failed to update category.";
      setError(message);
      pushToast("error", message);
    } finally {
      setSavingCategoryEdit(false);
    }
  };

  const requestCategoryDelete = (category) => {
    setConfirmDialog({
      kind: "delete-category",
      title: "Delete Category",
      message: `Are you sure you want to delete "${category.name}"?`,
      warning:
        category.subcategoryCount > 0
          ? `This category has ${category.subcategoryCount} subcategories. Deleting it will also delete those subcategories.`
          : "",
      categoryId: category.id
    });
  };

  const requestSubcategoryDelete = (subcategory) => {
    setConfirmDialog({
      kind: "delete-subcategory",
      title: "Delete Sub Category",
      message: `Are you sure you want to delete "${subcategory.name}"?`,
      warning: "",
      categoryId: selectedCategory?.id || "",
      subcategoryId: subcategory.id
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmDialog) return;
    setConfirmingAction(true);
    try {
      if (confirmDialog.kind === "delete-category") {
        const response = await api.delete(`/api/admin/categories/${confirmDialog.categoryId}`, {
          data: { sessionToken }
        });
        const deletedSubCount = Number(response?.data?.deletedSubcategoryCount || 0);
        await loadData();
        if (selectedCategory?.id === confirmDialog.categoryId) {
          goBackToCategoryList();
        }
        pushToast(
          "success",
          deletedSubCount > 0
            ? `Category deleted with ${deletedSubCount} subcategories.`
            : "Category deleted successfully."
        );
      } else if (confirmDialog.kind === "delete-subcategory") {
        await api.delete(
          `/api/admin/categories/${confirmDialog.categoryId}/subcategories/${confirmDialog.subcategoryId}`,
          {
            data: { sessionToken }
          }
        );
        if (confirmDialog.categoryId) {
          await loadSubcategories(confirmDialog.categoryId);
        }
        await loadData();
        pushToast("success", "Subcategory deleted successfully.");
      }
      setConfirmDialog(null);
    } catch (deleteError) {
      if (deleteError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      const message =
        deleteError?.response?.data?.message ||
          deleteError?.response?.data?.error ||
          deleteError?.message ||
          "Delete action failed.";
      setError(message);
      pushToast("error", message);
    } finally {
      setConfirmingAction(false);
    }
  };

  const addSubcategory = async (event) => {
    event.preventDefault();
    if (!selectedCategory?.id) return;
    const normalizedName = newSubcategoryName.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      setError("Subcategory name is required.");
      return;
    }

    if (subcategories.some((item) => item.name.toLowerCase() === normalizedName.toLowerCase())) {
      setError("Subcategory already exists in this category.");
      return;
    }

    setAddingSubcategory(true);
    setError("");
    try {
      await api.post(`/api/admin/categories/${selectedCategory.id}/subcategories`, {
        name: normalizedName,
        sessionToken
      });
      setNewSubcategoryName("");
      await loadSubcategories(selectedCategory.id);
      await loadData();
      pushToast("success", "Subcategory added successfully.");
    } catch (addSubError) {
      if (addSubError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      const message =
        addSubError?.response?.data?.message ||
          addSubError?.response?.data?.error ||
          addSubError?.message ||
          "Failed to add subcategory.";
      setError(message);
      pushToast("error", message);
    } finally {
      setAddingSubcategory(false);
    }
  };

  const openSubcategoryEdit = (subcategory) => {
    setSubcategoryEditModal({ id: subcategory.id, name: subcategory.name });
  };

  const saveSubcategoryEdit = async (event) => {
    event.preventDefault();
    if (!selectedCategory?.id || !subcategoryEditModal?.id) return;
    const normalizedName = subcategoryEditModal.name.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      setError("Subcategory name is required.");
      return;
    }

    setSavingSubcategoryEdit(true);
    setError("");
    try {
      await api.patch(
        `/api/admin/categories/${selectedCategory.id}/subcategories/${subcategoryEditModal.id}`,
        {
          name: normalizedName,
          sessionToken
        }
      );
      await loadSubcategories(selectedCategory.id);
      await loadData();
      setSubcategoryEditModal(null);
      pushToast("success", "Subcategory updated successfully.");
    } catch (updateSubError) {
      if (updateSubError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      const message =
        updateSubError?.response?.data?.message ||
          updateSubError?.response?.data?.error ||
          updateSubError?.message ||
          "Failed to update subcategory.";
      setError(message);
      pushToast("error", message);
    } finally {
      setSavingSubcategoryEdit(false);
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
            <p className="mt-2 text-sm text-slate-500">Sign in to manage workers, categories, and TaskoMart operations.</p>

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
            <h1 className="erp-heading text-2xl text-slate-900">Operations Console</h1>
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
                  onClick={() => handleNavClick(item)}
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

            {active === "Bookings" ? (
              <BookingsManagement
                bookings={bookings}
                workers={workers}
                users={users}
                setBookings={setBookings}
                pushToast={pushToast}
              />
            ) : null}

            {active === "TaskoMart Management" ? (
              <TaskoMartManagement
                sessionToken={sessionToken}
                pushToast={pushToast}
                onSessionExpired={async () => {
                  await logout();
                }}
              />
            ) : null}

            {active === "Category" ? (
              <section className="erp-card p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {subcategoryRouteCategoryId ? "Sub Category Management" : "Category Management"}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {subcategoryRouteCategoryId
                        ? `Manage sub categories for ${selectedCategory?.name || "selected category"}.`
                        : "Manage main categories and navigate to sub category management."}
                    </p>
                  </div>
                  <span className="erp-badge">
                    {subcategoryRouteCategoryId ? `${subcategories.length} sub categories` : `${categories.length} categories`}
                  </span>
                </div>

                {!subcategoryRouteCategoryId ? (
                  <>
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
                            <th>Serial Number</th>
                            <th>Category Name</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categories.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center text-slate-500">No categories found.</td>
                            </tr>
                          ) : (
                            categories.map((category, index) => (
                              <tr key={category.id}>
                                <td>{index + 1}</td>
                                <td>
                                  <div className="font-medium text-slate-900">{category.name}</div>
                                  <div className="text-xs text-slate-500">{category.subcategoryCount} sub categories</div>
                                </td>
                                <td>
                                  <div className="flex flex-wrap gap-2">
                                    <button type="button" className="erp-btn erp-btn-soft" onClick={() => openCategoryEdit(category)}>
                                      Edit
                                    </button>
                                    <button type="button" className="erp-btn erp-btn-danger" onClick={() => requestCategoryDelete(category)}>
                                      Delete
                                    </button>
                                    <button
                                      type="button"
                                      className="erp-btn erp-btn-primary"
                                      onClick={() => openManageSubcategories(category)}
                                    >
                                      Manage Sub Categories
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Selected Category</p>
                        <p className="font-semibold text-slate-900">{selectedCategory?.name || "-"}</p>
                      </div>
                      <button type="button" className="erp-btn erp-btn-soft" onClick={goBackToCategoryList}>
                        Back to Categories
                      </button>
                    </div>

                    <form className="mb-5 flex flex-wrap items-end gap-2" onSubmit={addSubcategory}>
                      <label className="block flex-1 min-w-[220px]">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Add Sub Category</span>
                        <input
                          type="text"
                          className="erp-input"
                          value={newSubcategoryName}
                          onChange={(event) => setNewSubcategoryName(event.target.value)}
                          placeholder="Enter sub category name"
                          maxLength={80}
                        />
                      </label>
                      <button type="submit" className="erp-btn erp-btn-primary" disabled={addingSubcategory}>
                        {addingSubcategory ? "Adding..." : "Add Sub Category"}
                      </button>
                    </form>

                    <div className="overflow-x-auto">
                      <table className="erp-table">
                        <thead>
                          <tr>
                            <th>Serial Number</th>
                            <th>Sub Category Name</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingSubcategories ? (
                            <tr>
                              <td colSpan={3} className="text-center text-slate-500">Loading sub categories...</td>
                            </tr>
                          ) : subcategories.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center text-slate-500">No sub categories found.</td>
                            </tr>
                          ) : (
                            subcategories.map((subcategory, index) => (
                              <tr key={subcategory.id}>
                                <td>{index + 1}</td>
                                <td>{subcategory.name}</td>
                                <td>
                                  <div className="flex flex-wrap gap-2">
                                    <button type="button" className="erp-btn erp-btn-soft" onClick={() => openSubcategoryEdit(subcategory)}>
                                      Edit
                                    </button>
                                    <button type="button" className="erp-btn erp-btn-danger" onClick={() => requestSubcategoryDelete(subcategory)}>
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
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

      {categoryEditModal ? (
        <div className="erp-drawer-overlay items-center justify-center" onClick={() => setCategoryEditModal(null)}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit Category</h3>
                <p className="text-sm text-slate-500">Update category name</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={() => setCategoryEditModal(null)} disabled={savingCategoryEdit}>
                X
              </button>
            </div>

            <form className="space-y-3" onSubmit={saveCategoryEdit}>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Category Name</span>
                <input
                  type="text"
                  className="erp-input"
                  value={categoryEditModal.name}
                  onChange={(event) =>
                    setCategoryEditModal((current) => (current ? { ...current, name: event.target.value } : current))
                  }
                  maxLength={80}
                  required
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button type="button" className="erp-btn erp-btn-soft" onClick={() => setCategoryEditModal(null)} disabled={savingCategoryEdit}>
                  Cancel
                </button>
                <button type="submit" className="erp-btn erp-btn-primary" disabled={savingCategoryEdit}>
                  {savingCategoryEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {subcategoryEditModal ? (
        <div className="erp-drawer-overlay items-center justify-center" onClick={() => setSubcategoryEditModal(null)}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit Sub Category</h3>
                <p className="text-sm text-slate-500">Update sub category name</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={() => setSubcategoryEditModal(null)} disabled={savingSubcategoryEdit}>
                X
              </button>
            </div>

            <form className="space-y-3" onSubmit={saveSubcategoryEdit}>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Sub Category Name</span>
                <input
                  type="text"
                  className="erp-input"
                  value={subcategoryEditModal.name}
                  onChange={(event) =>
                    setSubcategoryEditModal((current) => (current ? { ...current, name: event.target.value } : current))
                  }
                  maxLength={80}
                  required
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button type="button" className="erp-btn erp-btn-soft" onClick={() => setSubcategoryEditModal(null)} disabled={savingSubcategoryEdit}>
                  Cancel
                </button>
                <button type="submit" className="erp-btn erp-btn-primary" disabled={savingSubcategoryEdit}>
                  {savingSubcategoryEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <div className="erp-drawer-overlay items-center justify-center" onClick={() => setConfirmDialog(null)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">{confirmDialog.title}</h3>
            <p className="mt-2 text-sm text-slate-700">{confirmDialog.message}</p>
            {confirmDialog.warning ? (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">{confirmDialog.warning}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="erp-btn erp-btn-soft" onClick={() => setConfirmDialog(null)} disabled={confirmingAction}>
                Cancel
              </button>
              <button type="button" className="erp-btn erp-btn-danger" onClick={executeConfirmAction} disabled={confirmingAction}>
                {confirmingAction ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toasts.length > 0 ? (
        <div className="fixed right-4 top-4 z-[80] flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl border px-3 py-2 text-sm shadow-lg ${
                toast.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
