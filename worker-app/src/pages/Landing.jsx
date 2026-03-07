import { Link } from "react-router-dom";
import TaskoBrandMark from "../components/TaskoBrandMark";
import LineIcon from "../components/landing/LineIcon";

const services = [
  { title: "HOME CLEANING", description: "Join verified teams delivering deep and routine cleaning.", icon: "sparkle" },
  { title: "PLUMBING", description: "Handle repair, installation, and maintenance requests with Tasko support.", icon: "wrench" },
  { title: "ELECTRICAL", description: "Work on scheduled residential jobs with structured assignments.", icon: "bolt" },
  { title: "AC REPAIR", description: "Serve appliance and cooling service bookings across the city.", icon: "wind" },
  { title: "COOKING", description: "Support households with hygienic daily and event-based cooking jobs.", icon: "chef" },
  { title: "ELDER CARE", description: "Provide dependable caregiving services through a trusted network.", icon: "elder" }
];

const benefits = [
  { title: "FIXED MONTHLY SALARY", description: "Get predictable monthly payouts with company-managed assignments." },
  { title: "PERFORMANCE INCENTIVES", description: "Unlock extra rewards for quality, punctuality, and reliability." },
  { title: "STRUCTURED SHIFTS", description: "Work with planned schedules instead of chasing ad-hoc jobs." },
  { title: "SUPERVISOR SUPPORT", description: "Receive operational help, escalation support, and professional guidance.", preferred: true }
];

const hiringSteps = [
  { title: "SUBMIT APPLICATION", description: "Share your details, address, and required proof documents." },
  { title: "DOCUMENT REVIEW", description: "Tasko verifies your profile, category fit, and submitted proofs." },
  { title: "ADMIN APPROVAL", description: "Approved workers receive employee credentials from the operations team." },
  { title: "START WORKING", description: "Log in, set availability, and begin managing assigned jobs." }
];

const hiringStandards = [
  { title: "DOCUMENT VERIFICATION", description: "Identity and address proofs are reviewed before onboarding.", icon: "clipboard-check" },
  { title: "BACKGROUND SCREENING", description: "Every approved worker passes internal trust and safety checks.", icon: "badge-check" },
  { title: "ROLE-BASED TRAINING", description: "Operational expectations are aligned before assignments begin.", icon: "check-circle" },
  { title: "QUALITY MONITORING", description: "Performance and discipline stay under continuous review.", icon: "medal" }
];

const testimonials = [
  {
    name: "RAJESH KUMAR",
    role: "Electrical Team",
    quote: "Tasko gave me stable monthly income and a more professional way to work."
  },
  {
    name: "PRIYA SHARMA",
    role: "Housekeeping Team",
    quote: "The schedule is clear, support is responsive, and I can plan my month with confidence."
  },
  {
    name: "AMIT PATEL",
    role: "Maintenance Team",
    quote: "The onboarding process felt serious and the work environment is much more structured."
  }
];

