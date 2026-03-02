import ScrollReveal from "./ScrollReveal";

const testimonials = [
  {
    name: "Rajesh Kumar",
    category: "Electrical Team",
    quote: "Tasko gave me stable income and structured growth."
  },
  {
    name: "Priya Sharma",
    category: "Housekeeping Team",
    quote: "The fixed monthly salary and clear schedules helped me plan my family finances with confidence."
  },
  {
    name: "Amit Patel",
    category: "Maintenance Team",
    quote: "Office verification and strong team support made my work more professional, secure, and consistent."
  }
];

function StarRating() {
  return (
    <p className="stars" aria-label="5 out of 5 rating">
      5/5
    </p>
  );
}

export default function Testimonials() {
  return (
    <section id="testimonials" className="section-wrap">
      <div className="worker-shell">
        <ScrollReveal className="section-header" direction="up">
          <p className="section-eyebrow">Testimonials</p>
          <h2>Trusted by Thousands</h2>
          <p>Hear from employees building stable careers with Tasko.</p>
        </ScrollReveal>

        <div className="testimonials-grid">
          {testimonials.map((item, index) => (
            <ScrollReveal key={item.name} className="testimonial-card glass-card-hover" direction="up" delay={index * 90}>
              <StarRating />
              <p className="testimonial-quote">"{item.quote}"</p>
              <div className="testimonial-person">
                <span className="testimonial-avatar" aria-hidden="true">
                  {item.name.charAt(0)}
                </span>
                <div>
                  <p className="testimonial-name">{item.name}</p>
                  <p className="testimonial-category">{item.category}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
