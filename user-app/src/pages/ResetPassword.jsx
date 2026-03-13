import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuthBrandMark from "../components/AuthBrandMark";
import api from "../api";
import "./Auth.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token = "" } = useParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");

  useEffect(() => {
    let active = true;

    async function validateToken() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/api/auth/reset-password/${token}`);
        if (!active) {
          return;
        }
        setIsValid(Boolean(response.data?.valid));
        setMaskedEmail(response.data?.email || "");
      } catch (requestError) {
        if (!active) {
          return;
        }
        setIsValid(false);
        setError(requestError.response?.data?.message || "This password reset link is invalid or has expired.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (token) {
      void validateToken();
    } else {
      setLoading(false);
      setError("This password reset link is invalid or has expired.");
    }

    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password must match.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await api.post(`/api/auth/reset-password/${token}`, {
        password,
        confirmPassword
      });
      setSuccess(response.data?.message || "Your password has been successfully updated. Please log in.");
      window.setTimeout(() => {
        navigate("/auth?reset=success", { replace: true });
      }, 900);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to reset password.");
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
            <p className="auth-copy-eyebrow">PASSWORD RESET</p>
            <h1>
              CREATE A NEW
              <span>PASSWORD.</span>
            </h1>
            <p>Choose a new password for your Tasko account. This secure reset link can only be used once.</p>
            <ul className="auth-copy-points">
              <li>EMAIL VERIFIED</li>
              <li>ONE-TIME TOKEN</li>
              <li>SECURE UPDATE</li>
            </ul>
          </div>

          <div className="auth-panel">
            <p className="auth-panel-eyebrow">RESET PASSWORD</p>
            <h2>SET NEW PASSWORD</h2>
            {loading ? <p className="auth-panel-copy">Validating your reset link...</p> : null}
            {!loading && maskedEmail ? (
              <p className="auth-panel-copy">Resetting password for <strong>{maskedEmail}</strong>.</p>
            ) : null}
            {!loading && isValid ? (
              <form onSubmit={handleSubmit} className="auth-form">
                <input
                  type="password"
                  className="auth-input"
                  placeholder="New password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                {success ? <p className="auth-success">{success}</p> : null}
                {error ? <p className="auth-error">{error}</p> : null}
                <button type="submit" className="auth-primary-btn" disabled={submitting}>
                  {submitting ? "UPDATING..." : "UPDATE PASSWORD"}
                </button>
              </form>
            ) : null}
            {!loading && !isValid ? (
              <div className="auth-form">
                {error ? <p className="auth-error">{error}</p> : null}
                <Link to="/forgot-password" className="auth-social-btn auth-link-btn">
                  REQUEST NEW LINK
                </Link>
              </div>
            ) : null}
            <div className="auth-helper-row auth-helper-row-stack">
              <span className="auth-helper-copy">Prefer to return without changing it?</span>
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