export default function LandingPage() {
  const workerSession = localStorage.getItem("tasko_worker_session_token");
  const loginHref = workerSession ? "/dashboard" : "/login";
  const year = new Date().getFullYear();

  return (
    <div id="top" className="landing-page worker-sync-landing">
      <header className="landing-nav">
        <div className="landing-shell nav-row">
          <a className="brand" href="#top" aria-label="Tasko worker home">
            <TaskoBrandMark className="brand-mark brand-mark-image" />
            <span className="brand-name">TASKO</span>
          </a>
          <nav className="nav-links" aria-label="Worker landing navigation">
            <a href="#categories">CATEGORIES</a>
            <a href="#benefits">BENEFITS</a>
            <a href="#standards">STANDARDS</a>
            <a href="#stories">STORIES</a>
          </nav>
          <Link to={loginHref} className="button-primary compact">
            {workerSession ? "OPEN DASHBOARD" : "EMPLOYEE LOGIN"}
          </Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="landing-shell hero-grid">
          <div className="hero-copy fade-up">
            <p className="hero-tagline">TASKO WORKFORCE</p>
            <h1 className="hero-title">
              BUILD A STABLE
              <span>CAREER WITH TASKO.</span>
            </h1>
            <p className="hero-subtitle">
              Join a verified operations team with structured schedules, supervised assignments, and dependable
              monthly earnings.
            </p>
            <div className="hero-actions">
              <Link to="/apply" className="button-primary">
                APPLY NOW
              </Link>
              <Link to={loginHref} className="button-outline">
                {workerSession ? "GO TO DASHBOARD" : "EMPLOYEE LOGIN"}
              </Link>
            </div>
          </div>

          <div className="hero-image-wrap fade-up worker-sync-hero-visual" style={{ "--delay": "120ms" }}>
            <img
              className="hero-image"
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1260&q=80"
              alt="Tasko field workers collaborating on assignments"
            />
          </div>
        </div>
      </section>

      <section id="categories" className="landing-section services-section">
        <div className="landing-shell">
          <div className="section-header fade-up">
            <p className="section-eyebrow">OPEN ROLES</p>
            <h2 className="section-title">SERVICE CATEGORIES</h2>
            <span className="section-divider" />
          </div>
          <div className="services-grid">
            {services.map((service, index) => (
              <article key={service.title} className="service-card fade-up" style={{ "--delay": `${index * 70}ms` }}>
                <LineIcon name={service.icon} className="line-icon" />
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <Link to="/apply" className="service-link">
                  APPLY FOR ROLE
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="landing-section">
        <div className="landing-shell">
          <div className="section-header fade-up">
            <p className="section-eyebrow">EMPLOYEE VALUE</p>
            <h2 className="section-title">WHY JOIN TASKO</h2>
            <span className="section-divider" />
          </div>
          <div className="plans-grid">
            {benefits.map((benefit, index) => (
              <article
                key={benefit.title}
                className={`plan-card fade-up${benefit.preferred ? " preferred" : ""}`}
                style={{ "--delay": `${index * 80}ms` }}
              >
                {benefit.preferred ? <span className="preferred-badge">TEAM SUPPORT</span> : null}
                <h3>{benefit.title}</h3>
                <p className="plan-price">{String(index + 1).padStart(2, "0")}</p>
                <p className="plan-description">{benefit.description}</p>
                <Link to="/apply" className={benefit.preferred ? "button-primary plan-button" : "button-outline plan-button"}>
                  START APPLICATION
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section process-section">
        <div className="landing-shell">
          <div className="section-header fade-up">
            <p className="section-eyebrow">HIRING FLOW</p>
            <h2 className="section-title">HOW IT WORKS</h2>
            <span className="section-divider" />
          </div>
          <div className="process-grid">
            {hiringSteps.map((step, index) => (
              <article
                key={step.title}
                className="process-card fade-up"
                data-step={String(index + 1).padStart(2, "0")}
                style={{ "--delay": `${index * 90}ms` }}
              >
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="standards" className="landing-section trust-section">
        <div className="landing-shell">
          <div className="section-header dark fade-up">
            <p className="section-eyebrow">HIRING STANDARDS</p>
            <h2 className="section-title">TRUSTED ONBOARDING</h2>
            <span className="section-divider" />
          </div>
          <div className="trust-grid">
            {hiringStandards.map((item, index) => (
              <article key={item.title} className="trust-card fade-up" style={{ "--delay": `${index * 90}ms` }}>
                <span className="trust-icon-wrap">
                  <LineIcon name={item.icon} className="line-icon" />
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="stories" className="landing-section testimonials-section">
        <div className="landing-shell">
          <div className="section-header fade-up">
            <p className="section-eyebrow">TEAM STORIES</p>
            <h2 className="section-title">WORKER TESTIMONIALS</h2>
            <span className="section-divider" />
          </div>
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <article key={testimonial.name} className="testimonial-card fade-up" style={{ "--delay": `${index * 90}ms` }}>
                <div className="worker-sync-testimonial-avatar" aria-hidden="true">
                  {testimonial.name.charAt(0)}
                </div>
                <p className="stars" aria-label="Five star rating">
                  &#9733;&#9733;&#9733;&#9733;&#9733;
                </p>
                <blockquote>"{testimonial.quote}"</blockquote>
                <h3>{testimonial.name}</h3>
                <p className="testimonial-role">{testimonial.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="landing-shell cta-inner">
          <h2>READY TO WORK WITH TASKO?</h2>
          <p>Apply for an employee role or log in to manage your daily assignments.</p>
          <div className="hero-actions worker-sync-cta-actions">
            <Link to="/apply" className="button-primary">
              SUBMIT APPLICATION
            </Link>
            <Link to={loginHref} className="button-outline">
              {workerSession ? "OPEN DASHBOARD" : "LOGIN"}
            </Link>
          </div>
          <div className="cta-footer">
            <span className="brand footer-brand">
              <TaskoBrandMark className="brand-mark brand-mark-image" />
              <span className="brand-name">TASKO</span>
            </span>
            <p>&copy; {year} Tasko. All rights reserved. Structured work for verified professionals.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
