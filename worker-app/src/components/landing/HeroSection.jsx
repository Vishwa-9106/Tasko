import { Link } from "react-router-dom";
import ScrollReveal from "./ScrollReveal";
import LineIcon from "./LineIcon";

const stats = [
  {
    key: "earnings",
    label: "Earnings Weekly",
    value: "₹8,000+",
    icon: "rupee"
  },
  {
    key: "verified",
    label: "Verified Workers",
    value: "12,000+",
    icon: "users"
  },
  {
    key: "hours",
    label: "Flexible Hours",
    value: "24/7",
    icon: "clock"
  }
];

function WorkerIllustration() {
  return (
    <svg
      className="worker-illustration-svg"
      viewBox="0 0 560 640"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Professional worker illustration"
    >
      <defs>
        <linearGradient id="uniformMain" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E2D56" />
          <stop offset="100%" stopColor="#101B3D" />
        </linearGradient>
        <linearGradient id="uniformAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0C983" />
          <stop offset="100%" stopColor="#B99247" />
        </linearGradient>
        <radialGradient id="groundGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="rgba(224,201,131,0.4)" />
          <stop offset="100%" stopColor="rgba(224,201,131,0)" />
        </radialGradient>
      </defs>

      <ellipse cx="285" cy="570" rx="170" ry="40" fill="url(#groundGlow)" />

      <rect x="210" y="150" width="150" height="175" rx="38" fill="url(#uniformMain)" stroke="#22355F" strokeWidth="3" />
      <rect x="235" y="190" width="35" height="10" rx="4" fill="url(#uniformAccent)" />
      <rect x="298" y="190" width="35" height="10" rx="4" fill="url(#uniformAccent)" />

      <rect x="230" y="315" width="45" height="150" rx="20" fill="url(#uniformMain)" stroke="#22355F" strokeWidth="3" />
      <rect x="292" y="315" width="45" height="150" rx="20" fill="url(#uniformMain)" stroke="#22355F" strokeWidth="3" />

      <rect x="225" y="462" width="58" height="80" rx="20" fill="#0C142E" />
      <rect x="286" y="462" width="58" height="80" rx="20" fill="#0C142E" />
      <path d="M223 535h62a10 10 0 0 1-10 10h-42a10 10 0 0 1-10-10Z" fill="#060C1E" />
      <path d="M284 535h62a10 10 0 0 1-10 10h-42a10 10 0 0 1-10-10Z" fill="#060C1E" />

      <rect x="178" y="177" width="38" height="138" rx="18" fill="url(#uniformMain)" stroke="#22355F" strokeWidth="3" />
      <rect x="354" y="177" width="38" height="138" rx="18" fill="url(#uniformMain)" stroke="#22355F" strokeWidth="3" />

      <rect x="172" y="300" width="50" height="18" rx="8" fill="#202B4A" />
      <rect x="347" y="300" width="50" height="18" rx="8" fill="#202B4A" />

      <rect x="204" y="150" width="162" height="20" rx="10" fill="#0D1735" />
      <ellipse cx="285" cy="127" rx="54" ry="57" fill="#C58C66" />
      <path d="M235 123c18-38 70-40 96-5v17h-96v-12Z" fill="#0E1736" />

      <rect x="250" y="311" width="70" height="18" rx="6" fill="url(#uniformAccent)" />
      <rect x="260" y="316" width="16" height="8" rx="3" fill="#0C1124" />
      <rect x="293" y="316" width="16" height="8" rx="3" fill="#0C1124" />

      <rect x="180" y="318" width="32" height="70" rx="10" fill="#B7482C" />
      <rect x="188" y="387" width="16" height="44" rx="8" fill="#202838" />
      <rect x="358" y="320" width="28" height="68" rx="10" fill="#8A9AAC" />
      <rect x="364" y="384" width="15" height="44" rx="8" fill="#202838" />
    </svg>
  );
}

export default function HeroSection({ loginHref }) {
  return (
    <section className="hero-section">
      <div className="worker-shell hero-grid">
        <ScrollReveal className="hero-copy" direction="up">
          <p className="hero-eyebrow">Premium Service Platform</p>
          <h1 className="hero-title">
            Turn Your Skills Into <span className="gold-gradient-text">Premium Earnings</span> with Tasko
          </h1>
          <p className="hero-subtitle">
            Join a verified network of professional service providers and grow your income with flexible work.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn-luxury-primary btn-glow">
              Join as a Worker
            </Link>
            <Link to={loginHref} className="btn-luxury-secondary">
              Login
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

          <article className="hero-floating-card stat-earn">
            <span className="stat-icon" aria-hidden="true">
              <LineIcon name="rupee" />
            </span>
            <div>
              <p className="stat-label">Earnings Weekly</p>
              <p className="stat-value">₹8,000+</p>
            </div>
          </article>

          <article className="hero-floating-card stat-verified">
            <span className="stat-icon" aria-hidden="true">
              <LineIcon name="users" />
            </span>
            <div>
              <p className="stat-label">Verified Workers</p>
              <p className="stat-value">12,000+</p>
            </div>
          </article>

          <article className="hero-floating-card stat-hours">
            <span className="stat-icon" aria-hidden="true">
              <LineIcon name="clock" />
            </span>
            <div>
              <p className="stat-label">Flexible Hours</p>
              <p className="stat-value">24/7</p>
            </div>
          </article>
        </ScrollReveal>
      </div>
    </section>
  );
}
