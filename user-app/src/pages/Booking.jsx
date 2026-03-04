import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import UserPortalShell from "../components/UserPortalShell";
import { serviceCategories } from "./homeData";

const tabs = [
  { id: "current", label: "Current" },
  { id: "upcoming", label: "Upcoming" },
  { id: "old", label: "Old" }
];

const oldStatuses = new Set(["completed", "cancelled"]);

const fallbackServiceCatalog = serviceCategories.flatMap((category) =>
  category.subcategories.map((subCategoryName) => ({
    categoryName: category.name,
    subCategoryName
  }))
);

function formatTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toCatalogKey(categoryName, subCategoryName) {
  return `${normalizeText(categoryName)}||${normalizeText(subCategoryName)}`;
}

function resolveServiceSelection(queryValue, catalog) {
  const normalizedQuery = normalizeText(queryValue);
  if (!normalizedQuery) {
    return { serviceCategory: "", subCategory: "" };
  }

  const categoryMatch = catalog.find((item) => normalizeText(item.categoryName) === normalizedQuery);
  if (categoryMatch) {
    return {
      serviceCategory: categoryMatch.categoryName,
      subCategory: ""
    };
  }

  const subCategoryMatch = catalog.find((item) => normalizeText(item.subCategoryName) === normalizedQuery);
  if (subCategoryMatch) {
    return {
      serviceCategory: subCategoryMatch.categoryName,
      subCategory: subCategoryMatch.subCategoryName
    };
  }

  return {
    serviceCategory: "",
    subCategory: String(queryValue || "").trim()
  };
}

function toStatusLabel(status) {
  const normalized = String(status || "pending")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) return "Pending";

  return normalized
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function toDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    const seconds = Number(value._seconds ?? value.seconds);
    const nanoseconds = Number(value._nanoseconds ?? value.nanoseconds ?? 0);

    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000 + Math.floor(nanoseconds / 1000000));
    }
  }

  return null;
}

