import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

function getFirebaseAuthErrorMessage(error) {
  const code = error?.code || "";
  const fallback = error?.message || "Authentication failed";

  if (code === "auth/operation-not-allowed") {
    return "Email/Password sign-in is disabled in Firebase Console.";
  }
  if (code === "auth/configuration-not-found") {
    return "Firebase Authentication is not initialized for this project. Open Firebase Console > Authentication and click Get started.";
  }
  if (code === "auth/weak-password") {
    return "Password must be at least 6 characters.";
  }
  if (code === "auth/email-already-in-use") {
    return "This email is already in use.";
  }
  if (code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "Invalid email or password.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection and retry.";
  }
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Sign-in popup was closed before completion.";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "Account exists with a different sign-in method for this email.";
  }
  if (code === "auth/unauthorized-domain") {
    return "Current domain is not authorized in Firebase Authentication settings.";
  }

  return fallback;
}

export default function AuthPage() {
  const { register, login, loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [socialLoading, setSocialLoading] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const trimmedEmail = email.trim();

    try {
      if (isRegister) {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }
        await register({ name, email: trimmedEmail, password });
      } else {
        await login(trimmedEmail, password);
      }
      navigate("/home");
    } catch (submitError) {
      setError(submitError.response?.data?.message || getFirebaseAuthErrorMessage(submitError));
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setSocialLoading("google");
    try {
      await loginWithGoogle();
      navigate("/home");
    } catch (submitError) {
      setError(submitError.response?.data?.message || getFirebaseAuthErrorMessage(submitError));
    } finally {
      setSocialLoading("");
    }
  };

  const handleAppleLogin = async () => {
    setError("");
    setSocialLoading("apple");
    try {
      await loginWithApple();
      navigate("/home");
    } catch (submitError) {
      setError(submitError.response?.data?.message || getFirebaseAuthErrorMessage(submitError));
    } finally {
      setSocialLoading("");
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-nav">
        <div className="auth-shell auth-nav-row">
          <a className="auth-brand" href="/#top" aria-label="Tasko home">
            <BrandMark className="auth-brand-mark" />
            <span className="auth-brand-text">TASKO</span>
          </a>
          <nav className="auth-nav-links" aria-label="Marketing navigation">
            <a href="/#services">SERVICES</a>
            <a href="/#why-tasko">WHY TASKO</a>
            <a href="/#plans">PLANS</a>
            <a href="/#how-it-works">HOW IT WORKS</a>
          </nav>
          <Link to="/" className="auth-nav-cta">
            BOOK NOW
          </Link>
        </div>
      </header>

      <section className="auth-section">
        <div className="auth-shell auth-grid">
          <div className="auth-copy">
            <p className="auth-copy-eyebrow">PREMIUM SERVICE MARKETPLACE</p>
            <h1>
              PROFESSIONAL HOME SERVICES.
              <span>DONE RIGHT.</span>
            </h1>
            <p>Securely access your account to schedule trusted services with verified experts.</p>
            <ul className="auth-copy-points">
              <li>VERIFIED PROFESSIONALS</li>
              <li>TRANSPARENT PRICING</li>
              <li>ON-TIME GUARANTEE</li>
            </ul>
          </div>

          <div className="auth-panel">
            <p className="auth-panel-eyebrow">{isRegister ? "CREATE ACCOUNT" : "WELCOME BACK"}</p>
            <h2>{isRegister ? "GET PREMIUM ACCESS" : "SIGN IN TO CONTINUE"}</h2>
            <form onSubmit={handleSubmit} className="auth-form">
              {isRegister ? (
                <input
                  className="auth-input"
                  placeholder="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              ) : null}
              <input
                type="email"
                className="auth-input"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <input
                type="password"
                className="auth-input"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              {error ? <p className="auth-error">{error}</p> : null}
              <button type="submit" className="auth-primary-btn" disabled={socialLoading !== ""}>
                {isRegister ? "REGISTER" : "LOGIN"}
              </button>
            </form>
            <div className="auth-divider-wrap">
              <span />
              <p>OR CONTINUE WITH</p>
              <span />
            </div>
            <div className="auth-social">
              <button type="button" className="auth-social-btn" onClick={handleGoogleLogin} disabled={socialLoading !== ""}>
                {socialLoading === "google" ? "SIGNING IN..." : "CONTINUE WITH GOOGLE"}
              </button>
              <button type="button" className="auth-social-btn dark" onClick={handleAppleLogin} disabled={socialLoading !== ""}>
                {socialLoading === "apple" ? "SIGNING IN..." : "CONTINUE WITH APPLE"}
              </button>
            </div>
            <button type="button" className="auth-toggle-btn" onClick={() => setIsRegister((prev) => !prev)}>
              {isRegister ? "ALREADY HAVE AN ACCOUNT? LOGIN" : "NEED AN ACCOUNT? REGISTER"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

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

function BrandMark({ className = "" }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const sources = ["/tasko-logo-mark.png", "/tasko-logo.png"];

  if (useFallback) {
    return <TaskoMark className={className} />;
  }

  return (
    <img
      className={`${className} auth-brand-mark-image`}
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
