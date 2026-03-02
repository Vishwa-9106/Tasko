import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, WORKER_ID_KEY, WORKER_SESSION_TOKEN_KEY } from "../api";
import BrandLogo from "../components/landing/BrandLogo";

export default function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/workers/login", {
        identifier: identifier.trim(),
        password
      });

      const sessionToken = response.data?.sessionToken;
      const workerId = response.data?.worker?.workerId;

      if (!sessionToken || !workerId) {
        throw new Error("Invalid login response.");
      }

      localStorage.setItem(WORKER_SESSION_TOKEN_KEY, sessionToken);
      localStorage.setItem(WORKER_ID_KEY, workerId);
      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      setError(loginError?.response?.data?.message || "Worker login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="worker-shell auth-shell auth-login-shell">
        <aside className="auth-aside glass-card">
          <Link to="/" className="auth-home-link" aria-label="Back to home">
            <BrandLogo compact />
          </Link>
          <p className="auth-eyebrow">Employee Access</p>
          <h1>Tasko Worker Login</h1>
          <p>Login using your Employee ID or registered mobile number and the password shared by Tasko admin.</p>
          <ul className="auth-highlight-list">
            <li>Employee ID or mobile based login</li>
            <li>Admin-approved account activation</li>
            <li>Secure session-based access</li>
          </ul>
        </aside>

        <section className="auth-card glass-card auth-login-card">
          <header className="auth-card-head">
            <p className="section-eyebrow">Login</p>
            <h2>Employee Sign In</h2>
          </header>

          <form className="auth-fields" onSubmit={onSubmit}>
            <label className="auth-field">
              <span>Employee ID or Mobile Number</span>
              <input
                className="auth-input"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="TASKO-W-1001 or 9876543210"
                autoComplete="username"
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                className="auth-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <button type="submit" className="btn-luxury-primary btn-glow auth-submit-btn" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <p className="auth-footnote">
            New applicant?{" "}
            <Link to="/apply" className="auth-inline-link">
              Submit hiring application
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
