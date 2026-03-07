import { useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut as signOutOfFirebase } from "firebase/auth";
import api, { ADMIN_SESSION_TOKEN_KEY } from "./api";
import { auth as firebaseAuth, initializeFirebaseClient } from "./firebase";
import BookingsManagement from "./BookingsManagement";
import TaskoMartManagement from "./TaskoMartManagement";
import UserManagement from "./UserManagement";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "User Management", path: "/user-management" },
  { label: "Worker Hiring Requests", path: "/worker-hiring-requests" },
  { label: "Worker Management", path: "/worker-management" },
  { label: "Bookings", path: "/bookings" },
  { label: "Category", path: "/category" },
  { label: "TaskoMart Management", path: "/taskomart-management" }
];
const NAV_PATH_BY_LABEL = Object.fromEntries(NAV_ITEMS.map((item) => [item.label, item.path]));
const DEFAULT_NAV_PATH = NAV_ITEMS[0].path;
const CATEGORY_LIST_PATH = NAV_PATH_BY_LABEL.Category;

const defaultRequestNotes = {};
const defaultSalaryDraft = {};
const pricingTypeOptions = [
  { value: "fixed", label: "Fixed Price" },
  { value: "per_unit", label: "Per Unit" },
  { value: "per_hour", label: "Per Hour" },
  { value: "starting_at", label: "Starting At" }
];

function createEmptySubcategoryDraft() {
  return {
    name: "",
    pricingType: "fixed",
    price: "",
    unitLabel: "",
    pricingNotes: ""
  };
}

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
    testResult: record.test_result || record.testResult || record.assessment_result || "-",
    idProofUrl: record.id_proof_url || "",
    addressProofUrl: record.address_proof_url || "",
    status: statusLabel(record.status),
    adminNotes: record.admin_notes || "",
    appliedAt: record.applied_at || record.createdAt || "",
    approvedWorkerId: record.approved_worker_id || ""
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
    pricingType: String(record?.pricingType || "fixed").trim() || "fixed",
    price: Number.isFinite(Number(record?.price)) ? Number(record.price) : null,
    unitLabel: String(record?.unitLabel || "").trim(),
    pricingNotes: String(record?.pricingNotes || "").trim(),
    priceSummary: String(record?.priceSummary || "").trim(),
    isVariablePrice: Boolean(record?.isVariablePrice),
    createdAt: record?.createdAt || "",
    updatedAt: record?.updatedAt || ""
  };
}

function normalizeSubcategoryDraft(record) {
  return {
    name: String(record?.name || "").trim(),
    pricingType: String(record?.pricingType || "fixed").trim() || "fixed",
    price:
      record?.price === null || record?.price === undefined || record?.price === ""
        ? ""
        : String(record.price),
    unitLabel: String(record?.unitLabel || "").trim(),
    pricingNotes: String(record?.pricingNotes || "").trim()
  };
}

function buildSubcategoryPriceSummary(record) {
  if (record?.priceSummary) {
    return record.priceSummary;
  }

  if (!Number.isFinite(Number(record?.price))) {
    return "Pricing on request";
  }

  const amount = money(record.price);
  const unitLabel = String(record?.unitLabel || "").trim();
  switch (record?.pricingType) {
    case "per_unit":
      return `${amount} per ${unitLabel || "unit"}`;
    case "per_hour":
      return `${amount} per ${unitLabel || "hour"}`;
    case "starting_at":
      return `Starts at ${amount}`;
    case "fixed":
    default:
      return `${amount} fixed`;
  }
}

function validateSubcategoryDraft(draft) {
  const normalizedName = String(draft?.name || "").trim().replace(/\s+/g, " ");
  const pricingType = String(draft?.pricingType || "").trim();
  const price = Number(draft?.price);
  const unitLabel = String(draft?.unitLabel || "").trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    return { error: "Subcategory name is required.", payload: null };
  }

  if (!pricingTypeOptions.some((option) => option.value === pricingType)) {
    return { error: "Pricing type is required.", payload: null };
  }

  if (!Number.isFinite(price) || price < 0) {
    return { error: "Price must be a valid non-negative number.", payload: null };
  }

  if ((pricingType === "per_unit" || pricingType === "per_hour") && !unitLabel) {
    return { error: "Unit label is required for per-unit or per-hour pricing.", payload: null };
  }

  return {
    error: "",
    payload: {
      name: normalizedName,
      pricingType,
      price,
      unitLabel,
      pricingNotes: String(draft?.pricingNotes || "").trim()
    }
  };
}

