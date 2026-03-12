import { useEffect, useMemo, useState } from "react";
import api from "./api";

const BOOKING_STATUSES = ["pending", "assigned", "in_progress", "completed", "cancelled"];
const PACKAGE_BOOKING_STATUSES = ["pending", "active", "completed", "cancelled"];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBookingStatus(value) {
  const normalized = normalizeText(value).replace(/\s+/g, "_");
  if (BOOKING_STATUSES.includes(normalized)) return normalized;
  return "pending";
}

function toStatusLabel(value) {
  const normalized = normalizeBookingStatus(value);
  if (normalized === "in_progress") return "In Progress";
  return normalized
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function normalizeBookingType(value) {
  const normalized = normalizeText(value);
  return normalized === "package" ? "Package" : "One-time";
}

function parseWorkerCategories(value) {
  return String(value || "")
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

function workerMatchesCategory(workerCategory, bookingCategory) {
  const normalizedBookingCategory = normalizeText(bookingCategory);
  if (!normalizedBookingCategory) return true;

  const workerCategories = parseWorkerCategories(workerCategory);
  if (workerCategories.length === 0) return false;

  return workerCategories.some((category) => {
    if (category === normalizedBookingCategory) return true;
    if (category === "all" || category === "all categories") return true;
    return false;
  });
}

function formatDate(value) {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value) {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTimeSlot(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const parsed = new Date(`1970-01-01T${raw}`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toDateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function getBookingId(record) {
  return String(record?.booking_id || record?.bookingId || record?.id || "").trim();
}

function getWorkerId(record) {
  return String(record?.worker_id || record?.workerId || record?.id || "").trim();
}

function computeExperience(worker) {
  const explicit = worker?.experience ?? worker?.yearsOfExperience ?? worker?.experienceYears;
  if (Number.isFinite(Number(explicit))) {
    const years = Number(explicit);
    return `${years} year${years === 1 ? "" : "s"}`;
  }

  const joinedAt = worker?.joining_date || worker?.joiningDate || worker?.created_at || worker?.createdAt;
  const parsed = new Date(joinedAt || "");
  if (Number.isNaN(parsed.getTime())) return "-";

  const diffMs = Date.now() - parsed.getTime();
  const years = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365)));
  return `${years} year${years === 1 ? "" : "s"}`;
}

function statusClassName(status) {
  const normalized = normalizeBookingStatus(status);
  if (normalized === "pending") return "border-amber-200 bg-amber-100 text-amber-700";
  if (normalized === "assigned") return "border-blue-200 bg-blue-100 text-blue-700";
  if (normalized === "in_progress") return "border-orange-200 bg-orange-100 text-orange-700";
  if (normalized === "completed") return "border-emerald-200 bg-emerald-100 text-emerald-700";
  if (normalized === "cancelled") return "border-rose-200 bg-rose-100 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function normalizePackageBookingStatus(value) {
  const normalized = normalizeText(value).replace(/\s+/g, "_");
  if (PACKAGE_BOOKING_STATUSES.includes(normalized)) return normalized;
  return "pending";
}

function packageStatusClassName(status) {
  const normalized = normalizePackageBookingStatus(status);
  if (normalized === "pending") return "border-amber-200 bg-amber-100 text-amber-700";
  if (normalized === "active") return "border-blue-200 bg-blue-100 text-blue-700";
  if (normalized === "completed") return "border-emerald-200 bg-emerald-100 text-emerald-700";
  if (normalized === "cancelled") return "border-rose-200 bg-rose-100 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function normalizeBookingRecord(record, userLookup, workerLookup) {
  const bookingId = getBookingId(record);
  const userId = String(record?.user_id || record?.userId || "").trim();
  const user = userLookup.get(userId);

  const serviceCategory =
    String(
      record?.serviceCategory ||
        record?.service_category ||
        record?.service_category_name ||
        record?.service_category_id ||
        record?.category ||
        ""
    ).trim() || "-";

  const subCategory =
    String(
      record?.subCategory ||
        record?.sub_category ||
        record?.sub_category_name ||
        record?.sub_category_id ||
        record?.category ||
        ""
    ).trim() || "-";

  const serviceDate = String(record?.booking_date || record?.serviceDate || record?.date || "").trim();
  const timeSlot = String(record?.time_slot || record?.preferredTimeSlot || record?.time || "").trim();
  const bookingType = normalizeBookingType(record?.booking_type || record?.bookingType || record?.serviceType || record?.planType);
  const status = normalizeBookingStatus(record?.status);
  const assignedWorkerId = String(record?.assigned_worker_id || record?.assignedWorkerId || "").trim();
  const assignedWorker = workerLookup.get(assignedWorkerId);
  const notes = String(record?.specialInstructions || record?.notes || record?.workDescription || record?.userNotes || "").trim();

  const address =
    String(record?.address || record?.serviceAddress || record?.service_address || user?.address || "").trim() || "-";

  const userName =
    String(record?.user_name || record?.userName || user?.name || user?.full_name || user?.fullName || user?.mail || "-").trim() ||
    "-";

  const userPhone = String(record?.user_phone || record?.userPhone || user?.mobile || user?.number || user?.phone || "-").trim() || "-";
  const userEmail = String(record?.user_email || record?.userEmail || user?.email || user?.mail || "-").trim() || "-";
  const assignedWorkerName =
    String(record?.assigned_worker_name || record?.assignedWorkerName || assignedWorker?.name || "-").trim() || "-";

  return {
    bookingId,
    userId,
    userName,
    userPhone,
    userEmail,
    serviceCategory,
    subCategory,
    serviceDate,
    timeSlot,
    address,
    bookingType,
    status,
    assignedWorkerId,
    assignedWorkerName,
    notes,
    createdAt: record?.created_at || record?.createdAt || "",
    updatedAt: record?.updated_at || record?.updatedAt || "",
    raw: record
  };
}

function getPackageBookingId(record) {
  return String(record?.user_package_id || record?.bookingId || record?.id || "").trim();
}

function normalizePackageBookingRecord(record, userLookup, workerLookup) {
  const bookingId = getPackageBookingId(record);
  const userId = String(record?.user_id || record?.userId || "").trim();
  const user = userLookup.get(userId);
  const assignedWorkerId = String(record?.assigned_worker_id || record?.assignedWorkerId || "").trim();
  const assignedWorker = workerLookup.get(assignedWorkerId);
  const street = String(record?.street || "").trim();
  const city = String(record?.city || "").trim();
  const pincode = String(record?.pincode || "").trim();

  return {
    bookingId,
    userId,
    userName:
      String(record?.user_name || record?.userName || user?.name || user?.full_name || user?.mail || "-").trim() || "-",
    packageName: String(record?.package_name || record?.packageName || "-").trim() || "-",
    address:
      String(record?.fullAddress || [street, city, pincode].filter(Boolean).join(", ") || user?.address || "-").trim() || "-",
    addressTitle: String(record?.address_title || record?.addressTitle || "").trim(),
    startDate: String(record?.start_date || record?.startDate || "").trim(),
    endDate: String(record?.end_date || record?.endDate || "").trim(),
    status: normalizePackageBookingStatus(record?.status),
    assignedWorkerId,
    assignedWorkerName:
      String(record?.assigned_worker_name || record?.assignedWorkerName || assignedWorker?.name || "-").trim() || "-",
    timeSlot: String(record?.time_slot || record?.timeSlot || "").trim(),
    paymentStatus: String(record?.payment_status || record?.paymentStatus || "").trim() || "-",
    createdAt: record?.created_at || record?.createdAt || "",
    updatedAt: record?.updated_at || record?.updatedAt || "",
    raw: record
  };
}

export default function BookingsManagement({ bookings, workers, users, setBookings, pushToast }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [assignModal, setAssignModal] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState("");
  const [packageBookings, setPackageBookings] = useState([]);
  const [packageBookingsLoading, setPackageBookingsLoading] = useState(false);
  const [selectedPackageBookingId, setSelectedPackageBookingId] = useState("");
  const [packageAssignModal, setPackageAssignModal] = useState(null);
  const [selectedPackageWorkerId, setSelectedPackageWorkerId] = useState("");
  const [assigningPackageWorker, setAssigningPackageWorker] = useState(false);
  const [packageStatusModal, setPackageStatusModal] = useState(null);
  const [packageStatusDraft, setPackageStatusDraft] = useState("pending");
  const [updatingPackageStatus, setUpdatingPackageStatus] = useState(false);

  const userLookup = useMemo(() => {
    const map = new Map();
    (Array.isArray(users) ? users : []).forEach((user) => {
      const key = String(user?.id || user?.uid || "").trim();
      if (!key) return;
      map.set(key, user);
    });
    return map;
  }, [users]);

  const normalizedWorkers = useMemo(
    () =>
      (Array.isArray(workers) ? workers : []).map((worker) => {
        const workerId = getWorkerId(worker);
        return {
          workerId,
          name: String(worker?.full_name || worker?.fullName || worker?.name || workerId || "-").trim() || "-",
          category: String(worker?.category || "").trim(),
          status: normalizeText(worker?.status || "active"),
          online: Boolean(worker?.online),
          rating: Number.isFinite(Number(worker?.rating)) ? Number(worker.rating) : 0,
          experience: computeExperience(worker)
        };
      }),
    [workers]
  );

  const workerLookup = useMemo(() => {
    const map = new Map();
    normalizedWorkers.forEach((worker) => {
      if (!worker.workerId) return;
      map.set(worker.workerId, worker);
    });
    return map;
  }, [normalizedWorkers]);

  const normalizedBookings = useMemo(
    () =>
      (Array.isArray(bookings) ? bookings : [])
        .map((record) => normalizeBookingRecord(record, userLookup, workerLookup))
        .filter((booking) => booking.bookingId),
    [bookings, userLookup, workerLookup]
  );

  const normalizedPackageBookings = useMemo(
    () =>
      (Array.isArray(packageBookings) ? packageBookings : [])
        .map((record) => normalizePackageBookingRecord(record, userLookup, workerLookup))
        .filter((booking) => booking.bookingId),
    [packageBookings, userLookup, workerLookup]
  );

  useEffect(() => {
    const loadPackageBookings = async () => {
      setPackageBookingsLoading(true);
      try {
        const response = await api.get("/api/package-subscriptions");
        setPackageBookings(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        pushToast?.("error", error?.response?.data?.message || "Failed to load package bookings.");
        setPackageBookings([]);
      } finally {
        setPackageBookingsLoading(false);
      }
    };

    loadPackageBookings().catch(() => {
      setPackageBookingsLoading(false);
      setPackageBookings([]);
    });
  }, [pushToast]);

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(normalizedBookings.map((booking) => booking.serviceCategory).filter((value) => value && value !== "-"))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [normalizedBookings]
  );

  const filteredBookings = useMemo(() => {
    const normalizedSearch = normalizeText(searchText);
    return normalizedBookings.filter((booking) => {
      const matchesStatus = !statusFilter || booking.status === statusFilter;
      const matchesCategory = !categoryFilter || booking.serviceCategory === categoryFilter;
      const matchesDate = !dateFilter || toDateKey(booking.serviceDate) === toDateKey(dateFilter);
      const matchesSearch =
        !normalizedSearch ||
        normalizeText(booking.bookingId).includes(normalizedSearch) ||
        normalizeText(booking.userName).includes(normalizedSearch);

      return matchesStatus && matchesCategory && matchesDate && matchesSearch;
    });
  }, [normalizedBookings, statusFilter, categoryFilter, dateFilter, searchText]);

  const selectedBooking = useMemo(
    () => normalizedBookings.find((booking) => booking.bookingId === selectedBookingId) || null,
    [normalizedBookings, selectedBookingId]
  );

  const bookingForAssignment = useMemo(
    () => normalizedBookings.find((booking) => booking.bookingId === assignModal?.bookingId) || null,
    [normalizedBookings, assignModal]
  );

  const selectedPackageBooking = useMemo(
    () => normalizedPackageBookings.find((booking) => booking.bookingId === selectedPackageBookingId) || null,
    [normalizedPackageBookings, selectedPackageBookingId]
  );

  const packageBookingForAssignment = useMemo(
    () => normalizedPackageBookings.find((booking) => booking.bookingId === packageAssignModal?.bookingId) || null,
    [normalizedPackageBookings, packageAssignModal]
  );

  const availableWorkers = useMemo(() => {
    const category = normalizeText(bookingForAssignment?.serviceCategory);
    return normalizedWorkers
      .filter((worker) => worker.status === "active")
      .filter((worker) => workerMatchesCategory(worker.category, category))
      .sort((left, right) => {
        if (left.online !== right.online) return left.online ? -1 : 1;
        return right.rating - left.rating;
      });
  }, [bookingForAssignment?.serviceCategory, normalizedWorkers]);

  const availablePackageWorkers = useMemo(
    () =>
      normalizedWorkers
        .filter((worker) => worker.status === "active")
        .sort((left, right) => {
          if (left.online !== right.online) return left.online ? -1 : 1;
          return right.rating - left.rating;
        }),
    [normalizedWorkers]
  );

  const updateBookingInState = (bookingId, updater) => {
    setBookings((current) =>
      (Array.isArray(current) ? current : []).map((record) => {
        const recordBookingId = getBookingId(record);
        if (recordBookingId !== bookingId) return record;
        return updater(record);
      })
    );
  };

  const openAssignModal = (booking) => {
    setAssignModal({ bookingId: booking.bookingId });
    setSelectedWorkerId(booking.assignedWorkerId || "");
  };

  const closeAssignModal = () => {
    if (assigning) return;
    setAssignModal(null);
    setSelectedWorkerId("");
  };

  const assignWorker = async () => {
    if (!bookingForAssignment?.bookingId || !selectedWorkerId) {
      pushToast?.("error", "Please select a worker before assigning.");
      return;
    }

    setAssigning(true);
    try {
      await api.post("/api/jobs/assign", {
        bookingId: bookingForAssignment.bookingId,
        workerId: selectedWorkerId
      });

      updateBookingInState(bookingForAssignment.bookingId, (record) => ({
        ...record,
        assignedWorkerId: selectedWorkerId,
        assigned_worker_id: selectedWorkerId,
        status: "assigned",
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      pushToast?.("success", "Worker assigned successfully.");
      closeAssignModal();
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to assign worker.";
      pushToast?.("error", message);
    } finally {
      setAssigning(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    if (!bookingId) return;
    setCancellingBookingId(bookingId);
    try {
      await api.patch(`/api/bookings/${encodeURIComponent(bookingId)}/status`, {
        status: "cancelled"
      });

      updateBookingInState(bookingId, (record) => ({
        ...record,
        status: "cancelled",
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      pushToast?.("success", "Booking cancelled successfully.");
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to cancel booking.";
      pushToast?.("error", message);
    } finally {
      setCancellingBookingId("");
    }
  };

  const openPackageAssignModal = (booking) => {
    setPackageAssignModal({ bookingId: booking.bookingId });
    setSelectedPackageWorkerId(booking.assignedWorkerId || "");
  };

  const closePackageAssignModal = () => {
    if (assigningPackageWorker) return;
    setPackageAssignModal(null);
    setSelectedPackageWorkerId("");
  };

  const assignPackageWorker = async () => {
    if (!packageBookingForAssignment?.bookingId || !selectedPackageWorkerId) {
      pushToast?.("error", "Please select a worker before assigning.");
      return;
    }

    const selectedWorker = workerLookup.get(selectedPackageWorkerId);
    setAssigningPackageWorker(true);
    try {
      await api.patch(`/api/package-subscriptions/${packageBookingForAssignment.bookingId}/assign-worker`, {
        workerId: selectedPackageWorkerId,
        workerName: selectedWorker?.name || ""
      });

      setPackageBookings((current) =>
        (Array.isArray(current) ? current : []).map((record) =>
          getPackageBookingId(record) === packageBookingForAssignment.bookingId
            ? {
                ...record,
                assigned_worker_id: selectedPackageWorkerId,
                assignedWorkerId: selectedPackageWorkerId,
                assigned_worker_name: selectedWorker?.name || "",
                assignedWorkerName: selectedWorker?.name || "",
                updatedAt: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            : record
        )
      );

      pushToast?.("success", "Worker assigned to package booking successfully.");
      closePackageAssignModal();
    } catch (error) {
      pushToast?.("error", error?.response?.data?.message || "Failed to assign worker to package booking.");
    } finally {
      setAssigningPackageWorker(false);
    }
  };

  const openPackageStatusModal = (booking) => {
    setPackageStatusModal({ bookingId: booking.bookingId });
    setPackageStatusDraft(booking.status || "pending");
  };

  const closePackageStatusModal = () => {
    if (updatingPackageStatus) return;
    setPackageStatusModal(null);
  };

  const updatePackageBookingStatus = async () => {
    if (!packageStatusModal?.bookingId) return;

    setUpdatingPackageStatus(true);
    try {
      await api.patch(`/api/package-subscriptions/${packageStatusModal.bookingId}/status`, {
        status: packageStatusDraft
      });

      setPackageBookings((current) =>
        (Array.isArray(current) ? current : []).map((record) =>
          getPackageBookingId(record) === packageStatusModal.bookingId
            ? {
                ...record,
                status: packageStatusDraft,
                updatedAt: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            : record
        )
      );

      pushToast?.("success", "Package booking status updated successfully.");
      closePackageStatusModal();
    } catch (error) {
      pushToast?.("error", error?.response?.data?.message || "Failed to update package booking status.");
    } finally {
      setUpdatingPackageStatus(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="erp-card p-5">
        <p className="erp-eyebrow">Admin Module</p>
        <h2 className="text-xl font-semibold text-slate-900">Bookings Management</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage booking lifecycle, assign workers, and review complete booking details.
        </p>
      </div>

      <div className="erp-card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Filters</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Status</span>
            <select className="erp-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All Statuses</option>
              {BOOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {toStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Service Category</span>
            <select className="erp-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All Categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Service Date</span>
            <input type="date" className="erp-input" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Search</span>
            <input
              type="text"
              className="erp-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Booking ID or User Name"
            />
          </label>
        </div>
      </div>

      <div className="erp-card overflow-x-auto p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Service Bookings</h3>
          <p className="text-sm text-slate-500">
            Manage one-time and service bookings, worker assignment, and booking lifecycle.
          </p>
        </div>

        <table className="erp-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>User Name</th>
              <th>Service Category</th>
              <th>Sub Category</th>
              <th>Service Date</th>
              <th>Time Slot</th>
              <th>Address</th>
              <th>Booking Type</th>
              <th>Status</th>
              <th>Assigned Worker</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center text-slate-500">
                  No bookings found for selected filters.
                </td>
              </tr>
            ) : (
              filteredBookings.map((booking) => (
                <tr key={booking.bookingId}>
                  <td>
                    <button
                      type="button"
                      className="text-left font-semibold text-slate-900 underline decoration-dotted underline-offset-4"
                      onClick={() => setSelectedBookingId(booking.bookingId)}
                    >
                      {booking.bookingId}
                    </button>
                  </td>
                  <td>{booking.userName}</td>
                  <td>{booking.serviceCategory}</td>
                  <td>{booking.subCategory}</td>
                  <td>{formatDate(booking.serviceDate)}</td>
                  <td>{formatTimeSlot(booking.timeSlot)}</td>
                  <td className="max-w-[220px] whitespace-normal">{booking.address}</td>
                  <td>{booking.bookingType}</td>
                  <td>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClassName(booking.status)}`}>
                      {toStatusLabel(booking.status)}
                    </span>
                  </td>
                  <td>{booking.assignedWorkerName}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="erp-btn erp-btn-soft" onClick={() => setSelectedBookingId(booking.bookingId)}>
                        View
                      </button>
                      <button type="button" className="erp-btn erp-btn-primary" onClick={() => openAssignModal(booking)}>
                        {booking.assignedWorkerId ? "Reassign Worker" : "Assign Worker"}
                      </button>
                      <button
                        type="button"
                        className="erp-btn erp-btn-danger"
                        onClick={() => cancelBooking(booking.bookingId)}
                        disabled={cancellingBookingId === booking.bookingId || booking.status === "cancelled"}
                      >
                        {cancellingBookingId === booking.bookingId ? "Cancelling..." : "Cancel Booking"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="erp-card overflow-x-auto p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Package Bookings</h3>
          <p className="text-sm text-slate-500">
            Review active package subscriptions, assign workers, and manage subscription status.
          </p>
        </div>

        <table className="erp-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>User Name</th>
              <th>Package Name</th>
              <th>Address</th>
              <th>Subscription Start Date</th>
              <th>Subscription End Date</th>
              <th>Status</th>
              <th>Assigned Worker</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {packageBookingsLoading ? (
              <tr>
                <td colSpan={9} className="text-center text-slate-500">
                  Loading package bookings...
                </td>
              </tr>
            ) : normalizedPackageBookings.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-slate-500">
                  No Package Bookings Available
                </td>
              </tr>
            ) : (
              normalizedPackageBookings.map((booking) => (
                <tr key={booking.bookingId}>
                  <td>
                    <button
                      type="button"
                      className="text-left font-semibold text-slate-900 underline decoration-dotted underline-offset-4"
                      onClick={() => setSelectedPackageBookingId(booking.bookingId)}
                    >
                      {booking.bookingId}
                    </button>
                  </td>
                  <td>{booking.userName}</td>
                  <td>{booking.packageName}</td>
                  <td className="max-w-[220px] whitespace-normal">{booking.address}</td>
                  <td>{formatDate(booking.startDate)}</td>
                  <td>{formatDate(booking.endDate)}</td>
                  <td>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${packageStatusClassName(booking.status)}`}>
                      {toStatusLabel(booking.status)}
                    </span>
                  </td>
                  <td>{booking.assignedWorkerName}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="erp-btn erp-btn-soft" onClick={() => setSelectedPackageBookingId(booking.bookingId)}>
                        View Details
                      </button>
                      <button type="button" className="erp-btn erp-btn-primary" onClick={() => openPackageAssignModal(booking)}>
                        {booking.assignedWorkerId ? "Assign Worker" : "Assign Worker"}
                      </button>
                      <button type="button" className="erp-btn erp-btn-soft" onClick={() => openPackageStatusModal(booking)}>
                        Update Status
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {assignModal ? (
        <div className="erp-drawer-overlay items-center justify-center" onClick={closeAssignModal}>
          <div
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Assign Worker</h3>
                <p className="text-sm text-slate-500">
                  Booking {bookingForAssignment?.bookingId || "-"} | Category: {bookingForAssignment?.serviceCategory || "-"}
                </p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={closeAssignModal} disabled={assigning}>
                X
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Worker Name</th>
                    <th>Rating</th>
                    <th>Experience</th>
                    <th>Online Status</th>
                  </tr>
                </thead>
                <tbody>
                  {availableWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-500">
                        No active workers found for this service category.
                      </td>
                    </tr>
                  ) : (
                    availableWorkers.map((worker) => (
                      <tr key={worker.workerId}>
                        <td>
                          <input
                            type="radio"
                            name="assignedWorker"
                            value={worker.workerId}
                            checked={selectedWorkerId === worker.workerId}
                            onChange={(event) => setSelectedWorkerId(event.target.value)}
                          />
                        </td>
                        <td>{worker.name}</td>
                        <td>{worker.rating.toFixed(1)}</td>
                        <td>{worker.experience}</td>
                        <td>
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${
                              worker.online
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {worker.online ? "Online" : "Offline"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="erp-btn erp-btn-soft" onClick={closeAssignModal} disabled={assigning}>
                Close
              </button>
              <button
                type="button"
                className="erp-btn erp-btn-primary"
                onClick={assignWorker}
                disabled={assigning || !selectedWorkerId}
              >
                {assigning ? "Assigning..." : "Assign Worker"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {packageAssignModal ? (
        <div className="erp-drawer-overlay items-center justify-center" onClick={closePackageAssignModal}>
          <div
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Assign Worker</h3>
                <p className="text-sm text-slate-500">
                  Package Booking {packageBookingForAssignment?.bookingId || "-"} | {packageBookingForAssignment?.packageName || "-"}
                </p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={closePackageAssignModal} disabled={assigningPackageWorker}>
                X
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Worker Name</th>
                    <th>Category</th>
                    <th>Rating</th>
                    <th>Experience</th>
                    <th>Online Status</th>
                  </tr>
                </thead>
                <tbody>
                  {availablePackageWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-slate-500">
                        No active workers found.
                      </td>
                    </tr>
                  ) : (
                    availablePackageWorkers.map((worker) => (
                      <tr key={worker.workerId}>
                        <td>
                          <input
                            type="radio"
                            name="assignedPackageWorker"
                            value={worker.workerId}
                            checked={selectedPackageWorkerId === worker.workerId}
                            onChange={(event) => setSelectedPackageWorkerId(event.target.value)}
                          />
                        </td>
                        <td>{worker.name}</td>
                        <td>{worker.category || "-"}</td>
                        <td>{worker.rating.toFixed(1)}</td>
                        <td>{worker.experience}</td>
                        <td>
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${
                              worker.online
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {worker.online ? "Online" : "Offline"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="erp-btn erp-btn-soft" onClick={closePackageAssignModal} disabled={assigningPackageWorker}>
                Close
              </button>
              <button
                type="button"
                className="erp-btn erp-btn-primary"
                onClick={assignPackageWorker}
                disabled={assigningPackageWorker || !selectedPackageWorkerId}
              >
                {assigningPackageWorker ? "Assigning..." : "Assign Worker"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {packageStatusModal ? (
        <div className="erp-drawer-overlay items-center justify-center" onClick={closePackageStatusModal}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Update Package Status</h3>
                <p className="text-sm text-slate-500">Booking ID: {packageStatusModal.bookingId}</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={closePackageStatusModal} disabled={updatingPackageStatus}>
                X
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Status</span>
              <select className="erp-select" value={packageStatusDraft} onChange={(event) => setPackageStatusDraft(event.target.value)}>
                {PACKAGE_BOOKING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {toStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="erp-btn erp-btn-soft" onClick={closePackageStatusModal} disabled={updatingPackageStatus}>
                Cancel
              </button>
              <button type="button" className="erp-btn erp-btn-primary" onClick={updatePackageBookingStatus} disabled={updatingPackageStatus}>
                {updatingPackageStatus ? "Saving..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedBooking ? (
        <div className="erp-drawer-overlay" onClick={() => setSelectedBookingId("")}>
          <aside className="erp-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Booking Details</h3>
                <p className="text-sm text-slate-500">Booking ID: {selectedBooking.bookingId}</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={() => setSelectedBookingId("")}>
                X
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">User Details</p>
                <p className="mt-1 font-medium text-slate-900">{selectedBooking.userName}</p>
                <p>User ID: {selectedBooking.userId || "-"}</p>
                <p>Phone: {selectedBooking.userPhone}</p>
                <p>Email: {selectedBooking.userEmail}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Service Details</p>
                <p className="mt-1">Category: {selectedBooking.serviceCategory}</p>
                <p>Sub Category: {selectedBooking.subCategory}</p>
                <p>Booking Type: {selectedBooking.bookingType}</p>
                <p>Pricing Model: {toStatusLabel(selectedBooking.raw?.pricingModel || "-")}</p>
                <p>Payment Status: {toStatusLabel(selectedBooking.raw?.paymentStatus || "pending")}</p>
                <p>Approval Status: {toStatusLabel(selectedBooking.raw?.approvalStatus || "not_required")}</p>
                <p>Final Price: {Number.isFinite(Number(selectedBooking.raw?.finalPrice)) ? `₹${Number(selectedBooking.raw.finalPrice)}` : "-"}</p>
                {selectedBooking.raw?.selectedPackage?.name ? <p>Package: {selectedBooking.raw.selectedPackage.name}</p> : null}
                {selectedBooking.raw?.selectedUnits ? <p>Units: {selectedBooking.raw.selectedUnits}</p> : null}
                {selectedBooking.raw?.selectedHours ? <p>Hours: {selectedBooking.raw.selectedHours}</p> : null}
                {selectedBooking.raw?.selectedMeal?.name ? <p>Meal: {selectedBooking.raw.selectedMeal.name}</p> : null}
                {selectedBooking.raw?.visitCharge ? <p>Visit Charge: ₹{Number(selectedBooking.raw.visitCharge)}</p> : null}
                <p>
                  Status:{" "}
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClassName(selectedBooking.status)}`}>
                    {toStatusLabel(selectedBooking.status)}
                  </span>
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Address</p>
                <p className="mt-1 text-slate-900">{selectedBooking.address}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Date & Time</p>
                <p className="mt-1 text-slate-900">
                  {formatDate(selectedBooking.serviceDate)} at {formatTimeSlot(selectedBooking.timeSlot)}
                </p>
                <p className="text-xs text-slate-500">Created: {formatDateTime(selectedBooking.createdAt)}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Notes from User</p>
                <p className="mt-1 text-slate-900">{selectedBooking.notes || "No notes provided."}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Assigned Worker</p>
                <p className="mt-1 text-slate-900">{selectedBooking.assignedWorkerName}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="erp-btn erp-btn-primary" onClick={() => openAssignModal(selectedBooking)}>
                  {selectedBooking.assignedWorkerId ? "Reassign Worker" : "Assign Worker"}
                </button>
                <button
                  type="button"
                  className="erp-btn erp-btn-danger"
                  onClick={() => cancelBooking(selectedBooking.bookingId)}
                  disabled={cancellingBookingId === selectedBooking.bookingId || selectedBooking.status === "cancelled"}
                >
                  {cancellingBookingId === selectedBooking.bookingId ? "Cancelling..." : "Cancel Booking"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {selectedPackageBooking ? (
        <div className="erp-drawer-overlay" onClick={() => setSelectedPackageBookingId("")}>
          <aside className="erp-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Package Booking Details</h3>
                <p className="text-sm text-slate-500">Booking ID: {selectedPackageBooking.bookingId}</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={() => setSelectedPackageBookingId("")}>
                X
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">User Details</p>
                <p className="mt-1 font-medium text-slate-900">{selectedPackageBooking.userName}</p>
                <p>User ID: {selectedPackageBooking.userId || "-"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Package</p>
                <p className="mt-1 text-slate-900">{selectedPackageBooking.packageName}</p>
                <p>Time Slot: {selectedPackageBooking.timeSlot || "-"}</p>
                <p>Payment Status: {toStatusLabel(selectedPackageBooking.paymentStatus)}</p>
                <p>
                  Status:{" "}
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${packageStatusClassName(selectedPackageBooking.status)}`}>
                    {toStatusLabel(selectedPackageBooking.status)}
                  </span>
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Address</p>
                <p className="mt-1 text-slate-900">{selectedPackageBooking.addressTitle || "Saved Address"}</p>
                <p>{selectedPackageBooking.address}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Subscription Period</p>
                <p className="mt-1 text-slate-900">
                  {formatDate(selectedPackageBooking.startDate)} to {formatDate(selectedPackageBooking.endDate)}
                </p>
                <p className="text-xs text-slate-500">Created: {formatDateTime(selectedPackageBooking.createdAt)}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Assigned Worker</p>
                <p className="mt-1 text-slate-900">{selectedPackageBooking.assignedWorkerName}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="erp-btn erp-btn-primary" onClick={() => openPackageAssignModal(selectedPackageBooking)}>
                  Assign Worker
                </button>
                <button type="button" className="erp-btn erp-btn-soft" onClick={() => openPackageStatusModal(selectedPackageBooking)}>
                  Update Status
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
