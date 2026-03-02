import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import UserDashboardShell from "../components/UserDashboardShell";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    mobile: "",
    email: "",
    address: ""
  });

  useEffect(() => {
    if (!user) return;

    const hydrateProfile = async () => {
      const response = await api.get("/api/users");
      const users = Array.isArray(response.data) ? response.data : [];
      const current = users.find((entry) => entry.id === user.uid || entry.uid === user.uid) || {};
      setProfile({
        name: current.name || user.displayName || "",
        mobile: current.number || current.mobile || "",
        email: current.mail || current.email || user.email || "",
        address: current.address || ""
      });
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

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      await api.post("/api/users/register", {
        uid: user.uid,
        name: profile.name.trim(),
        email: profile.email.trim().toLowerCase(),
        mobile: profile.mobile.trim(),
        number: profile.mobile.trim(),
        address: profile.address.trim()
      });
      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <UserDashboardShell
      activeTab=""
      title="Profile"
      subtitle="Manage your identity and contact details used for bookings and assignments."
    >
      <section className="user-profile-card">
        <div className="user-profile-row">
          <div>
            <p className="user-field-label">Name</p>
            <input
              className="user-input"
              value={profile.name}
              readOnly={!editing}
              onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
            />
          </div>

          <div>
            <p className="user-field-label">Mobile Number</p>
            <input
              className="user-input"
              value={profile.mobile}
              readOnly={!editing}
              onChange={(event) => setProfile((current) => ({ ...current, mobile: event.target.value }))}
            />
          </div>

          <div>
            <p className="user-field-label">Gmail</p>
            <input
              type="email"
              className="user-input"
              value={profile.email}
              readOnly={!editing}
              onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
            />
          </div>

          <div>
            <p className="user-field-label">Address</p>
            <textarea
              className="user-textarea"
              value={profile.address}
              readOnly={!editing}
              onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))}
            />
          </div>
        </div>

        <div className="user-actions">
          {editing ? (
            <>
              <button type="button" className="user-btn primary" onClick={saveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" className="user-btn secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="user-btn primary" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          <button type="button" className="user-btn danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
        {message ? <p className="user-empty">{message}</p> : null}
      </section>
    </UserDashboardShell>
  );
}
