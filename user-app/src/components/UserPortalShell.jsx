import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BellIcon, CartIcon, ProfileIcon } from "./PortalIcons";
import { getTaskoMartCartCount, onTaskoMartCartUpdated } from "../utils/taskomartCart";
import api from "../api";
import taskoLogo from "../pages/tasko-logo.png";
import "../pages/Home.css";

const navItems = [
  { id: "home", label: "Home", to: "/home" },
  { id: "bookings", label: "Bookings", to: "/booking" },
  { id: "packages", label: "My Packages", to: "/packages" },
  { id: "taskomart", label: "TaskoMart", to: "/taskomart" }
];
const seenOtpNotificationStorageKey = "tasko_seen_otp_notifications";

function getInitials(text) {
  return String(text || "User")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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

function readSeenOtpNotifications() {
  try {
    const stored = localStorage.getItem(seenOtpNotificationStorageKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSeenOtpNotifications(value) {
  localStorage.setItem(seenOtpNotificationStorageKey, JSON.stringify(value));
}

function markNotificationsAsSeen(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return;
  }

  const nextSeenNotifications = { ...readSeenOtpNotifications() };
  notifications.forEach((notification) => {
    if (notification?.id) {
      nextSeenNotifications[notification.id] = true;
    }
  });
  writeSeenOtpNotifications(nextSeenNotifications);
}

function normalizeBookingStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function buildOtpNotifications(booking) {
  const bookingId = readText(booking?.id) || readText(booking?.bookingId) || readText(booking?.booking_id);
  const entityType = readText(booking?.bookingType) || readText(booking?.booking_type) || "service";
  const status = normalizeBookingStatus(booking?.status);
  if (!bookingId || ["completed", "cancelled"].includes(status)) {
    return [];
  }

  const notifications = [];
  const serviceName =
    readText(booking?.subCategory) ||
    readText(booking?.category) ||
    readText(booking?.serviceCategory) ||
    "your service";
  const workerName =
    readText(booking?.assignedWorkerName) || readText(booking?.assigned_worker_name) || "Your worker";

  const startOtp =
    readText(booking?.startOtp) ||
    readText(booking?.start_otp) ||
    readText(booking?.jobStartOtp) ||
    readText(booking?.job_start_otp);
  const arrivedAt = readDate(booking?.workerArrivedAt) || readDate(booking?.worker_arrived_at);
  if (startOtp && arrivedAt && !["in_progress", "completed", "cancelled"].includes(status)) {
    notifications.push({
      id: `${entityType}:${bookingId}:start:${startOtp}`,
      bookingId,
      bookingType: entityType,
      type: "start",
      otp: startOtp,
      title:
        readText(booking?.arrivalNotificationTitle) || readText(booking?.arrival_notification_title) || "Worker Arrived",
      serviceName,
      workerName,
      message:
        readText(booking?.arrivalNotificationMessage) ||
        readText(booking?.arrival_notification_message) ||
        `${workerName} has arrived for ${serviceName}. Share this OTP to start the job.`,
      createdAt: arrivedAt.toISOString()
    });
  }

  const completionOtp =
    readText(booking?.completionOtp) ||
    readText(booking?.completion_otp) ||
    readText(booking?.jobCompletionOtp) ||
    readText(booking?.job_completion_otp);
  const completionRequestedAt =
    readDate(booking?.completionOtpRequestedAt) || readDate(booking?.completion_otp_requested_at);
  if (completionOtp && completionRequestedAt && status === "in_progress") {
    notifications.push({
      id: `${entityType}:${bookingId}:completion:${completionOtp}`,
      bookingId,
      bookingType: entityType,
      type: "completion",
      otp: completionOtp,
      title:
        readText(booking?.completionNotificationTitle) ||
        readText(booking?.completion_notification_title) ||
        "Completion OTP Ready",
      serviceName,
      workerName,
      message:
        readText(booking?.completionNotificationMessage) ||
        readText(booking?.completion_notification_message) ||
        `${workerName} is ready to complete ${serviceName}. Share this OTP to finish the job.`,
      createdAt: completionRequestedAt.toISOString()
    });
  }

  return notifications;
}

export default function UserPortalShell({ children, activeNav = "home" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [otpNotifications, setOtpNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const initials = getInitials(user?.displayName || user?.email);

  useEffect(() => {
    setCartCount(getTaskoMartCartCount());
    return onTaskoMartCartUpdated((nextCount) => {
      setCartCount(nextCount);
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setOtpNotifications([]);
      setNotificationCount(0);
      return undefined;
    }

    let disposed = false;

    const syncOtpNotifications = async () => {
      const [bookingsResponse, packageSchedulesResponse] = await Promise.allSettled([
        api.get("/api/bookings", {
          params: { userId: user.uid, limit: 20 }
        }),
        api.get("/api/package-schedules", {
          params: { userId: user.uid }
        })
      ]);
      if (disposed) return;

      const bookings =
        bookingsResponse.status === "fulfilled" && Array.isArray(bookingsResponse.value.data) ? bookingsResponse.value.data : [];
      const packageSchedules =
        packageSchedulesResponse.status === "fulfilled" && Array.isArray(packageSchedulesResponse.value.data)
          ? packageSchedulesResponse.value.data
          : [];
      const notifications = [...bookings, ...packageSchedules]
        .flatMap((booking) => buildOtpNotifications(booking))
        .filter(Boolean)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      setOtpNotifications(notifications);

      if (isNotificationsOpen) {
        markNotificationsAsSeen(notifications);
        setNotificationCount(0);
        return;
      }

      const seenNotifications = readSeenOtpNotifications();
      const unseenNotifications = notifications.filter((notification) => !seenNotifications[notification.id]);
      setNotificationCount(unseenNotifications.length);
    };

    syncOtpNotifications().catch(() => {});
    const poll = window.setInterval(() => {
      syncOtpNotifications().catch(() => {});
    }, 15000);

    return () => {
      disposed = true;
      window.clearInterval(poll);
    };
  }, [isNotificationsOpen, user?.uid]);

  const openNotifications = () => {
    setIsNotificationsOpen(true);
    markNotificationsAsSeen(otpNotifications);
    setNotificationCount(0);
  };

  const goToContact = () => {
    if (location.pathname === "/home") {
      document.getElementById("home-footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate("/home#home-footer");
  };

  return (
    <div className="tasko-portal-page" id="top">
      {isNotificationsOpen ? (
        <div
          className="tasko-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tasko-notification-center-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsNotificationsOpen(false);
            }
          }}
        >
          <div className="tasko-modal-card tasko-success-modal-card tasko-message-modal-card">
            <div className="tasko-modal-head">
              <div>
                <p>Messages</p>
                <h3 id="tasko-notification-center-title">Notifications</h3>
              </div>
            </div>
            <div className="tasko-modal-body">
              {otpNotifications.length === 0 ? (
                <p className="tasko-notification-empty">No messages yet.</p>
              ) : (
                <div className="tasko-notification-list">
                  {otpNotifications.map((notification) => (
                    <article key={notification.id} className="tasko-notification-item">
                      <div className="tasko-notification-item-head">
                        <h4>{notification.title}</h4>
                        <span className="tasko-notification-tag">
                          {notification.type === "completion" ? "COMPLETE OTP" : "START OTP"}
                        </span>
                      </div>
                      <p>{notification.message}</p>
                      <div className="tasko-notification-meta">
                        <span>Service: {notification.serviceName}</span>
                        <span>Worker: {notification.workerName}</span>
                        <span>
                          {new Date(notification.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                      <p className="tasko-otp-highlight">OTP: {notification.otp}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div className="tasko-modal-actions">
              <button type="button" className="tasko-secondary-button" onClick={() => setIsNotificationsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="tasko-navbar-wrap">
        <div className="tasko-shell tasko-navbar">
          <Link to="/home" className="tasko-brand" aria-label="Tasko home">
            <img src={taskoLogo} alt="Tasko logo" className="tasko-brand-mark" />
            <span className="tasko-brand-name">TASKO</span>
          </Link>

          <nav className="tasko-nav-links" aria-label="User navigation">
            {navItems.map((item) => (
              <NavLink key={item.id} to={item.to} className={`tasko-nav-link ${activeNav === item.id ? "is-active" : ""}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="tasko-nav-actions">
            <button
              type="button"
              className="tasko-icon-btn"
              onClick={openNotifications}
              aria-label="Open notifications"
              title="Notifications"
            >
              <BellIcon className="tasko-inline-icon" />
              {notificationCount > 0 ? (
                <span className="tasko-icon-badge" aria-hidden="true">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="tasko-icon-btn"
              onClick={() => navigate("/cart")}
              aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              title="Cart"
            >
              <CartIcon className="tasko-inline-icon" />
              {cartCount > 0 ? (
                <span className="tasko-icon-badge" aria-hidden="true">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="tasko-icon-btn profile"
              onClick={() => navigate("/profile")}
              aria-label="Open profile"
              title="Profile"
            >
              <ProfileIcon className="tasko-inline-icon" />
              <span className="tasko-initials" aria-hidden="true">
                {initials}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="tasko-shell tasko-main-content">{children}</main>

      <footer className="tasko-site-footer" id="home-footer">
        <div className="tasko-shell tasko-footer-grid">
          <section>
            <h3>Company</h3>
            <Link to="/home">About</Link>
            <button type="button" onClick={goToContact}>
              Contact
            </button>
            <a href="#top">Careers</a>
          </section>
          <section>
            <h3>Services</h3>
            <Link to="/services">Home Services</Link>
            <Link to="/taskomart">TaskoMart</Link>
          </section>
          <section>
            <h3>Support</h3>
            <a href="#top">Help</a>
            <a href="#top">Terms</a>
            <a href="#top">Privacy</a>
          </section>
        </div>
      </footer>
    </div>
  );
}