function parseSubcategoryRoute(pathname) {
  const match = String(pathname || "").match(/^\/category\/([^/]+)\/subcategories\/?$/i);
  if (match) return decodeURIComponent(match[1]);
  const legacyMatch = String(pathname || "").match(/^\/admin\/category\/([^/]+)\/subcategories\/?$/i);
  return legacyMatch ? decodeURIComponent(legacyMatch[1]) : "";
}

function normalizePath(pathname) {
  const path = String(pathname || "").trim();
  if (!path) return "/";
  const cleaned = path.replace(/\/+$/, "");
  return cleaned || "/";
}

function normalizeAdminPath(pathname) {
  const normalized = normalizePath(pathname);
  if (normalized === "/") return DEFAULT_NAV_PATH;
  if (normalized === "/admin/categories") return CATEGORY_LIST_PATH;
  const legacySubCategoryMatch = normalized.match(/^\/admin\/category\/([^/]+)\/subcategories$/i);
  if (legacySubCategoryMatch) {
    return `/category/${encodeURIComponent(decodeURIComponent(legacySubCategoryMatch[1]))}/subcategories`;
  }
  return normalized;
}

function activeNavFromPath(pathname) {
  const normalized = normalizeAdminPath(pathname);
  if (parseSubcategoryRoute(normalized)) return "Category";
  const found = NAV_ITEMS.find((item) => item.path === normalized);
  if (found) return found.label;
  return "Dashboard";
}

function subcategoryPathForCategory(categoryId) {
  return `/category/${encodeURIComponent(categoryId)}/subcategories`;
}

function getFirebaseAuthErrorMessage(error) {
  const code = error?.code || "";
  const fallback = error?.response?.data?.message || error?.message || "Admin Google login failed.";

  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Google sign-in popup was closed before completion.";
  }
  if (code === "auth/popup-blocked") {
    return "Google sign-in popup was blocked by the browser.";
  }
  if (code === "auth/unauthorized-domain") {
    return "Current domain is not authorized in Firebase Authentication settings.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection and retry.";
  }

  return fallback;
}

