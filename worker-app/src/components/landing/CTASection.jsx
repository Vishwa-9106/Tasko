import { Link } from "react-router-dom";
import ScrollReveal from "./ScrollReveal";

export default function CTASection() {
  return (
    <section className="section-wrap cta-section">
      <div className="worker-shell">
        <ScrollReveal className="cta-card" direction="up">
          <h2>
            Ready to Elevate Your <span className="gold-gradient-text">Earnings?</span>
          </h2>
          <p>Join thousands of professionals already thriving with Tasko.</p>
          <Link to="/register" className="btn-luxury-primary btn-glow cta-button">
            Become a Tasko Professional Today
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
