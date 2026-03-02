import ScrollReveal from "./ScrollReveal";
import LineIcon from "./LineIcon";

const benefits = [
  {
    title: "Fixed Monthly Salary",
    description: "Receive consistent monthly compensation as a verified Tasko employee.",
    icon: "wallet"
  },
  {
    title: "Performance Incentives",
    description: "Earn additional rewards based on quality, discipline, and outcomes.",
    icon: "gift"
  },
  {
    title: "Structured Work Schedule",
    description: "Follow defined shifts and assignment planning for better work balance.",
    icon: "calendar-clock"
  },
  {
    title: "Verified Company Environment",
    description: "Work within a secure, document-verified, and professionally managed setup.",
    icon: "shield-check"
  },
  {
    title: "Growth Opportunities",
    description: "Access career advancement paths through performance and responsibility.",
    icon: "growth"
  },
  {
    title: "Professional Support Team",
    description: "Get guidance from dedicated supervisors and operations support staff.",
    icon: "users"
  }
];

export default function WhyJoin() {
  return (
    <section id="benefits" className="section-wrap section-benefits">
      <div className="worker-shell">
        <ScrollReveal className="section-header" direction="up">
          <p className="section-eyebrow">Employee Benefits</p>
          <h2>Why Work With Tasko?</h2>
          <p>Built for long-term careers, salary stability, and professional development.</p>
        </ScrollReveal>

        <div className="benefits-grid">
          {benefits.map((benefit, index) => (
            <ScrollReveal
              key={benefit.title}
              className="benefit-card glass-card-hover"
              direction={index % 2 === 0 ? "left" : "right"}
              delay={index * 50}
            >
              <span className="icon-shell" aria-hidden="true">
                <LineIcon name={benefit.icon} />
              </span>
              <div>
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
