import ScrollReveal from "./ScrollReveal";
import LineIcon from "./LineIcon";

const benefits = [
  {
    title: "Flexible Working Hours",
    description: "Work when it suits your schedule with full control.",
    icon: "calendar-clock"
  },
  {
    title: "Nearby Job Assignments",
    description: "Receive bookings close to your preferred work zones.",
    icon: "pin"
  },
  {
    title: "Weekly Payouts",
    description: "Get timely weekly settlements directly to your account.",
    icon: "wallet"
  },
  {
    title: "Incentive Bonuses",
    description: "Earn extra rewards for consistency and top-quality service.",
    icon: "gift"
  },
  {
    title: "Rating-Based Growth",
    description: "Higher ratings unlock premium and recurring assignments.",
    icon: "growth"
  },
  {
    title: "Secure & Verified Platform",
    description: "Operate on a trusted, quality-controlled marketplace.",
    icon: "shield-check"
  }
];

export default function WhyJoin() {
  return (
    <section id="benefits" className="section-wrap section-benefits">
      <div className="worker-shell">
        <ScrollReveal className="section-header" direction="up">
          <p className="section-eyebrow">Benefits</p>
          <h2>Why Join Tasko</h2>
          <p>Premium benefits designed for professional service providers.</p>
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
