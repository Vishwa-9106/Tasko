import { Link } from "react-router-dom";
import ScrollReveal from "./ScrollReveal";
import LineIcon from "./LineIcon";

const stats = [
  {
    key: "salary",
    label: "Employment Model",
    value: "Monthly Salary Model",
    icon: "wallet",
    positionClass: "stat-earn"
  },
  {
    key: "verified",
    label: "Safety Standard",
    value: "Verified & Secure",
    icon: "shield-check",
    positionClass: "stat-verified"
  },
  {
    key: "office",
    label: "Hiring Process",
    value: "Office-Based Hiring",
    icon: "building",
    positionClass: "stat-hours"
  }
];

function WorkerIllustration() {
  return (
    <svg
      className="worker-illustration-svg"
      viewBox="0 0 560 640"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Professional employee illustration"
    >
      <defs>
        <linearGradient id="attireMain" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22335F" />
          <stop offset="100%" stopColor="#101A3A" />
        </linearGradient>
        <linearGradient id="attireAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0C983" />
          <stop offset="100%" stopColor="#B99247" />
        </linearGradient>
        <radialGradient id="groundGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="rgba(224,201,131,0.4)" />
          <stop offset="100%" stopColor="rgba(224,201,131,0)" />
        </radialGradient>
      </defs>

      <ellipse cx="285" cy="570" rx="170" ry="40" fill="url(#groundGlow)" />

      <ellipse cx="285" cy="128" rx="54" ry="58" fill="#C58C66" />
      <path d="M235 123c18-38 70-40 96-5v17h-96v-12Z" fill="#0D1735" />
      <path d="M245 162c10 14 22 21 40 21s30-7 40-21v32h-80Z" fill="#F1F4FA" />
      <path d="M280 162h10v60h-10z" fill="#C6A75E" />
      <path d="M262 221h46l-23 30z" fill="#0F1A3C" />

      <path d="M206 168h158v158H206z" fill="url(#attireMain)" stroke="#22355F" strokeWidth="3" />
      <path d="M206 171 258 251h54l52-80" fill="none" stroke="#2D4378" strokeWidth="3" />
      <rect x="250" y="255" width="70" height="22" rx="7" fill="url(#attireAccent)" />
      <rect x="263" y="260" width="14" height="8" rx="3" fill="#0B122A" />
      <rect x="292" y="260" width="14" height="8" rx="3" fill="#0B122A" />

      <rect x="206" y="178" width="36" height="132" rx="18" fill="url(#attireMain)" stroke="#22355F" strokeWidth="3" />
      <rect x="328" y="178" width="36" height="132" rx="18" fill="url(#attireMain)" stroke="#22355F" strokeWidth="3" />
      <rect x="200" y="297" width="48" height="18" rx="8" fill="#202B4A" />
      <rect x="322" y="297" width="48" height="18" rx="8" fill="#202B4A" />

      <rect x="230" y="315" width="45" height="150" rx="20" fill="url(#attireMain)" stroke="#22355F" strokeWidth="3" />
      <rect x="292" y="315" width="45" height="150" rx="20" fill="url(#attireMain)" stroke="#22355F" strokeWidth="3" />

      <rect x="225" y="462" width="58" height="80" rx="20" fill="#0C142E" />
      <rect x="286" y="462" width="58" height="80" rx="20" fill="#0C142E" />
      <path d="M223 535h62a10 10 0 0 1-10 10h-42a10 10 0 0 1-10-10Z" fill="#060C1E" />
      <path d="M284 535h62a10 10 0 0 1-10 10h-42a10 10 0 0 1-10-10Z" fill="#060C1E" />

      <rect x="360" y="325" width="52" height="78" rx="12" fill="#8C9AAF" />
      <rect x="365" y="335" width="42" height="50" rx="8" fill="#5D6E8A" />
      <path d="M380 318h12v16h-12z" fill="#5D6E8A" />

      <rect x="162" y="320" width="34" height="66" rx="9" fill="#B7482C" />
      <rect x="168" y="385" width="22" height="42" rx="8" fill="#252D40" />

      <rect x="265" y="287" width="40" height="62" rx="8" fill="#E7EEF9" />
      <rect x="272" y="296" width="26" height="16" rx="4" fill="#C6A75E" />
      <rect x="272" y="317" width="26" height="22" rx="5" fill="#2C3B63" />
    </svg>
  );
}

export default function HeroSection({ loginHref }) {
  return (
    <section className="hero-section">
      <div className="worker-shell hero-grid">
        <ScrollReveal className="hero-copy" direction="up">
          <p className="hero-eyebrow">Employee Hiring Program</p>
          <h1 className="hero-title">
            Build Your Career With <span className="gold-gradient-text">Tasko</span>
          </h1>
          <p className="hero-subtitle">
            Join Tasko as a verified company employee and work with structured salary, professional growth, and secure
            job assignments.
          </p>
          <div className="hero-actions">
            <Link to="/apply" className="btn-luxury-primary btn-glow">
              Apply for Job
            </Link>
            <Link to={loginHref} className="btn-luxury-secondary">
              Employee Login
            </Link>
          </div>

          <div className="hero-mobile-stats">
            {stats.map((item) => (
              <article className="hero-stat-card" key={item.key}>
                <span className="stat-icon" aria-hidden="true">
                  <LineIcon name={item.icon} />
                </span>
                <p className="stat-label">{item.label}</p>
                <p className="stat-value">{item.value}</p>
              </article>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal className="hero-visual-wrap" direction="left" delay={120}>
          <div className="hero-visual-glow" />
          <div className="hero-visual-card">
            <WorkerIllustration />
          </div>

          {stats.map((item) => (
            <article className={`hero-floating-card ${item.positionClass}`} key={`floating-${item.key}`}>
              <span className="stat-icon" aria-hidden="true">
                <LineIcon name={item.icon} />
              </span>
              <div>
                <p className="stat-label">{item.label}</p>
                <p className="stat-value">{item.value}</p>
              </div>
            </article>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