function parseBookingSlot(booking) {
  const rawDate = String(booking?.serviceDate || booking?.date || "").trim();
  const rawTime = String(booking?.preferredTimeSlot || booking?.time || "").trim();

  if (!rawDate) return null;

  const combined = rawTime ? `${rawDate}T${rawTime}` : rawDate;
  const parsed = new Date(combined);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(rawDate);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getBookingBucket(booking) {
  const status = String(booking?.status || "").toLowerCase();
  if (oldStatuses.has(status)) {
    return "old";
  }

  const slot = parseBookingSlot(booking);
  if (slot && slot.getTime() > Date.now()) {
    return "upcoming";
  }

  return "current";
}

function formatSlotDate(booking) {
  const slot = parseBookingSlot(booking);
  if (!slot) return booking?.serviceDate || booking?.date || "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(slot);
}

function formatSlotTime(booking) {
  const rawTime = String(booking?.preferredTimeSlot || booking?.time || "").trim();
  if (!rawTime) return "-";

  const parsed = new Date(`1970-01-01T${rawTime}`);
  if (Number.isNaN(parsed.getTime())) return rawTime;

  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(parsed);
}

function formatDateTime(value) {
  const parsed = toDateValue(value);
  if (!parsed) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function bookingSortTime(booking) {
  return (
    parseBookingSlot(booking)?.getTime() ||
    toDateValue(booking?.updatedAt)?.getTime() ||
    toDateValue(booking?.createdAt)?.getTime() ||
    0
  );
}

export default function BookingPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [workerDirectory, setWorkerDirectory] = useState({});
  const [activeTab, setActiveTab] = useState("current");
  const [formMessage, setFormMessage] = useState("");
  const [bookingsMessage, setBookingsMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [updatingBookingId, setUpdatingBookingId] = useState("");

  const [formData, setFormData] = useState({
    serviceCategory: "",
    subCategory: searchParams.get("category") || "",
    serviceType: "one-time",
    packageId: "",
    workDescription: "",
    serviceDate: "",
    preferredTimeSlot: "",
    duration: "",
    recurringDays: "",
    specialInstructions: ""
  });

  useEffect(() => {
    const loadCatalogs = async () => {
      const [servicesRes, packagesRes] = await Promise.all([api.get("/api/services"), api.get("/api/packages")]);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setPackages(Array.isArray(packagesRes.data) ? packagesRes.data : []);
    };

    loadCatalogs().catch(() => {
      setServices([
        { id: "home-cleaning", category: "Cleaning", name: "House Cleaning" },
        { id: "plumbing", category: "Plumbing", name: "Pipe Leakage Fix" },
        { id: "ac-repair", category: "Technical & Installation Services", name: "AC Repair" }
      ]);
      setPackages([]);
    });
  }, []);

  const serviceCatalog = useMemo(() => {
    const fromApi = services
      .map((service) => ({
        categoryName: String(service?.category || "").trim(),
        subCategoryName: String(service?.name || service?.category || "").trim()
      }))
      .filter((item) => item.categoryName && item.subCategoryName);

    const merged = new Map();

    [...fallbackServiceCatalog, ...fromApi].forEach((item) => {
      const key = toCatalogKey(item.categoryName, item.subCategoryName);
      if (!key || merged.has(key)) return;
      merged.set(key, item);
    });

    return Array.from(merged.values());
  }, [services]);

  useEffect(() => {
    const categoryFromQuery = searchParams.get("category");
    if (!categoryFromQuery) return;

    const selection = resolveServiceSelection(categoryFromQuery, serviceCatalog);
    setFormData((current) => ({
      ...current,
      serviceCategory: selection.serviceCategory,
      subCategory: selection.subCategory
    }));
  }, [searchParams, serviceCatalog]);

  const loadBookings = useCallback(async () => {
    if (!user?.uid) {
      setBookings([]);
      return;
    }

    setBookingsLoading(true);
    setBookingsMessage("");

    try {
      const response = await api.get("/api/bookings", {
        params: { userId: user.uid }
      });
      setBookings(Array.isArray(response.data) ? response.data : []);
    } catch (_error) {
      setBookings([]);
      setBookingsMessage("Unable to load bookings right now.");
    } finally {
      setBookingsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadBookings().catch(() => {
      setBookings([]);
      setBookingsLoading(false);
      setBookingsMessage("Unable to load bookings right now.");
    });
  }, [loadBookings]);

  useEffect(() => {
    const workerIds = Array.from(new Set(bookings.map((booking) => booking.assignedWorkerId).filter(Boolean)));
    if (workerIds.length === 0) return;

    Promise.all(
      workerIds.map((workerId) =>
        api
          .get(`/api/workers/${workerId}`)
          .then((response) => ({
            workerId,
            name: response.data?.name || "Assigned Worker",
            phone: response.data?.number || response.data?.mobile || ""
          }))
          .catch(() => ({
            workerId,
            name: "Assigned Worker",
            phone: ""
          }))
      )
    ).then((workers) => {
      setWorkerDirectory((current) => {
        const next = { ...current };
        workers.forEach((worker) => {
          next[worker.workerId] = worker;
        });
        return next;
      });
    });
  }, [bookings]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(serviceCatalog.map((item) => item.categoryName))),
    [serviceCatalog]
  );

  const subCategoryOptions = useMemo(() => {
    const normalizedCategory = normalizeText(formData.serviceCategory);
    if (!normalizedCategory) return [];

    return Array.from(
      new Set(
        serviceCatalog
          .filter((item) => normalizeText(item.categoryName) === normalizedCategory)
          .map((item) => item.subCategoryName)
      )
    );
  }, [formData.serviceCategory, serviceCatalog]);

  const packageOptions = useMemo(
    () =>
      packages.map((pkg) => ({
        value: String(pkg.package_id || pkg.id || pkg.name || ""),
        label: pkg.package_name || pkg.name || pkg.serviceType || "Package Plan"
      })),
    [packages]
  );

  const packageLabelMap = useMemo(
    () =>
      packageOptions.reduce((acc, item) => {
        acc[item.value] = item.label;
        return acc;
      }, {}),
    [packageOptions]
  );

  const bookingCounts = useMemo(
    () =>
      bookings.reduce(
        (acc, booking) => {
          const bucket = getBookingBucket(booking);
          acc[bucket] += 1;
          return acc;
        },
        { current: 0, upcoming: 0, old: 0 }
      ),
    [bookings]
  );

  const visibleBookings = useMemo(() => {
    const filtered = bookings.filter((booking) => getBookingBucket(booking) === activeTab);
    const sorted = [...filtered];

    sorted.sort((left, right) => {
      const leftTime = bookingSortTime(left);
      const rightTime = bookingSortTime(right);

      if (activeTab === "upcoming") {
        return leftTime - rightTime;
      }

      return rightTime - leftTime;
    });

    return sorted;
  }, [activeTab, bookings]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    if (!formData.serviceCategory || !formData.subCategory || !formData.serviceDate || !formData.preferredTimeSlot) {
      setFormMessage("Please provide category, sub category, service date and preferred time slot.");
      return;
    }

    if (formData.serviceType === "package" && !formData.packageId) {
      setFormMessage("Please choose a package plan before submitting.");
      return;
    }

    if (formData.serviceType === "package" && !formData.recurringDays.trim()) {
      setFormMessage("Please enter recurring days for package bookings.");
      return;
    }

    setSubmitting(true);
    setFormMessage("");

    try {
      await api.post("/api/bookings", {
        userId: user.uid,
        serviceCategory: formData.serviceCategory,
        subCategory: formData.subCategory,
        serviceType: formData.serviceType,
        workDescription: formData.workDescription,
        serviceDate: formData.serviceDate,
        preferredTimeSlot: formData.preferredTimeSlot,
        duration: formData.duration,
        recurringDays: formData.serviceType === "package" ? formData.recurringDays : "",
        specialInstructions: formData.specialInstructions,
        category: formData.subCategory || formData.serviceCategory,
        date: formData.serviceDate,
        time: formData.preferredTimeSlot,
        notes: formData.specialInstructions,
        planType: formData.serviceType,
        packageId: formData.serviceType === "package" ? formData.packageId : ""
      });

      setFormData((current) => ({
        ...current,
        serviceType: "one-time",
        packageId: "",
        workDescription: "",
        serviceDate: "",
        preferredTimeSlot: "",
        duration: "",
        recurringDays: "",
        specialInstructions: ""
      }));

      setFormMessage("Booking submitted successfully and saved to database.");
      await loadBookings();
      setActiveTab("upcoming");
    } catch (error) {
      setFormMessage(error?.response?.data?.message || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    setBookingsMessage("");
    setUpdatingBookingId(bookingId);

    try {
      await api.patch(`/api/bookings/${bookingId}/status`, { status: "cancelled" });
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? {
                ...booking,
                status: "cancelled",
                updatedAt: new Date().toISOString()
              }
            : booking
        )
      );
      setBookingsMessage("Booking cancelled successfully.");
    } catch (error) {
      setBookingsMessage(error?.response?.data?.message || "Unable to cancel this booking right now.");
    } finally {
      setUpdatingBookingId("");
    }
  };

  return (
    <UserPortalShell activeNav="bookings">
      <section className="tasko-page-header">
        <p>Booking Workspace</p>
        <h1>Book and Manage Services</h1>
        <p>Create new bookings and track current, upcoming, and old bookings with full details.</p>
      </section>

      <section className="tasko-booking-stats">
        <article className="tasko-card tasko-booking-stat-card">
          <h3>Current</h3>
          <p className="tasko-booking-stat-value">{bookingCounts.current}</p>
          <p>Active or today&apos;s bookings.</p>
        </article>
        <article className="tasko-card tasko-booking-stat-card">
          <h3>Upcoming</h3>
          <p className="tasko-booking-stat-value">{bookingCounts.upcoming}</p>
          <p>Future scheduled bookings.</p>
        </article>
        <article className="tasko-card tasko-booking-stat-card">
          <h3>Old</h3>
          <p className="tasko-booking-stat-value">{bookingCounts.old}</p>
          <p>Completed or cancelled bookings.</p>
        </article>
      </section>

      <section className="tasko-content-panel">
        <div className="tasko-section-head">
          <p>Create</p>
          <h2>New Booking</h2>
        </div>

        <form className="tasko-booking-form" onSubmit={handleSubmit}>
          <label className="tasko-booking-field">
            <span>Service Category</span>
            <select
              value={formData.serviceCategory}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  serviceCategory: event.target.value,
                  subCategory: ""
                }))
              }
              required
            >
              <option value="">Select service category</option>
              {categoryOptions.map((categoryName) => (
                <option key={categoryName} value={categoryName}>
                  {categoryName}
                </option>
              ))}
            </select>
          </label>

          <label className="tasko-booking-field">
            <span>Sub Category</span>
            <select
              value={formData.subCategory}
              onChange={(event) => setFormData((current) => ({ ...current, subCategory: event.target.value }))}
              required
              disabled={!formData.serviceCategory}
            >
              <option value="">Select sub category</option>
              {subCategoryOptions.map((subCategoryName) => (
                <option key={subCategoryName} value={subCategoryName}>
                  {subCategoryName}
                </option>
              ))}
            </select>
          </label>

          <label className="tasko-booking-field">
            <span>Service Type</span>
            <select
              value={formData.serviceType}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  serviceType: event.target.value,
                  packageId: "",
                  recurringDays: ""
                }))
              }
              required
            >
              <option value="one-time">One-time</option>
              <option value="package">Package</option>
            </select>
          </label>

          {formData.serviceType === "package" ? (
            <label className="tasko-booking-field">
              <span>Package</span>
              <select
                value={formData.packageId}
                onChange={(event) => setFormData((current) => ({ ...current, packageId: event.target.value }))}
                required
              >
                <option value="">Select package</option>
                {packageOptions.map((pkg) => (
                  <option key={pkg.value} value={pkg.value}>
                    {pkg.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="tasko-booking-field tasko-booking-field-spacer" aria-hidden="true" />
          )}

          <label className="tasko-booking-field full">
            <span>Work Description</span>
            <textarea
              placeholder="Add optional notes about the work"
              value={formData.workDescription}
              onChange={(event) => setFormData((current) => ({ ...current, workDescription: event.target.value }))}
            />
          </label>

          <label className="tasko-booking-field">
            <span>Service Date</span>
            <input
              type="date"
              min={formatTodayDate()}
              value={formData.serviceDate}
              onChange={(event) => setFormData((current) => ({ ...current, serviceDate: event.target.value }))}
              required
            />
          </label>

          <label className="tasko-booking-field">
            <span>Preferred Time Slot</span>
            <input
              type="time"
              value={formData.preferredTimeSlot}
              onChange={(event) => setFormData((current) => ({ ...current, preferredTimeSlot: event.target.value }))}
              required
            />
          </label>

          <label className="tasko-booking-field">
            <span>Duration</span>
            <input
              type="text"
              placeholder="e.g. 2 hours"
              value={formData.duration}
              onChange={(event) => setFormData((current) => ({ ...current, duration: event.target.value }))}
            />
          </label>

          {formData.serviceType === "package" ? (
            <label className="tasko-booking-field">
              <span>Recurring Days</span>
              <input
                type="text"
                placeholder="e.g. Mon, Wed, Fri"
                value={formData.recurringDays}
                onChange={(event) => setFormData((current) => ({ ...current, recurringDays: event.target.value }))}
                required
              />
            </label>
          ) : (
            <div className="tasko-booking-field tasko-booking-field-spacer" aria-hidden="true" />
          )}

          <label className="tasko-booking-field full">
            <span>Special Instructions</span>
            <textarea
              placeholder="Add any special instructions"
              value={formData.specialInstructions}
              onChange={(event) => setFormData((current) => ({ ...current, specialInstructions: event.target.value }))}
            />
          </label>

          <div className="tasko-booking-actions-row">
            <button type="submit" className="tasko-booking-submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Confirm Booking"}
            </button>
          </div>
        </form>

        {formMessage ? <p className="tasko-empty-state">{formMessage}</p> : null}
      </section>

      <section className="tasko-content-panel">
        <div className="tasko-section-head">
          <p>History</p>
          <h2>Your Bookings</h2>
        </div>

        <div className="tasko-chip-row">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tasko-chip ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label} ({bookingCounts[tab.id]})
            </button>
          ))}
        </div>

        {bookingsLoading ? <p className="tasko-empty-state">Loading bookings...</p> : null}

        {!bookingsLoading && visibleBookings.length === 0 ? (
          <p className="tasko-empty-state">No bookings found in this section.</p>
        ) : (
          <div className="tasko-booking-grid">
            {visibleBookings.map((booking) => {
              const bucket = getBookingBucket(booking);
              const status = String(booking.status || "pending").toLowerCase();
              const canCancel = !oldStatuses.has(status);
              const workerInfo = booking.assignedWorkerId ? workerDirectory[booking.assignedWorkerId] : null;

              return (
                <article key={booking.id} className="tasko-card tasko-booking-card">
                  <div className="tasko-booking-card-head">
                    <h3>{booking.subCategory || booking.category || booking.serviceCategory || "Service Booking"}</h3>
                    <span className={`tasko-booking-status is-${bucket}`}>{toStatusLabel(status)}</span>
                  </div>

                  <div className="tasko-booking-meta-grid">
                    <p>
                      <strong>Booking ID:</strong> {booking.id || "-"}
                    </p>
                    <p>
                      <strong>Service Category:</strong> {booking.serviceCategory || booking.category || "-"}
                    </p>
                    <p>
                      <strong>Sub Category:</strong> {booking.subCategory || booking.category || "-"}
                    </p>
                    <p>
                      <strong>Service Date:</strong> {formatSlotDate(booking)}
                    </p>
                    <p>
                      <strong>Preferred Time Slot:</strong> {formatSlotTime(booking)}
                    </p>
                    <p>
                      <strong>Service Type:</strong> {toStatusLabel(booking.serviceType || booking.planType || "one-time")}
                    </p>
                    <p>
                      <strong>Package:</strong>{" "}
                      {booking.packageId ? packageLabelMap[booking.packageId] || booking.packageId : "-"}
                    </p>
                    <p>
                      <strong>Duration:</strong> {booking.duration || "-"}
                    </p>
                    <p>
                      <strong>Recurring Days:</strong> {booking.recurringDays || "-"}
                    </p>
                    <p>
                      <strong>Status:</strong> {toStatusLabel(status)}
                    </p>
                    <p>
                      <strong>Worker:</strong> {workerInfo?.name || "Not assigned"}
                    </p>
                    <p>
                      <strong>Worker Contact:</strong> {workerInfo?.phone || "-"}
                    </p>
                    <p>
                      <strong>Created:</strong> {formatDateTime(booking.createdAt)}
                    </p>
                    <p>
                      <strong>Updated:</strong> {formatDateTime(booking.updatedAt)}
                    </p>
                  </div>

                  <p className="tasko-booking-notes">
                    <strong>Work Description:</strong> {booking.workDescription || "No work description."}
                  </p>

                  <p className="tasko-booking-notes">
                    <strong>Special Instructions:</strong> {booking.specialInstructions || booking.notes || "No special instructions."}
                  </p>

                  {canCancel ? (
                    <div className="tasko-booking-actions-row">
                      <button
                        type="button"
                        className="tasko-booking-cancel"
                        onClick={() => cancelBooking(booking.id)}
                        disabled={updatingBookingId === booking.id}
                      >
                        {updatingBookingId === booking.id ? "Cancelling..." : "Cancel Booking"}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {bookingsMessage ? <p className="tasko-empty-state">{bookingsMessage}</p> : null}
      </section>
    </UserPortalShell>
  );
}
