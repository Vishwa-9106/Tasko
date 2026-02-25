import { useState } from "react";
import { Link } from "react-router-dom";
import "./Landing.css";

const services = [
  {
    title: "HOME CLEANING",
    description: "Deep cleaning by certified professionals",
    icon: "spark"
  },
  {
    title: "PLUMBING",
    description: "Expert plumbing repairs and installations",
    icon: "wrench"
  },
  {
    title: "ELECTRICAL",
    description: "Licensed electricians at your service",
    icon: "bolt"
  },
  {
    title: "AC SERVICES",
    description: "Installation, repair and maintenance",
    icon: "wind"
  },
  {
    title: "VEHICLE SERVICE",
    description: "Doorstep vehicle care and detailing",
    icon: "car"
  },
  {
    title: "ELDER CARE",
    description: "Compassionate and trained caregivers",
    icon: "heart"
  },
  {
    title: "COOKING",
    description: "Hygienic home-style meals by experts",
    icon: "utensils"
  },
  {
    title: "HOME PAINTING",
    description: "Precision wall finishes and premium paints",
    icon: "brush"
  },
  {
    title: "HOME SHIFTING",
    description: "Safe packing, moving and setup support",
    icon: "box"
  }
];

const pillars = [
  {
    title: "VERIFIED PROFESSIONALS",
    description: "Every expert is background-checked and certified",
    icon: "shield"
  },
  {
    title: "STRICT QUALITY TESTING",
    description: "Rigorous standards before and after every job",
    icon: "flask"
  },
  {
    title: "ON-TIME GUARANTEE",
    description: "Punctual service or your money back",
    icon: "clock"
  },
  {
    title: "TRANSPARENT PRICING",
    description: "No hidden fees. Clear upfront estimates",
    icon: "currency"
  }
];

const plans = [
  {
    name: "ONE-TIME",
    price: "$49",
    description: "Single service visit"
  },
  {
    name: "WEEKLY",
    price: "$149",
    description: "Four visits per month"
  },
  {
    name: "BI-WEEKLY",
    price: "$99",
    description: "Two visits per month",
    preferred: true
  },
  {
    name: "MONTHLY",
    price: "$59",
    description: "One scheduled visit"
  }
];

const steps = [
  {
    title: "SELECT SERVICE",
    description: "Browse and choose the service you need"
  },
  {
    title: "SCHEDULE",
    description: "Pick your preferred date and time"
  },
  {
    title: "PROFESSIONAL ASSIGNED",
    description: "A verified expert is matched to you"
  },
  {
    title: "SERVICE COMPLETED",
    description: "Sit back and enjoy quality results"
  }
];

const testimonials = [
  {
    name: "SARAH MITCHELL",
    role: "Homeowner",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=320&q=80",
    quote: "Tasko transformed my home maintenance experience. The professionalism is unmatched."
  },
  {
    name: "JAMES COOPER",
    role: "Property Manager",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=80",
    quote: "Reliable, punctual, and exceptional quality. I trust Tasko with all my properties."
  },
  {
    name: "ELENA RODRIGUEZ",
    role: "Business Owner",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80",
    quote: "Transparent pricing and verified professionals give me complete peace of mind."
  }
];

