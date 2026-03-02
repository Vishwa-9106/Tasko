import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import UserDashboardShell from "../components/UserDashboardShell";

const tabs = ["ongoing", "upcoming", "completed"];

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

export default function AssignsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("ongoing");
  const [workerNames, setWorkerNames] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    const loadBookings = async () => {
      const response = await api.get("/api/bookings", {
        params: { userId: user.uid }
      });
      setBookings(response.data);
    };

    loadBookings().catch(() => setBookings([]));
  }, [user]);

  useEffect(() => {
    const workerIds = Array.from(new Set(bookings.map((booking) => booking.assignedWorkerId).filter(Boolean)));
    if (workerIds.length === 0) return;

    Promise.all(
      workerIds.map((workerId) =>
        api
          .get(`/api/workers/${workerId}`)
          .then((response) => ({
            workerId,
            name: response.data?.name || "Assigned Worker"
          }))
          .catch(() => ({
            workerId,
            name: "Assigned Worker"
          }))
      )
    ).then((resolved) => {
      setWorkerNames((current) => {
        const next = { ...current };
        resolved.forEach((item) => {
          next[item.workerId] = item.name;
        });
        return next;
      });
    });
  }, [bookings]);

  const filteredBookings = bookings.filter((booking) => getBookingBucket(booking) === activeTab);

  const cancelBooking = async (bookingId) => {
    setMessage("");
    try {
      await api.patch(`/api/bookings/${bookingId}/status`, { status: "cancelled" });
      setBookings((current) => current.map((booking) => (booking.id === bookingId ? { ...booking, status: "cancelled" } : booking)));
      setMessage("Booking cancelled successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Unable to cancel this booking right now.");
    }
  };

  return (
    <UserDashboardShell
      activeTab="assigns"
      title="Assigned Services"
      subtitle="Track ongoing, upcoming, and completed services with worker details and service status."
    >
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
              const workerName = booking.assignedWorkerId ? workerNames[booking.assignedWorkerId] || "Assigned Worker" : "Not assigned";
              const status = String(booking.status || activeTab);
              const canCancel = !["completed", "cancelled"].includes(status.toLowerCase());

              return (
                <article key={booking.id} className="user-list-item">
                  <div className="user-list-item-head">
                    <h3>{booking.category || "Service"}</h3>
                    <span className="user-status-tag">{status}</span>
                  </div>
                  <p>Worker: {workerName}</p>
                  <p>
                    Date & Time: {booking.date || "-"} {booking.time ? `at ${booking.time}` : ""}
                  </p>
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
