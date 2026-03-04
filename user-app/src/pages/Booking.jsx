import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import UserPortalShell from "../components/UserPortalShell";

const tabs = [
  { id: "current", label: "Current" },
  { id: "upcoming", label: "Upcoming" },
  { id: "old", label: "Old" }
];

const oldStatuses = new Set(["completed", "cancelled"]);

function formatTodayDate() {
  return new Date().toISOString().slice(0, 10);
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
  const rawDate = String(booking?.date || "").trim();
  const rawTime = String(booking?.time || "").trim();

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
  if (!slot) return booking?.date || "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(slot);
}

function formatSlotTime(booking) {
  const rawTime = String(booking?.time || "").trim();
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
    category: searchParams.get("category") || "",
    date: "",
    time: "",
    planType: "one-time",
    packageId: "",
    notes: ""
  });

  useEffect(() => {
    const loadCatalogs = async () => {
      const [servicesRes, packagesRes] = await Promise.all([api.get("/api/services"), api.get("/api/packages")]);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setPackages(Array.isArray(packagesRes.data) ? packagesRes.data : []);
    };

    loadCatalogs().catch(() => {
      setServices([
        { id: "home-cleaning", name: "Home Cleaning" },
        { id: "plumbing", name: "Plumbing" },
        { id: "electrical", name: "Electrical" }
      ]);
      setPackages([]);
    });
  }, []);

  useEffect(() => {
    const categoryFromQuery = searchParams.get("category");
    if (!categoryFromQuery) return;

    setFormData((current) => ({
      ...current,
      category: categoryFromQuery
    }));
  }, [searchParams]);

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

  const serviceOptions = useMemo(
    () => services.map((service) => ({ value: service.name || service.id, label: service.name || service.id })),
    [services]
  );

  const packageOptions = useMemo(
    () =>
      packages.map((pkg) => ({
        value: pkg.id || pkg.name,
        label: pkg.name || pkg.serviceType || "Package Plan"
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

    if (formData.planType === "package" && !formData.packageId) {
      setFormMessage("Please choose a package plan before submitting.");
      return;
    }

    setSubmitting(true);
    setFormMessage("");

    try {
      await api.post("/api/bookings", {
        userId: user.uid,
        category: formData.category,
        date: formData.date,
        time: formData.time,
        notes: formData.notes,
        planType: formData.planType,
        packageId: formData.planType === "package" ? formData.packageId : ""
      });

      setFormData((current) => ({
        ...current,
        date: "",
        time: "",
        packageId: "",
        notes: ""
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
            <span>Category</span>
            <select
              value={formData.category}
              onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
              required
            >
              <option value="">Select category</option>
              {serviceOptions.map((service) => (
                <option key={service.value} value={service.value}>
                  {service.label}
                </option>
              ))}
            </select>
          </label>

          <label className="tasko-booking-field">
            <span>Date</span>
            <input
              type="date"
              min={formatTodayDate()}
              value={formData.date}
              onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
              required
            />
          </label>

          <label className="tasko-booking-field">
            <span>Time</span>
            <input
              type="time"
              value={formData.time}
              onChange={(event) => setFormData((current) => ({ ...current, time: event.target.value }))}
              required
            />
          </label>

          <label className="tasko-booking-field">
            <span>Plan Type</span>
            <select
              value={formData.planType}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  planType: event.target.value,
                  packageId: ""
                }))
              }
              required
            >
              <option value="one-time">One-time</option>
              <option value="package">Package Plan</option>
            </select>
          </label>

          {formData.planType === "package" ? (
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
            <span>Special Instructions</span>
            <textarea
              placeholder="Add any special instructions"
              value={formData.notes}
              onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
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
                    <h3>{booking.category || "Service Booking"}</h3>
                    <span className={`tasko-booking-status is-${bucket}`}>{toStatusLabel(status)}</span>
                  </div>

                  <div className="tasko-booking-meta-grid">
                    <p>
                      <strong>Booking ID:</strong> {booking.id || "-"}
                    </p>
                    <p>
                      <strong>Date:</strong> {formatSlotDate(booking)}
                    </p>
                    <p>
                      <strong>Time:</strong> {formatSlotTime(booking)}
                    </p>
                    <p>
                      <strong>Plan:</strong> {toStatusLabel(booking.planType || "one-time")}
                    </p>
                    <p>
                      <strong>Package:</strong>{" "}
                      {booking.packageId ? packageLabelMap[booking.packageId] || booking.packageId : "-"}
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
                    <strong>Notes:</strong> {booking.notes || "No special instructions."}
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
