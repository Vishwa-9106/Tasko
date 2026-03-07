import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, WORKER_ID_KEY, WORKER_SESSION_TOKEN_KEY } from "../api";
import TaskoBrandMark from "../components/TaskoBrandMark";

export default function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="auth-page worker-auth-page">
      <header className="auth-nav">
        <div className="auth-shell auth-nav-row">
          <Link className="auth-brand" to="/" aria-label="Tasko worker home">
            <TaskoBrandMark className="auth-brand-mark auth-brand-mark-image" />
            <span className="auth-brand-text">TASKO</span>
          </Link>
          <nav className="auth-nav-links" aria-label="Worker navigation">
            <a href="/#categories">CATEGORIES</a>
            <a href="/#benefits">BENEFITS</a>
            <a href="/#standards">STANDARDS</a>
            <a href="/#stories">STORIES</a>
          </nav>
          <Link to="/apply" className="auth-nav-cta">
            APPLY NOW
          </Link>
        </div>
      </header>

      <section className="auth-section">
        <div className="auth-shell auth-grid">
          <div className="auth-copy">
            <p className="auth-copy-eyebrow">TASKO EMPLOYEE ACCESS</p>
            <h1>
              SIGN IN TO
              <span>YOUR WORKSPACE.</span>
            </h1>
            <p>Access your assignments, availability controls, and profile details with the credentials issued by Tasko.</p>
            <ul className="auth-copy-points">
              <li>EMPLOYEE ID OR MOBILE LOGIN</li>
              <li>ADMIN-APPROVED ACCESS</li>
              <li>SECURE SESSION WORKSPACE</li>
            </ul>
          </div>

          <div className="auth-panel">
            <p className="auth-panel-eyebrow">WORKER LOGIN</p>
            <h2>EMPLOYEE SIGN IN</h2>
            <form onSubmit={onSubmit} className="auth-form">
              <input
                className="auth-input"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Employee ID or mobile number"
                autoComplete="username"
                required
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input pr-20"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-900"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {error ? <p className="auth-error">{error}</p> : null}
              <button type="submit" className="auth-primary-btn" disabled={loading}>
                {loading ? "SIGNING IN..." : "LOGIN"}
              </button>
            </form>
            <div className="auth-divider-wrap">
              <span />
              <p>HIRING</p>
              <span />
            </div>
            <div className="worker-auth-support">
              <p>New to Tasko? Submit your hiring application before requesting credentials.</p>
              <Link to="/apply" className="auth-social-btn worker-auth-link-btn">
                START APPLICATION
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
