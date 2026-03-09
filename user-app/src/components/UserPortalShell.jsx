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

function normalizeBookingStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function buildOtpNotifications(booking) {
  const bookingId = readText(booking?.id) || readText(booking?.bookingId) || readText(booking?.booking_id);
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
      id: `${bookingId}:start:${startOtp}`,
      bookingId,
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
      id: `${bookingId}:completion:${completionOtp}`,
      bookingId,
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
  const [otpNotification, setOtpNotification] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const initials = getInitials(user?.displayName || user?.email);

  useEffect(() => {
    setCartCount(getTaskoMartCartCount());
    return onTaskoMartCartUpdated((nextCount) => {
      setCartCount(nextCount);
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setOtpNotification(null);
      setNotificationCount(0);
      return undefined;
    }

    let disposed = false;

    const syncOtpNotifications = async () => {
      const response = await api.get("/api/bookings", {
        params: { userId: user.uid, limit: 20 }
      });
      if (disposed) return;

      const bookings = Array.isArray(response.data) ? response.data : [];
      const notifications = bookings
        .flatMap((booking) => buildOtpNotifications(booking))
        .filter(Boolean)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      const seenNotifications = readSeenOtpNotifications();
      const unseenNotifications = notifications.filter((notification) => !seenNotifications[notification.id]);

      setNotificationCount(unseenNotifications.length);
      setOtpNotification((current) => {
        if (current && unseenNotifications.some((notification) => notification.id === current.id)) {
          return current;
        }
        return unseenNotifications[0] || null;
      });
    };

    syncOtpNotifications().catch(() => {});
    const poll = window.setInterval(() => {
      syncOtpNotifications().catch(() => {});
    }, 15000);

    return () => {
      disposed = true;
      window.clearInterval(poll);
    };
  }, [user?.uid]);

  const dismissOtpNotification = () => {
    if (!otpNotification) return;

    writeSeenOtpNotifications({
      ...readSeenOtpNotifications(),
      [otpNotification.id]: true
    });
    setOtpNotification(null);
    setNotificationCount((current) => Math.max(0, current - 1));
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
      {otpNotification ? (
        <div className="tasko-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tasko-arrival-otp-title">
          <div className="tasko-modal-card tasko-success-modal-card">
            <div className="tasko-modal-head">
              <div>
                <p>Notification</p>
                <h3 id="tasko-arrival-otp-title">{otpNotification.title}</h3>
              </div>
            </div>
            <div className="tasko-modal-body">
              <p>{otpNotification.message}</p>
              <p className="tasko-otp-highlight">OTP: {otpNotification.otp}</p>
            </div>
            <div className="tasko-modal-actions">
              <button type="button" className="tasko-secondary-button" onClick={dismissOtpNotification}>
                Close
              </button>
              <button type="button" onClick={dismissOtpNotification}>
                OK
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
              onClick={() => navigate("/assigns")}
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
