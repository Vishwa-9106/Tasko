import { useState } from "react";
import { Link } from "react-router-dom";
import AuthBrandMark from "../components/AuthBrandMark";
import api from "../api";
import "./Auth.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/api/auth/forgot-password", {
        email: email.trim().toLowerCase()
      });
      setSuccess(response.data?.message || "If an account with that email exists, a password reset link has been sent.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to send password reset email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-nav">
        <div className="auth-shell auth-nav-row">
          <Link className="auth-brand" to="/" aria-label="Tasko home">
            <AuthBrandMark className="auth-brand-mark" />
            <span className="auth-brand-text">TASKO</span>
          </Link>
          <nav className="auth-nav-links" aria-label="Marketing navigation">
            <a href="/#services">SERVICES</a>
            <a href="/#why-tasko">WHY TASKO</a>
            <a href="/#plans">PLANS</a>
            <a href="/#how-it-works">HOW IT WORKS</a>
          </nav>
          <Link to="/auth" className="auth-nav-cta">
            LOGIN
          </Link>
        </div>
      </header>

      <section className="auth-section">
        <div className="auth-shell auth-grid">
          <div className="auth-copy">
            <p className="auth-copy-eyebrow">ACCOUNT RECOVERY</p>
            <h1>
              RESET ACCESS.
              <span>SECURELY.</span>
            </h1>
            <p>Enter your registered email address and we will send you a secure Tasko password reset link.</p>
            <ul className="auth-copy-points">
              <li>10 MINUTE EXPIRY</li>
              <li>SINGLE-USE LINK</li>
              <li>SECURE DELIVERY</li>
            </ul>
          </div>

          <div className="auth-panel">
            <p className="auth-panel-eyebrow">FORGOT PASSWORD</p>
            <h2>REQUEST RESET LINK</h2>
            <p className="auth-panel-copy">Use the same email address you use to log in to Tasko.</p>
            <form onSubmit={handleSubmit} className="auth-form">
              <input
                type="email"
                className="auth-input"
                placeholder="Registered email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              {success ? <p className="auth-success">{success}</p> : null}
              {error ? <p className="auth-error">{error}</p> : null}
              <button type="submit" className="auth-primary-btn" disabled={submitting}>
                {submitting ? "SENDING..." : "SEND RESET LINK"}
              </button>
            </form>
            <div className="auth-helper-row auth-helper-row-stack">
              <span className="auth-helper-copy">Remembered your password?</span>
              <Link to="/auth" className="auth-inline-link">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
