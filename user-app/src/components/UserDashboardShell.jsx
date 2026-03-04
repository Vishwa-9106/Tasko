import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../pages/UserDashboard.css";
import taskoLogo from "../pages/tasko-logo.png";

const navItems = [
  { id: "home", label: "Home", href: "/home" },
  { id: "assigns", label: "Assigns", href: "/assigns" },
  { id: "packages", label: "Packages", href: "/packages" }
];

export default function UserDashboardShell({
  activeTab,
  title,
  subtitle,
  children,
  theme = "default",
  eyebrow = "User Dashboard"
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const rootClassName = `user-console-page${theme === "landing" ? " landing-sync" : ""}`;

  const initials = (user?.displayName || user?.email || "User")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={rootClassName}>
      <header className="user-console-nav-wrap">
        <div className="user-shell user-console-nav">
          <Link to="/home" className="user-console-brand" aria-label="Tasko dashboard home">
            <img src={taskoLogo} alt="Tasko logo" />
            <span>TASKO</span>
          </Link>

          <nav className="user-console-menu" aria-label="User dashboard navigation">
            {navItems.map((item) => (
              <NavLink key={item.id} to={item.href} className={`user-console-menu-link ${activeTab === item.id ? "is-active" : ""}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="user-profile-icon-btn"
            onClick={() => navigate("/profile")}
            aria-label="Open profile"
            title="Profile"
          >
            <span className="user-profile-icon-dot" aria-hidden="true" />
            <span className="user-profile-icon-text" aria-hidden="true">
              {initials}
            </span>
          </button>
        </div>
      </header>

      <main className="user-shell user-console-main">
        <section className="user-console-hero">
          <p className="user-console-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </section>
        {children}
      </main>
    </div>
  );
}
