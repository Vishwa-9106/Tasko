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
          <p>Premium marketplace for skilled, verified, and trusted professionals.</p>
        </div>

        <div className="footer-column">
          <p className="footer-title">Explore</p>
          <NavLink href="#how-it-works">How It Works</NavLink>
          <NavLink href="#services">Services</NavLink>
          <NavLink href="#benefits">Benefits</NavLink>
          <NavLink href="#testimonials">Testimonials</NavLink>
        </div>

        <div className="footer-column">
          <p className="footer-title">Worker Access</p>
          <Link to="/register">Join as Worker</Link>
          <Link to="/login">Login</Link>
          <Link to="/waiting">Approval Status</Link>
        </div>
      </div>

      <div className="worker-shell footer-bottom">
        <p>&copy; {year} Tasko. All rights reserved.</p>
      </div>
    </footer>
  );
}
