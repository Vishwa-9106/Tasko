import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import UserDashboardShell from "../components/UserDashboardShell";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";

const tabs = ["ongoing", "upcoming", "completed"];

function readText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    const seconds = Number(value.seconds ?? value._seconds);
    const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000 + Math.floor(nanoseconds / 1000000));
    }
  }
  return null;
}

function getBookingDate(booking) {
  if (!booking?.date) return null;
  const parsed = new Date(`${booking.date} ${booking.time || ""}`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(booking.date);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getBookingBucket(booking) {
  const status = String(booking.status || "").toLowerCase();
  if (status === "completed" || status === "cancelled") {
    return "completed";
  }

  const bookingDate = getBookingDate(booking);
  if (bookingDate && bookingDate.getTime() > Date.now()) {
    return "upcoming";
  }
  return "ongoing";
}

function buildOtpNotifications(booking) {
  const bookingId = readText(booking?.id) || readText(booking?.bookingId) || readText(booking?.booking_id);
  const status = String(booking?.status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!bookingId || ["completed", "cancelled"].includes(status)) {
    return [];
  }

  const serviceName = readText(booking?.subCategory) || readText(booking?.category) || readText(booking?.serviceCategory) || "Service";
  const workerName = readText(booking?.assignedWorkerName) || readText(booking?.assigned_worker_name) || "Assigned worker";
  const notifications = [];

  const startOtp =
    readText(booking?.startOtp) ||
    readText(booking?.start_otp) ||
    readText(booking?.jobStartOtp) ||
    readText(booking?.job_start_otp);
  const arrivedAt = readDate(booking?.workerArrivedAt) || readDate(booking?.worker_arrived_at);
  if (startOtp && arrivedAt && !["in_progress", "completed", "cancelled"].includes(status)) {
    notifications.push({
      id: `${bookingId}:start:${startOtp}`,
      type: "start",
      title: readText(booking?.arrivalNotificationTitle) || readText(booking?.arrival_notification_title) || "Worker Arrived",
      message:
        readText(booking?.arrivalNotificationMessage) ||
        readText(booking?.arrival_notification_message) ||
        "Your worker has arrived. Share the OTP to start the job.",
      otp: startOtp,
      eventAt: arrivedAt,
      serviceName,
      workerName
    });
  }

  const completionOtp =
    readText(booking?.completionOtp) ||
    readText(booking?.completion_otp) ||
    readText(booking?.jobCompletionOtp) ||
    readText(booking?.job_completion_otp);
  const completionRequestedAt = readDate(booking?.completionOtpRequestedAt) || readDate(booking?.completion_otp_requested_at);
  if (completionOtp && completionRequestedAt && status === "in_progress") {
    notifications.push({
      id: `${bookingId}:completion:${completionOtp}`,
      type: "completion",
      title:
        readText(booking?.completionNotificationTitle) ||
        readText(booking?.completion_notification_title) ||
        "Completion OTP Ready",
      message:
        readText(booking?.completionNotificationMessage) ||
        readText(booking?.completion_notification_message) ||
        "Your worker is ready to complete the service. Share the OTP to finish the job.",
      otp: completionOtp,
      eventAt: completionRequestedAt,
      serviceName,
      workerName
    });
  }

  return notifications;
}

export default function AssignsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("ongoing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    const loadBookings = async () => {
      const cacheKey = `bookings:user:${user.uid}`;
      const cachedBookings = readSessionCache(cacheKey, 30 * 1000);
      if (Array.isArray(cachedBookings)) {
        setBookings(cachedBookings);
      }

      const response = await api.get("/api/bookings", {
        params: { userId: user.uid, limit: 20 }
      });
      const nextBookings = Array.isArray(response.data) ? response.data : [];
      setBookings(nextBookings);
      writeSessionCache(cacheKey, nextBookings);
    };

    loadBookings().catch(() => setBookings([]));
  }, [user]);

  const bookingCounts = useMemo(
    () =>
      bookings.reduce(
        (acc, booking) => {
          const bucket = getBookingBucket(booking);
          acc[bucket] += 1;
          return acc;
        },
        { ongoing: 0, upcoming: 0, completed: 0 }
      ),
    [bookings]
  );

  const filteredBookings = bookings.filter((booking) => getBookingBucket(booking) === activeTab);
  const otpNotifications = useMemo(
    () =>
      bookings
        .flatMap((booking) => buildOtpNotifications(booking))
        .filter(Boolean)
        .sort((left, right) => right.eventAt.getTime() - left.eventAt.getTime()),
    [bookings]
  );

  const cancelBooking = async (bookingId) => {
    setMessage("");
    try {
      await api.patch(`/api/bookings/${bookingId}/status`, { status: "cancelled" });
      setBookings((current) => {
        const next = current.map((booking) => (booking.id === bookingId ? { ...booking, status: "cancelled" } : booking));
        if (user?.uid) {
          writeSessionCache(`bookings:user:${user.uid}`, next);
        }
        return next;
      });
      setMessage("Booking cancelled successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Unable to cancel this booking right now.");
    }
  };

  return (
    <UserDashboardShell
      activeTab="assigns"
      theme="landing"
      eyebrow="Service Console"
      title="Assigned Services"
      subtitle="Track ongoing, upcoming, and completed services with worker details and service status."
    >
      <section className="sync-overview-grid">
        <article className="user-card sync-stat-card">
          <p className="sync-stat-label">Ongoing</p>
          <h2>{bookingCounts.ongoing}</h2>
          <p>Services that are currently active.</p>
        </article>
        <article className="user-card sync-stat-card">
          <p className="sync-stat-label">Upcoming</p>
          <h2>{bookingCounts.upcoming}</h2>
          <p>Confirmed services scheduled for future slots.</p>
        </article>
        <article className="user-card sync-stat-card">
          <p className="sync-stat-label">Completed</p>
          <h2>{bookingCounts.completed}</h2>
          <p>Delivered services including cancelled items.</p>
        </article>
      </section>

      <section className="user-card">
        <h2>Notifications</h2>
        {otpNotifications.length === 0 ? (
          <p className="user-empty">No OTP notifications yet.</p>
        ) : (
          <div className="user-list">
            {otpNotifications.map((notification) => (
              <article key={notification.id} className="user-list-item sync-assignment-card">
                <div className="user-list-item-head">
                  <h3>{notification.title}</h3>
                  <span className="user-status-tag">{notification.type === "completion" ? "COMPLETE OTP" : "START OTP"}</span>
                </div>
                <div className="sync-meta-grid">
                  <p>
                    <strong>Service:</strong> {notification.serviceName}
                  </p>
                  <p>
                    <strong>Worker:</strong> {notification.workerName}
                  </p>
                  <p>
                    <strong>{notification.type === "completion" ? "Requested At:" : "Arrived At:"}</strong>{" "}
                    {notification.eventAt.toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                </div>
                <p className="user-empty">{notification.message}</p>
                <div className="user-actions">
                  <button type="button" className="user-btn primary">
                    {notification.type === "completion" ? "Completion OTP" : "Start OTP"}: {notification.otp}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="user-card">
        <h2>Service Assignments</h2>
        <div className="user-pill-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`user-pill-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <p className="user-empty">No services found in this tab.</p>
        ) : (
          <div className="user-list">
            {filteredBookings.map((booking) => {
              const workerName =
                String(booking.assignedWorkerName || booking.assigned_worker_name || "").trim() || "Not assigned";
              const status = String(booking.status || activeTab);
              const canCancel = !["completed", "cancelled"].includes(status.toLowerCase());

              return (
                <article key={booking.id} className="user-list-item sync-assignment-card">
                  <div className="user-list-item-head">
                    <h3>{booking.category || "Service"}</h3>
                    <span className="user-status-tag">{status}</span>
                  </div>
                  <div className="sync-meta-grid">
                    <p>
                      <strong>Worker:</strong> {workerName}
                    </p>
                    <p>
                      <strong>Date:</strong> {booking.date || "-"}
                    </p>
                    <p>
                      <strong>Time:</strong> {booking.time || "-"}
                    </p>
                  </div>
                  {canCancel ? (
                    <div className="user-actions">
                      <button type="button" className="user-btn danger" onClick={() => cancelBooking(booking.id)}>
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
        {message ? <p className="user-empty">{message}</p> : null}
      </section>
    </UserDashboardShell>
  );
}
