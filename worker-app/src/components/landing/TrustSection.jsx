import ScrollReveal from "./ScrollReveal";
import LineIcon from "./LineIcon";

const checks = [
  { text: "Document Verification", icon: "clipboard" },
  { text: "Background Check", icon: "user-shield" },
  { text: "In-Person Interaction", icon: "users" },
  { text: "Professional Standards", icon: "medal" }
];

export default function TrustSection() {
  return (
    <section className="section-wrap trust-section">
      <div className="worker-shell">
        <ScrollReveal className="trust-card glass-card" direction="up">
          <p className="section-eyebrow">Hiring Standards</p>
          <h2>Trusted Hiring Process</h2>
          <p className="trust-copy">
            Every worker goes through document verification and in-person screening to ensure safety and service
            quality.
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
