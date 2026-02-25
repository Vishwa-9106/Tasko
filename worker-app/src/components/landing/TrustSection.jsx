import ScrollReveal from "./ScrollReveal";
import LineIcon from "./LineIcon";

const checks = [
  { text: "Category-based test", icon: "clipboard" },
  { text: "Admin evaluation", icon: "user-shield" },
  { text: "Only approved workers go live", icon: "check-circle" },
  { text: "Quality-driven marketplace", icon: "medal" }
];

export default function TrustSection() {
  return (
    <section className="section-wrap trust-section">
      <div className="worker-shell">
        <ScrollReveal className="trust-card glass-card" direction="up">
          <p className="section-eyebrow">Trust & Quality</p>
          <h2>Skill-Based Verification System</h2>
          <p className="trust-copy">
            Every Tasko worker is evaluated through a category-specific process before going live. This keeps the
            marketplace reliable and quality-focused.
          </p>

          <div className="trust-grid">
            {checks.map((item, index) => (
              <ScrollReveal
                key={item.text}
                className="trust-item"
                direction="up"
                delay={index * 60}
                as="article"
              >
                <span className="trust-icon" aria-hidden="true">
                  <LineIcon name={item.icon} />
                </span>
                <p>{item.text}</p>
              </ScrollReveal>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
