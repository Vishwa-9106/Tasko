import ScrollReveal from "./ScrollReveal";
import LineIcon from "./LineIcon";

const steps = [
  {
    title: "Create Account",
    description: "Sign up with your profile and service details in minutes.",
    icon: "user-plus"
  },
  {
    title: "Select Service Category",
    description: "Choose your specialization to match premium demand.",
    icon: "checklist"
  },
  {
    title: "Complete Skill Test",
    description: "Show your expertise through category-specific evaluation.",
    icon: "clipboard-check"
  },
  {
    title: "Get Admin Approval & Start Earning",
    description: "Go live once verified and begin receiving quality jobs.",
    icon: "badge-check"
  }
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section-wrap section-soft">
      <div className="worker-shell">
        <ScrollReveal className="section-header" direction="up">
          <p className="section-eyebrow">Process</p>
          <h2>How It Works</h2>
          <p>Four clear steps to start your premium earning journey.</p>
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
