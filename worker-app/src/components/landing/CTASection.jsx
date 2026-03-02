import { Link } from "react-router-dom";
import ScrollReveal from "./ScrollReveal";

export default function CTASection({ loginHref }) {
  return (
    <section className="section-wrap cta-section">
      <div className="worker-shell">
        <ScrollReveal className="cta-card" direction="up">
          <h2>Ready to Join Tasko Team?</h2>
          <p>Apply to become a verified Tasko employee with stable salary and structured growth.</p>
          <div className="cta-actions">
            <Link to="/apply" className="btn-luxury-primary btn-glow cta-button">
              Apply Now
            </Link>
            <Link to={loginHref} className="cta-secondary-link">
              Already an Employee? Login
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
