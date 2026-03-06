import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BellIcon, CartIcon, ProfileIcon } from "./PortalIcons";
import { getTaskoMartCartCount, onTaskoMartCartUpdated } from "../utils/taskomartCart";
import taskoLogo from "../pages/tasko-logo.png";
import "../pages/Home.css";

const navItems = [
  { id: "home", label: "Home", to: "/home" },
  { id: "bookings", label: "Bookings", to: "/booking" },
  { id: "packages", label: "My Packages", to: "/packages" },
  { id: "taskomart", label: "TaskoMart", to: "/taskomart" }
];

function getInitials(text) {
  return String(text || "User")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function UserPortalShell({ children, activeNav = "home" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const initials = getInitials(user?.displayName || user?.email);

  useEffect(() => {
    setCartCount(getTaskoMartCartCount());
    return onTaskoMartCartUpdated((nextCount) => {
      setCartCount(nextCount);
    });
  }, []);

  const goToContact = () => {
    if (location.pathname === "/home") {
      document.getElementById("home-footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate("/home#home-footer");
  };

  return (
    <div className="tasko-portal-page" id="top">
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
