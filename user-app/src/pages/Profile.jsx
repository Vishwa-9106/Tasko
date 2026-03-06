import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import { useAuth } from "../context/AuthContext";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";
import "./Profile.css";

function toRupee(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "INR 0";
  return `INR ${Math.round(amount)}`;
}

function formatOrderDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function mergeOrders(primary, secondary) {
  const combined = [...primary, ...secondary];
  const deduped = new Map();
  combined.forEach((order, index) => {
    const key = String(order?.id || order?.orderId || `order-${index}`);
    if (!deduped.has(key)) {
      deduped.set(key, order);
    }
  });
  return Array.from(deduped.values());
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersMessage, setOrdersMessage] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    mobile: "",
    email: "",
    address: ""
  });

  useEffect(() => {
    if (!user) return;

    const hydrateProfile = async () => {
      const cacheKey = `profile:${user.uid}`;
      const cached = readSessionCache(cacheKey, 30 * 1000);
      if (cached && typeof cached === "object") {
        setProfile({
          name: cached.name || user.displayName || "",
          mobile: cached.mobile || "",
          email: cached.email || user.email || "",
          address: cached.address || ""
        });
        return;
      }

      const response = await api.get("/api/users", {
        params: { userId: user.uid }
      });
      const users = Array.isArray(response.data) ? response.data : [];
      const current = users.find((entry) => entry.id === user.uid || entry.uid === user.uid) || {};
      const nextProfile = {
        name: current.name || user.displayName || "",
        mobile: current.number || current.mobile || "",
        email: current.mail || current.email || user.email || "",
        address: current.address || ""
      };
      setProfile(nextProfile);
      writeSessionCache(cacheKey, nextProfile);
    };

    hydrateProfile().catch(() => {
      setProfile({
        name: user.displayName || "",
        mobile: "",
        email: user.email || "",
        address: ""
      });
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loadOrders = async () => {
      setOrdersLoading(true);
      setOrdersMessage("");

      const cacheKey = `taskomart:orders:user:${user.uid || user.email || "unknown"}`;
      const cachedOrders = readSessionCache(cacheKey, 30 * 1000);
      if (Array.isArray(cachedOrders)) {
        setOrders(cachedOrders);
      }

      const byUserId = user.uid
        ? await api.get("/api/taskomart/orders", {
            params: { userId: user.uid, limit: 50 }
          })
        : { data: [] };

      const byEmail = user.email
        ? await api.get("/api/taskomart/orders", {
            params: { userEmail: String(user.email).toLowerCase(), limit: 50 }
          })
        : { data: [] };

      const userIdOrders = Array.isArray(byUserId.data) ? byUserId.data : [];
      const emailOrders = Array.isArray(byEmail.data) ? byEmail.data : [];
      const mergedOrders = mergeOrders(userIdOrders, emailOrders);

      setOrders(mergedOrders);
      writeSessionCache(cacheKey, mergedOrders);
    };

    loadOrders()
      .catch((error) => {
        const cachedOrders = readSessionCache(`taskomart:orders:user:${user.uid || user.email || "unknown"}`, 30 * 1000);
        if (Array.isArray(cachedOrders)) {
          setOrders(cachedOrders);
          return;
        }
        setOrders([]);
        setOrdersMessage(error?.response?.data?.message || "Unable to load your TaskoMart orders.");
      })
      .finally(() => {
        setOrdersLoading(false);
      });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setMessage("");
    setMessageType("info");
    try {
      const nextProfile = {
        name: profile.name.trim(),
        mobile: profile.mobile.trim(),
        email: profile.email.trim().toLowerCase(),
        address: profile.address.trim()
      };
      await api.post("/api/users/register", {
        uid: user.uid,
        name: nextProfile.name,
        email: nextProfile.email,
        mobile: nextProfile.mobile,
        number: nextProfile.mobile,
        address: nextProfile.address
      });
      writeSessionCache(`profile:${user.uid}`, nextProfile);
      setEditing(false);
      setMessage("Profile updated successfully.");
      setMessageType("success");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Failed to update profile.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  const profileCompletion = useMemo(() => {
    const fields = [profile.name, profile.mobile, profile.email, profile.address];
    const completed = fields.filter((value) => String(value || "").trim().length > 0).length;
    return Math.round((completed / fields.length) * 100);
  }, [profile]);

  const initials = useMemo(() => {
    return String(profile.name || profile.email || "User")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [profile.email, profile.name]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((left, right) => {
      const leftTime = new Date(left?.orderDate || left?.createdAt || 0).getTime();
      const rightTime = new Date(right?.orderDate || right?.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
  }, [orders]);

  return (
    <UserPortalShell activeNav="">
      <section className="tasko-page-header">
        <p>Profile</p>
        <h1>Profile & Account</h1>
        <p>Manage your contact details and account preferences used across Tasko services.</p>
      </section>

      <section className="tasko-profile-overview-grid">
        <article className="tasko-card tasko-profile-stat-card">
          <p className="tasko-profile-stat-label">Profile Completion</p>
          <h2>{profileCompletion}%</h2>
          <p>Complete all fields to improve booking coordination.</p>
        </article>
        <article className="tasko-card tasko-profile-stat-card">
          <p className="tasko-profile-stat-label">Account Email</p>
          <h2>{profile.email || "Not Set"}</h2>
          <p>Primary contact used for updates and service alerts.</p>
        </article>
        <article className="tasko-card tasko-profile-stat-card">
          <p className="tasko-profile-stat-label">Mode</p>
          <h2>{editing ? "Editing" : "Read Only"}</h2>
          <p>{editing ? "You can edit and save your details now." : "Enable edit mode to update profile."}</p>
        </article>
      </section>

      <section className="tasko-profile-layout">
        <article className="tasko-content-panel tasko-profile-panel-main">
          <div className="tasko-profile-panel-head">
            <div>
              <p className="tasko-profile-eyebrow">Personal Details</p>
              <h2>Update Your Information</h2>
            </div>
            <span className={`tasko-profile-mode-chip${editing ? " is-editing" : ""}`}>
              {editing ? "Editing" : "Read only"}
            </span>
          </div>

          <div className="tasko-profile-form-grid">
            <label className="tasko-profile-field">
              <span>Name</span>
              <input
                className="tasko-profile-input"
                value={profile.name}
                readOnly={!editing}
                onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label className="tasko-profile-field">
              <span>Mobile Number</span>
              <input
                className="tasko-profile-input"
                value={profile.mobile}
                readOnly={!editing}
                onChange={(event) => setProfile((current) => ({ ...current, mobile: event.target.value }))}
              />
            </label>

            <label className="tasko-profile-field">
              <span>Email</span>
              <input
                type="email"
                className="tasko-profile-input"
                value={profile.email}
                readOnly={!editing}
                onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
              />
            </label>

            <label className="tasko-profile-field tasko-profile-field-full">
              <span>Address</span>
              <textarea
                className="tasko-profile-input tasko-profile-textarea"
                value={profile.address}
                readOnly={!editing}
                onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))}
              />
            </label>
          </div>

          <div className="tasko-profile-actions">
            {editing ? (
              <>
                <button type="button" className="tasko-profile-btn primary" onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button type="button" className="tasko-profile-btn secondary" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="tasko-profile-btn primary" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
          </div>

          {message ? <p className={`tasko-profile-message ${messageType}`}>{message}</p> : null}
        </article>

        <aside className="tasko-content-panel tasko-profile-side-panel">
          <div className="tasko-profile-avatar" aria-hidden="true">
            {initials}
          </div>
          <h3>{profile.name || "Tasko User"}</h3>
          <p>{profile.mobile || "Add your mobile number for faster assignment updates."}</p>
          <p className="tasko-profile-side-note">Need to switch accounts? You can safely sign out at any time.</p>
          <div className="tasko-profile-actions">
            <button type="button" className="tasko-profile-btn danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </aside>
      </section>

      <section className="tasko-content-panel tasko-profile-orders-panel">
        <div className="tasko-profile-panel-head">
          <div>
            <p className="tasko-profile-eyebrow">TaskoMart</p>
            <h2>My Orders</h2>
          </div>
        </div>

        {ordersLoading ? <p className="tasko-empty-state">Loading your orders...</p> : null}
        {!ordersLoading && ordersMessage ? <p className="tasko-empty-state">{ordersMessage}</p> : null}
        {!ordersLoading && !ordersMessage && sortedOrders.length === 0 ? (
          <p className="tasko-empty-state">No TaskoMart orders yet.</p>
        ) : null}

        {!ordersLoading && sortedOrders.length > 0 ? (
          <div className="tasko-profile-orders-list">
            {sortedOrders.map((order, index) => {
              const orderKey = String(order?.id || order?.orderId || `taskomart-order-${index}`);
              const items = Array.isArray(order?.items) ? order.items : [];
              const totalItems = items.reduce((sum, item) => sum + Math.max(1, Number(item?.quantity) || 1), 0);
              const itemsPreview = items
                .slice(0, 3)
                .map((item) => String(item?.name || "").trim())
                .filter(Boolean)
                .join(", ");

              return (
                <article key={orderKey} className="tasko-card tasko-profile-order-card">
                  <div className="tasko-profile-order-head">
                    <div>
                      <p className="tasko-profile-order-code">{order?.orderId || "Order"}</p>
                      <p className="tasko-profile-order-date">{formatOrderDate(order?.orderDate || order?.createdAt)}</p>
                    </div>
                    <div className="tasko-profile-order-chips">
                      <span className="tasko-profile-order-chip">{order?.orderStatus || "Pending"}</span>
                      <span className="tasko-profile-order-chip subtle">{order?.paymentStatus || "Pending"}</span>
                    </div>
                  </div>

                  <div className="tasko-profile-order-meta">
                    <p>
                      <strong>Total:</strong> {toRupee(order?.totalAmount)}
                    </p>
                    <p>
                      <strong>Items:</strong> {totalItems}
                    </p>
                  </div>

                  <p className="tasko-profile-order-items">
                    <strong>Products:</strong> {itemsPreview || "Items not available"}
                    {items.length > 3 ? "..." : ""}
                  </p>
                  <p className="tasko-profile-order-address">
                    <strong>Address:</strong> {order?.deliveryAddress || "Address not available"}
                  </p>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </UserPortalShell>
  );
}