export default function AdminApp() {
  const initialPath = normalizeAdminPath(window.location.pathname);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [sessionToken, setSessionToken] = useState(localStorage.getItem(ADMIN_SESSION_TOKEN_KEY) || "");
  const [locationPath, setLocationPath] = useState(() => initialPath);
  const active = useMemo(() => activeNavFromPath(locationPath), [locationPath]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [toasts, setToasts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState({
    userCount: 0,
    workerCount: 0,
    bookingCount: 0,
    pendingWorkers: 0
  });
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [loadedSubcategoryCategoryId, setLoadedSubcategoryCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubcategoryDraft, setNewSubcategoryDraft] = useState(createEmptySubcategoryDraft);
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
  const [creatingAccount, setCreatingAccount] = useState(false);
  const subcategoryRouteCategoryId = useMemo(() => parseSubcategoryRoute(locationPath), [locationPath]);
  
  useEffect(() => {
    if (window.location.pathname !== initialPath) {
      window.history.replaceState({}, "", initialPath);
    }
  }, [initialPath]);

  const pushToast = (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  };

  const navigateToPath = (nextPath) => {
    const normalizedPath = normalizeAdminPath(nextPath);
    if (window.location.pathname === normalizedPath) {
      setLocationPath(normalizedPath);
      return;
    }
    window.history.pushState({}, "", normalizedPath);
    setLocationPath(normalizedPath);
  };

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [applicationsRes, usersRes, workersRes, bookingsRes, categoriesRes, analyticsRes] = await Promise.allSettled([
        api.get("/api/admin/worker-applications", { params: { sessionToken, limit: 20 } }),
        api.get("/api/admin/users", { params: { sessionToken, limit: 100 } }),
        api.get("/api/workers", { params: { limit: 20 } }),
        api.get("/api/bookings", { params: { limit: 20 } }),
        api.get("/api/admin/categories", { params: { sessionToken } }),
        api.get("/api/admin/analytics", { params: { sessionToken } })
      ]);

      const nextApplications =
        applicationsRes.status === "fulfilled" && Array.isArray(applicationsRes.value.data)
          ? applicationsRes.value.data.map(normalizeApplication)
          : [];
      const nextWorkers =
        workersRes.status === "fulfilled" && Array.isArray(workersRes.value.data)
          ? workersRes.value.data.map(normalizeWorker)
          : [];
      const nextUsers =
        usersRes.status === "fulfilled" && Array.isArray(usersRes.value.data?.users)
          ? usersRes.value.data.users
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
      setUsers(nextUsers);
      setBookings(bookingsRes.status === "fulfilled" && Array.isArray(bookingsRes.value.data) ? bookingsRes.value.data : []);
      setCategories(nextCategories);
      const analyticsPayload =
        analyticsRes.status === "fulfilled" && analyticsRes.value?.data
          ? analyticsRes.value.data
          : {};
      setAnalytics({
        userCount: Number.isFinite(Number(analyticsPayload.userCount)) ? Number(analyticsPayload.userCount) : 0,
        workerCount: Number.isFinite(Number(analyticsPayload.workerCount)) ? Number(analyticsPayload.workerCount) : 0,
        bookingCount: Number.isFinite(Number(analyticsPayload.bookingCount)) ? Number(analyticsPayload.bookingCount) : 0,
        pendingWorkers: Number.isFinite(Number(analyticsPayload.pendingWorkers)) ? Number(analyticsPayload.pendingWorkers) : 0
      });
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
    if (firebaseAuth) {
      await signOutOfFirebase(firebaseAuth).catch(() => {});
    }
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
    const onPopState = () => {
      const normalizedPath = normalizeAdminPath(window.location.pathname);
      if (window.location.pathname !== normalizedPath) {
        window.history.replaceState({}, "", normalizedPath);
      }
      setLocationPath(normalizedPath);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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

  const loginWithGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const { auth } = await initializeFirebaseClient();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();
      const response = await api.post("/api/admin/firebase-login", { idToken });
      const token = response.data?.sessionToken;
      if (!token) throw new Error("Missing session token.");
      localStorage.setItem(ADMIN_SESSION_TOKEN_KEY, token);
      setEmail(response.data?.email || credential.user.email || "");
      setSessionToken(token);
    } catch (loginError) {
      if (firebaseAuth) {
        await signOutOfFirebase(firebaseAuth).catch(() => {});
      }
      setError(getFirebaseAuthErrorMessage(loginError));
    } finally {
      setGoogleLoading(false);
    }
  };

  const refreshApplicationInState = (updated) => {
    const normalized = normalizeApplication(updated);
    setApplications((current) => current.map((application) => (application.id === normalized.id ? normalized : application)));
    if (drawer?.id === normalized.id) {
      setDrawer(normalized);
    }
  };

  const updateApplicationStatus = async (applicationId, statusValue, options = {}) => {
    try {
      const response = await api.patch(`/api/admin/worker/status/${applicationId}`, {
        status: statusValue,
        adminNotes: requestNotes[applicationId] || "",
        sessionToken
      });
      if (response.data?.application) {
        refreshApplicationInState(response.data.application);
      } else {
        await loadData();
      }
      setBanner(response.data?.message || `Application ${applicationId} updated to ${statusValue}.`);
      if (options.closeDrawerOnSuccess) {
        setDrawer(null);
      }
    } catch (updateError) {
      if (updateError?.response?.status === 401) {
        setError("Admin session expired. Please login again.");
        await logout();
        return;
      }
      setError(updateError?.response?.data?.message || "Failed to update application.");
    }
  };

  const approveAndCreateAccount = async (application) => {
    if (!application?.id) return;

    const salary = Number(salaryDraft[application.id] ?? 18000);
    if (!Number.isFinite(salary) || salary < 0) {
      setError("Salary must be a valid positive number.");
      return;
    }

    setCreatingAccount(true);
    try {
      setError("");
      setBanner("");
      const response = await api.post(`/api/admin/worker-applications/${application.id}/approve-create-account`, {
        salary,
        adminNotes: requestNotes[application.id] || "",
        sessionToken
      });

      if (response.data?.application) {
        refreshApplicationInState(response.data.application);
      } else {
        await loadData();
      }
      await loadData();

      const message = response.data?.message || "Worker account created successfully and login details sent to email.";
      setSalaryDraft((current) => ({ ...current, [application.id]: salary }));
      setDrawer((current) => (current?.id === application.id ? null : current));

      if (response.data?.email?.sent) {
        setBanner(message);
      } else {
        pushToast("warning", message);
      }
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
    const nextPath = NAV_PATH_BY_LABEL[item] || DEFAULT_NAV_PATH;
    navigateToPath(nextPath);
    if (item !== "Category") {
      setSelectedCategory(null);
      setSubcategories([]);
      setLoadedSubcategoryCategoryId("");
    }
  };

  const openManageSubcategories = (category) => {
    if (!category?.id) return;
    setSelectedCategory(category);
    navigateToPath(subcategoryPathForCategory(category.id));
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

  const requestWorkerApplicationDelete = (application) => {
    if (!application?.id) return;
    setConfirmDialog({
      kind: "delete-worker-application",
      title: "Delete Worker Application",
      message: `Are you sure you want to delete the application for "${application.fullName || "-"}"?`,
      warning: "This action permanently removes the application and uploaded documents.",
      applicationId: application.id
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
      } else if (confirmDialog.kind === "delete-worker-application") {
        await api.delete(`/api/admin/worker-applications/${confirmDialog.applicationId}`, {
          data: { sessionToken }
        });
        if (drawer?.id === confirmDialog.applicationId) {
          setDrawer(null);
        }
        await loadData();
        pushToast("success", "Worker application deleted successfully.");
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
    const validation = validateSubcategoryDraft(newSubcategoryDraft);
    if (!validation.payload) {
      setError(validation.error);
      return;
    }
    const normalizedName = validation.payload.name;

    if (subcategories.some((item) => item.name.toLowerCase() === normalizedName.toLowerCase())) {
      setError("Subcategory already exists in this category.");
      return;
    }

    setAddingSubcategory(true);
    setError("");
    try {
      await api.post(`/api/admin/categories/${selectedCategory.id}/subcategories`, {
        ...validation.payload,
        sessionToken
      });
      setNewSubcategoryDraft(createEmptySubcategoryDraft());
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
    setSubcategoryEditModal({
      id: subcategory.id,
      ...normalizeSubcategoryDraft(subcategory)
    });
  };

  const saveSubcategoryEdit = async (event) => {
    event.preventDefault();
    if (!selectedCategory?.id || !subcategoryEditModal?.id) return;
    const validation = validateSubcategoryDraft(subcategoryEditModal);
    if (!validation.payload) {
      setError(validation.error);
      return;
    }

    setSavingSubcategoryEdit(true);
    setError("");
    try {
      await api.patch(
        `/api/admin/categories/${selectedCategory.id}/subcategories/${subcategoryEditModal.id}`,
        {
          ...validation.payload,
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
      accountCreated: applications.filter((application) => Boolean(application.approvedWorkerId)).length
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
                <div className="relative mt-1">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    className="erp-input pr-16"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    onClick={() => setShowLoginPassword((current) => !current)}
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}

	              <button type="submit" className="erp-btn erp-btn-primary w-full py-3 text-sm" disabled={loading || googleLoading}>
	                {loading ? "Signing in..." : "Sign In"}
	              </button>
	            </form>

	            <div className="my-4 flex items-center gap-3">
	              <span className="h-px flex-1 bg-slate-200" />
	              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">or</span>
	              <span className="h-px flex-1 bg-slate-200" />
	            </div>

	            <button
	              type="button"
	              className="erp-btn erp-btn-soft w-full py-3 text-sm"
	              onClick={loginWithGoogle}
	              disabled={loading || googleLoading}
	            >
	              {googleLoading ? "Connecting to Google..." : "Continue with Google"}
	            </button>
	          </div>
	        </div>
	      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="w-full space-y-4">
        <header className="erp-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-extrabold text-white">
                T
              </div>
              <div>
                <p className="erp-eyebrow">Tasko</p>
                <h1 className="erp-heading text-lg text-slate-900">Admin Panel</h1>
              </div>
            </div>

            <nav className="flex min-w-[240px] flex-1 flex-wrap items-center justify-center gap-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`erp-topnav-item ${active === item.label ? "erp-topnav-item-active" : ""}`}
                  onClick={() => handleNavClick(item.label)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="erp-btn erp-btn-soft" onClick={loadData} disabled={loadingData}>
                {loadingData ? "Refreshing..." : "Refresh"}
              </button>
              <button type="button" className="erp-btn erp-btn-danger" onClick={() => logout().catch(() => {})}>
                Logout
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="erp-eyebrow">Tasko Admin Panel</p>
            <h2 className="erp-heading text-2xl text-slate-900">Operations Console</h2>
          </div>
        </header>

        {error ? <div className="erp-card border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        {banner ? <div className="erp-card border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{banner}</div> : null}

        <main className="space-y-4">
            {active === "Dashboard" ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="erp-card p-4"><p className="erp-eyebrow">Applications</p><h2 className="text-2xl font-bold">{counts.applications}</h2></div>
                <div className="erp-card p-4"><p className="erp-eyebrow">Under Review</p><h2 className="text-2xl font-bold">{counts.underReview}</h2></div>
                <div className="erp-card p-4"><p className="erp-eyebrow">Visit Required</p><h2 className="text-2xl font-bold">{counts.visitRequired}</h2></div>
                <div className="erp-card p-4"><p className="erp-eyebrow">Account Created</p><h2 className="text-2xl font-bold">{counts.accountCreated}</h2></div>
                <div className="erp-card p-4 md:col-span-2 xl:col-span-4">
                  <p className="text-sm text-slate-600">
                    Users: {analytics.userCount || users.length} | Workers: {analytics.workerCount || workers.length} | Bookings:{" "}
                    {analytics.bookingCount || bookings.length}
                  </p>
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
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Category</th>
                      <th>Test Result</th>
                      <th>Applied Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-slate-500">No worker applications found.</td>
                      </tr>
                    ) : (
                      applications.map((application) => (
                        <tr key={application.id}>
                          <td>{application.fullName}</td>
                          <td>{application.email}</td>
                          <td>{application.phone}</td>
                          <td>{application.categoryApplied}</td>
                          <td>{application.testResult}</td>
                          <td>{date(application.appliedAt)}</td>
                          <td><Badge value={application.status} /></td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className="erp-btn erp-btn-soft" onClick={() => setDrawer(application)}>View Details</button>
                              <button type="button" className="erp-btn erp-btn-soft" onClick={() => updateApplicationStatus(application.id, "Approved")}>Approve</button>
                              <button type="button" className="erp-btn erp-btn-soft" onClick={() => updateApplicationStatus(application.id, "Visit Required")}>Mark as Visit Required</button>
                              <button type="button" className="erp-btn erp-btn-danger" onClick={() => updateApplicationStatus(application.id, "Rejected")}>Reject</button>
                              <button type="button" className="erp-btn erp-btn-danger" onClick={() => requestWorkerApplicationDelete(application)}>Delete</button>
                              <button
                                type="button"
                                className="erp-btn erp-btn-primary"
                                onClick={() => approveAndCreateAccount(application)}
                                disabled={creatingAccount || Boolean(application.approvedWorkerId)}
                              >
                                {application.approvedWorkerId ? "Account Created" : "Approve & Create Account"}
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

	            {active === "User Management" ? <UserManagement users={users} /> : null}

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

                    <form className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={addSubcategory}>
                      <label className="block xl:col-span-2">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Add Sub Category</span>
                        <input
                          type="text"
                          className="erp-input"
                          value={newSubcategoryDraft.name}
                          onChange={(event) =>
                            setNewSubcategoryDraft((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder="Enter sub category name"
                          maxLength={80}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Pricing Type</span>
                        <select
                          className="erp-input"
                          value={newSubcategoryDraft.pricingType}
                          onChange={(event) =>
                            setNewSubcategoryDraft((current) => ({
                              ...current,
                              pricingType: event.target.value,
                              unitLabel:
                                event.target.value === "per_hour"
                                  ? current.unitLabel || "hour"
                                  : event.target.value === "fixed" || event.target.value === "starting_at"
                                    ? ""
                                    : current.unitLabel
                            }))
                          }
                        >
                          {pricingTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Price</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="erp-input"
                          value={newSubcategoryDraft.price}
                          onChange={(event) =>
                            setNewSubcategoryDraft((current) => ({ ...current, price: event.target.value }))
                          }
                          placeholder="Enter price"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Unit Label</span>
                        <input
                          type="text"
                          className="erp-input"
                          value={newSubcategoryDraft.unitLabel}
                          onChange={(event) =>
                            setNewSubcategoryDraft((current) => ({ ...current, unitLabel: event.target.value }))
                          }
                          placeholder={
                            newSubcategoryDraft.pricingType === "per_hour"
                              ? "hour"
                              : newSubcategoryDraft.pricingType === "per_unit"
                                ? "set, bathroom, camera"
                                : "Not needed for fixed pricing"
                          }
                          disabled={
                            newSubcategoryDraft.pricingType === "fixed" ||
                            newSubcategoryDraft.pricingType === "starting_at"
                          }
                        />
                      </label>
                      <label className="block md:col-span-2 xl:col-span-3">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Pricing Notes</span>
                        <input
                          type="text"
                          className="erp-input"
                          value={newSubcategoryDraft.pricingNotes}
                          onChange={(event) =>
                            setNewSubcategoryDraft((current) => ({ ...current, pricingNotes: event.target.value }))
                          }
                          placeholder="Optional note such as material charges extra"
                          maxLength={180}
                        />
                      </label>
                      <div className="flex items-end">
                        <button type="submit" className="erp-btn erp-btn-primary w-full" disabled={addingSubcategory}>
                          {addingSubcategory ? "Adding..." : "Add Sub Category"}
                        </button>
                      </div>
                    </form>

                    <div className="overflow-x-auto">
                      <table className="erp-table">
                        <thead>
                          <tr>
                            <th>Serial Number</th>
                            <th>Sub Category Name</th>
                            <th>Pricing</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingSubcategories ? (
                            <tr>
                              <td colSpan={4} className="text-center text-slate-500">Loading sub categories...</td>
                            </tr>
                          ) : subcategories.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-center text-slate-500">No sub categories found.</td>
                            </tr>
                          ) : (
                            subcategories.map((subcategory, index) => (
                              <tr key={subcategory.id}>
                                <td>{index + 1}</td>
                                <td>{subcategory.name}</td>
                                <td>
                                  <div className="text-sm font-medium text-slate-900">{buildSubcategoryPriceSummary(subcategory)}</div>
                                  <div className="text-xs text-slate-500">
                                    {subcategory.pricingNotes || "No extra pricing note."}
                                  </div>
                                </td>
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
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Test Result</p><p className="mt-1 text-sm text-slate-900">{drawer.testResult || "-"}</p></div>
              {drawer.approvedWorkerId ? (
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Created Worker ID</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">{drawer.approvedWorkerId}</p>
                </div>
              ) : null}

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
                <button
                  type="button"
                  className="erp-btn erp-btn-soft"
                  onClick={() => updateApplicationStatus(drawer.id, drawer.status, { closeDrawerOnSuccess: true })}
                >
                  Save Review
                </button>
                <button type="button" className="erp-btn erp-btn-soft" onClick={() => updateApplicationStatus(drawer.id, "Approved")}>Approve</button>
                <button type="button" className="erp-btn erp-btn-danger" onClick={() => updateApplicationStatus(drawer.id, "Rejected")}>Reject</button>
                <button
                  type="button"
                  className="erp-btn erp-btn-primary"
                  onClick={() => approveAndCreateAccount(drawer)}
                  disabled={creatingAccount || Boolean(drawer.approvedWorkerId)}
                >
                  {drawer.approvedWorkerId ? "Account Created" : "Approve & Create Account"}
                </button>
              </div>
            </div>
          </aside>
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
                <p className="text-sm text-slate-500">Update sub category pricing and display details</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={() => setSubcategoryEditModal(null)} disabled={savingSubcategoryEdit}>
                X
              </button>
            </div>

            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveSubcategoryEdit}>
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
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Pricing Type</span>
                <select
                  className="erp-input"
                  value={subcategoryEditModal.pricingType}
                  onChange={(event) =>
                    setSubcategoryEditModal((current) =>
                      current
                        ? {
                            ...current,
                            pricingType: event.target.value,
                            unitLabel:
                              event.target.value === "per_hour"
                                ? current.unitLabel || "hour"
                                : event.target.value === "fixed" || event.target.value === "starting_at"
                                  ? ""
                                  : current.unitLabel
                          }
                        : current
                    )
                  }
                >
                  {pricingTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="erp-input"
                  value={subcategoryEditModal.price}
                  onChange={(event) =>
                    setSubcategoryEditModal((current) => (current ? { ...current, price: event.target.value } : current))
                  }
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Unit Label</span>
                <input
                  type="text"
                  className="erp-input"
                  value={subcategoryEditModal.unitLabel}
                  onChange={(event) =>
                    setSubcategoryEditModal((current) => (current ? { ...current, unitLabel: event.target.value } : current))
                  }
                  disabled={
                    subcategoryEditModal.pricingType === "fixed" ||
                    subcategoryEditModal.pricingType === "starting_at"
                  }
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Pricing Notes</span>
                <input
                  type="text"
                  className="erp-input"
                  value={subcategoryEditModal.pricingNotes}
                  onChange={(event) =>
                    setSubcategoryEditModal((current) =>
                      current ? { ...current, pricingNotes: event.target.value } : current
                    )
                  }
                  placeholder="Optional note such as material charges extra"
                  maxLength={180}
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-2 md:col-span-2">
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
                  : toast.type === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
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
