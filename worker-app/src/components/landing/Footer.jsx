import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import NavLink from "./NavLink";

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="worker-footer">
      <div className="worker-shell footer-grid">
        <div className="footer-brand">
          <BrandLogo compact />
          <p>Verified employee hiring platform with secure process and professional support.</p>
        </div>

        <div className="footer-column">
          <p className="footer-title">Explore</p>
          <NavLink href="#how-it-works">How Hiring Works</NavLink>
          <NavLink href="#services">Services</NavLink>
          <NavLink href="#benefits">Why Tasko</NavLink>
          <NavLink href="#testimonials">Testimonials</NavLink>
        </div>

        <div className="footer-column">
          <p className="footer-title">Employee Access</p>
          <Link to="/apply">Apply for Job</Link>
          <Link to="/login">Employee Login</Link>
        </div>
      </div>

      <div className="worker-shell footer-bottom">
        <p>&copy; {year} Tasko. All rights reserved.</p>
      </div>
    </footer>
  );
}