function TaskoMark({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Tasko mark"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="24" cy="24" r="22.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M29.7 14.3a6.5 6.5 0 0 0-7.7 8.4l-9.4 9.4a2.1 2.1 0 0 0 3 3l9.4-9.4a6.5 6.5 0 0 0 8.4-7.7l-3.7 3.7-3-0.8-0.8-3 3.8-3.6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TaskoLogoLockup({ className = "" }) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (!logoFailed) {
    return (
      <div className={`logo-lockup ${className}`}>
        <img
          className="logo-lockup-image"
          src="/tasko-logo.png"
          alt="Tasko logo"
          onError={() => setLogoFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`logo-lockup ${className}`}>
      <span className="logo-lockup-mark-wrap" aria-hidden="true">
        <BrandMark className="logo-lockup-mark" />
      </span>
      <p className="logo-lockup-title">TASKO</p>
      <p className="logo-lockup-tagline">Task It. We Fix It.</p>
    </div>
  );
}

function BrandMark({ className = "" }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const sources = ["/tasko-logo-mark.png", "/tasko-logo.png"];

  if (useFallback) {
    return <TaskoMark className={className} />;
  }

  return (
    <img
      className={`${className} brand-mark-image`}
      src={sources[sourceIndex]}
      alt="Tasko logo"
      onError={() => {
        if (sourceIndex < sources.length - 1) {
          setSourceIndex(sourceIndex + 1);
          return;
        }
        setUseFallback(true);
      }}
    />
  );
}

function LineIcon({ name }) {
  const props = {
    className: "line-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true"
  };

  switch (name) {
    case "spark":
      return (
        <svg {...props}>
          <path d="M12 3v4M12 17v4M5 10h4M15 10h4M7.5 5.5l2.5 2.5M14 12l2.5 2.5M7.5 14.5l2.5-2.5M14 8l2.5-2.5" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...props}>
          <path d="M13.5 4.5a4.5 4.5 0 0 0 5.6 5.6l-8.7 8.7a2 2 0 0 1-2.8-2.8l8.7-8.7a4.5 4.5 0 0 0-2.8-2.8Z" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...props}>
          <path d="m13 3-8 10h6l-1 8 9-11h-6l1-7Z" />
        </svg>
      );
    case "wind":
      return (
        <svg {...props}>
          <path d="M4 8h10a3 3 0 1 0-3-3M2 12h14a3 3 0 1 1-3 3M6 16h8" />
        </svg>
      );
    case "car":
      return (
        <svg {...props}>
          <path d="M4 14h16l-1.5-5h-13L4 14ZM6.5 17a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM17.5 17a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM3 14v4M21 14v4" />
        </svg>
      );
    case "heart":
      return (
        <svg {...props}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.3A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
        </svg>
      );
    case "utensils":
      return (
        <svg {...props}>
          <path d="M6 3v8M4 3v8M8 3v8M6 11v10M15 3v18M15 3c2 0 3 1.8 3 4s-1 4-3 4" />
        </svg>
      );
    case "brush":
      return (
        <svg {...props}>
          <path d="m4 17 7-7 3 3-7 7H4v-3ZM13 8l2-2 3 3-2 2-3-3Z" />
        </svg>
      );
    case "box":
      return (
        <svg {...props}>
          <path d="M4 7 12 3l8 4-8 4-8-4ZM4 7v10l8 4 8-4V7M12 11v10" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3 6 6v6c0 4 2.5 7 6 9 3.5-2 6-5 6-9V6l-6-3ZM9.5 12l1.8 1.8 3.2-3.3" />
        </svg>
      );
    case "flask":
      return (
        <svg {...props}>
          <path d="M10 3h4M11 3v5l-5 9a2 2 0 0 0 1.8 3h8.4a2 2 0 0 0 1.8-3l-5-9V3" />
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <path d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 4v4l3 2" />
        </svg>
      );
    case "currency":
      return (
        <svg {...props}>
          <path d="M14 5h-3a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6H9M12 3v2M12 19v2" />
        </svg>
      );
    default:
      return null;
  }
}

