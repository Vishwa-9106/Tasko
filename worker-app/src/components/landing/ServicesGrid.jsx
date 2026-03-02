import ScrollReveal from "./ScrollReveal";
import LineIcon from "./LineIcon";

const services = [
  { title: "Home Cleaning", icon: "sparkle" },
  { title: "Plumbing", icon: "wrench" },
  { title: "Electrical", icon: "bolt" },
  { title: "AC Repair", icon: "wind" },
  { title: "Cooking", icon: "chef" },
  { title: "Babysitting", icon: "baby" },
  { title: "Elder Care", icon: "elder" },
  { title: "Painting", icon: "paint" },
  { title: "Mechanic", icon: "car" },
  { title: "Shifting Help", icon: "truck" }
];

export default function ServicesGrid() {
  return (
    <section id="services" className="section-wrap">
      <div className="worker-shell">
        <ScrollReveal className="section-header" direction="up">
          <p className="section-eyebrow">Categories</p>
          <h2>Service Categories</h2>
          <p>Apply for the service category that matches your skills.</p>
        </ScrollReveal>

        <div className="services-grid">
          {services.map((service, index) => (
            <ScrollReveal
              key={service.title}
              className="service-card glass-card-hover"
              direction="up"
              delay={index * 40}
            >
              <span className="icon-shell" aria-hidden="true">
                <LineIcon name={service.icon} />
              </span>
              <h3>{service.title}</h3>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
