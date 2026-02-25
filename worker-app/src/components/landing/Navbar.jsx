import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import NavLink from "./NavLink";

const links = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#services", label: "Services" },
  { href: "#benefits", label: "Benefits" },
  { href: "#testimonials", label: "Testimonials" }
];

export default function Navbar({ loginHref }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);

    return () => {
      document.body.classList.remove("menu-open");
    };
  }, [open]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 920) {
        setOpen(false);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header className="worker-nav-wrap">
      <div className="worker-shell worker-nav">
        <a href="#top" className="brand-anchor" aria-label="Tasko home">
          <BrandLogo />
        </a>

        <nav className="worker-nav-links" aria-label="Section links">
          {links.map((item) => (
            <NavLink key={item.href} href={item.href} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="worker-nav-actions">
          <Link to={loginHref} className="btn-login">
            Login
          </Link>
          <Link to="/register" className="btn-luxury-primary">
            Join as Worker
          </Link>
        </div>

        <button
          type="button"
          className={`menu-toggle ${open ? "is-open" : ""}`}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label="Toggle navigation menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <button
        type="button"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        className={`drawer-backdrop ${open ? "is-open" : ""}`}
        onClick={() => setOpen(false)}
      />

      <div className={`mobile-drawer ${open ? "is-open" : ""}`}>
        <div className="mobile-drawer-links">
          {links.map((item) => (
            <NavLink key={item.href} href={item.href} className="mobile-nav-link" onClick={() => setOpen(false)}>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="mobile-drawer-actions">
          <Link to={loginHref} className="btn-login" onClick={() => setOpen(false)}>
            Login
          </Link>
          <Link to="/register" className="btn-luxury-primary" onClick={() => setOpen(false)}>
            Join as Worker
          </Link>
        </div>
      </div>
    </header>
  );
}
