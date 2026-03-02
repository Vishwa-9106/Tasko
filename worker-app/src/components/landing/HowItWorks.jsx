import ScrollReveal from "./ScrollReveal";
import LineIcon from "./LineIcon";

const steps = [
  {
    title: "Submit Application",
    description: "Fill out your details and upload required documents.",
    icon: "clipboard"
  },
  {
    title: "Admin Verification",
    description: "Our team verifies your documents and eligibility.",
    icon: "user-shield"
  },
  {
    title: "Visit & Interview",
    description: "Visit Tasko office for final verification and interaction.",
    icon: "building"
  },
  {
    title: "Get Employee Account",
    description: "Receive your Employee ID and start working with Tasko.",
    icon: "badge-check"
  }
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section-wrap section-soft">
      <div className="worker-shell">
        <ScrollReveal className="section-header" direction="up">
          <p className="section-eyebrow">Hiring Process</p>
          <h2>How Hiring Works</h2>
          <p>A clear four-step process from application to onboarding.</p>
        </ScrollReveal>

        <div className="timeline-grid">
          {steps.map((step, index) => (
            <ScrollReveal
              key={step.title}
              className="timeline-card glass-card-hover"
              direction="up"
              delay={index * 80}
            >
              <p className="timeline-step-count">{String(index + 1).padStart(2, "0")}</p>
              <span className="icon-shell" aria-hidden="true">
                <LineIcon name={step.icon} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