function SectionHeader({ eyebrow, title, dark = false }) {
  return (
    <div className={`section-header${dark ? " dark" : ""} fade-up`}>
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className="section-title">{title}</h2>
      <span className="section-divider" />
    </div>
  );
}

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div id="top" className="landing-page">
      <header className="landing-nav">
        <div className="landing-shell nav-row">
          <a className="brand" href="#top" aria-label="Tasko home">
            <BrandMark className="brand-mark" />
            <span className="brand-name">TASKO</span>
          </a>
          <nav className="nav-links" aria-label="Landing navigation">
            <a href="#services">SERVICES</a>
            <a href="#why-tasko">WHY TASKO</a>
            <a href="#plans">PLANS</a>
            <a href="#how-it-works">HOW IT WORKS</a>
          </nav>
          <Link to="/auth" className="button-primary compact">
            BOOK NOW
          </Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="landing-shell hero-grid">
          <div className="hero-copy fade-up">
            <TaskoLogoLockup className="hero-logo-lockup" />
            <p className="hero-tagline">PREMIUM SERVICE MARKETPLACE</p>
            <h1 className="hero-title">
              PROFESSIONAL HOME SERVICES.
              <span>DONE RIGHT.</span>
            </h1>
            <p className="hero-subtitle">
              Certified experts. Reliable scheduling. Premium service experience.
            </p>
            <div className="hero-actions">
              <Link to="/auth" className="button-primary">
                BOOK A SERVICE
              </Link>
              <a href="#services" className="button-outline">
                EXPLORE SERVICES
              </a>
            </div>
          </div>
          <div className="hero-image-wrap fade-up" style={{ "--delay": "120ms" }}>
            <img
              className="hero-image"
              src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1260&q=80"
              alt="Professional technician in an industrial workspace"
            />
          </div>
        </div>
      </section>

      <section id="services" className="landing-section services-section">
        <div className="landing-shell">
          <SectionHeader eyebrow="WHAT WE OFFER" title="OUR SERVICES" />
          <div className="services-grid">
            {services.map((service, index) => (
              <article key={service.title} className="service-card fade-up" style={{ "--delay": `${index * 70}ms` }}>
                <LineIcon name={service.icon} />
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <Link to="/auth" className="service-link">
                  VIEW DETAILS
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="why-tasko" className="landing-section trust-section">
        <div className="landing-shell">
          <SectionHeader eyebrow="BUILT ON TRUST" title="WHY TASKO?" dark />
          <div className="trust-grid">
            {pillars.map((pillar, index) => (
              <article key={pillar.title} className="trust-card fade-up" style={{ "--delay": `${index * 90}ms` }}>
                <span className="trust-icon-wrap">
                  <LineIcon name={pillar.icon} />
                </span>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="landing-section plans-section">
        <div className="landing-shell">
          <SectionHeader eyebrow="FLEXIBLE OPTIONS" title="SERVICE PLANS" />
          <div className="plans-grid">
            {plans.map((plan, index) => (
              <article key={plan.name} className={`plan-card fade-up${plan.preferred ? " preferred" : ""}`} style={{ "--delay": `${index * 80}ms` }}>
                {plan.preferred ? <span className="preferred-badge">MOST PREFERRED</span> : null}
                <h3>{plan.name}</h3>
                <p className="plan-price">{plan.price}</p>
                <p className="plan-description">{plan.description}</p>
                <Link to="/auth" className={plan.preferred ? "button-primary plan-button" : "button-outline plan-button"}>
                  SCHEDULE NOW
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section process-section">
        <div className="landing-shell">
          <SectionHeader eyebrow="SIMPLE PROCESS" title="HOW IT WORKS" />
          <div className="process-grid">
            {steps.map((step, index) => (
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

      <section className="landing-section testimonials-section">
        <div className="landing-shell">
          <SectionHeader eyebrow="WHAT CLIENTS SAY" title="TESTIMONIALS" />
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <article key={testimonial.name} className="testimonial-card fade-up" style={{ "--delay": `${index * 90}ms` }}>
                <img className="testimonial-image" src={testimonial.image} alt={testimonial.name} />
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
          <h2>READY TO GET STARTED?</h2>
          <p>Experience the premium difference. Book your first service today.</p>
          <Link to="/auth" className="button-primary">
            BOOK YOUR SERVICE
          </Link>
          <div className="cta-footer">
            <span className="brand footer-brand">
              <BrandMark className="brand-mark" />
              <span className="brand-name">TASKO</span>
            </span>
            <p>&copy; {year} Tasko. All rights reserved. Premium home services.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
