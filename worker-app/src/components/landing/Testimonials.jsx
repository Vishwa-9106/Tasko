import ScrollReveal from "./ScrollReveal";

const testimonials = [
  {
    name: "Rajesh Kumar",
    category: "Electrician",
    quote:
      "Tasko transformed my work life. I now earn significantly more with predictable payouts and full schedule control."
  },
  {
    name: "Priya Sharma",
    category: "Home Cleaning",
    quote:
      "The platform gives me nearby assignments and consistent demand. The verification process also builds real client trust."
  },
  {
    name: "Amit Patel",
    category: "AC Repair",
    quote:
      "Being a verified Tasko professional helped me attract premium clients and maintain steady monthly growth."
  }
];

function StarRating() {
  return (
    <p className="stars" aria-label="5 star rating">
      {"★★★★★"}
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
          <p>Hear from workers who elevated their earnings with Tasko.</p>
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
