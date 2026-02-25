import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { api } from "../api";
import BrandLogo from "../components/landing/BrandLogo";

function getFirebaseLoginErrorMessage(error) {
  const code = error?.code || "";
  const fallback = error?.response?.data?.message || error?.message || "Login failed";

  if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
    return "Invalid email or password.";
  }
  if (code === "auth/wrong-password") {
    return "Invalid email or password.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please try again in a few minutes.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection and retry.";
  }

  return fallback;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const idToken = await credential.user.getIdToken();

      await api.post("/api/auth/validate", { idToken, expectedRole: "worker" });

      localStorage.setItem("tasko_worker_id", credential.user.uid);
      const workerResponse = await api.get(`/api/workers/${credential.user.uid}`);

      if (workerResponse.data.status === "approved") {
        navigate("/dashboard");
        return;
      }

      navigate("/waiting");
    } catch (loginError) {
      setError(getFirebaseLoginErrorMessage(loginError));
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
          <p className="auth-eyebrow">Worker Access</p>
          <h1>Welcome Back to Tasko</h1>
          <p>
            Login to manage your availability, check assignments, and track your approval and earnings journey.
          </p>
          <ul className="auth-highlight-list">
            <li>Weekly payout visibility</li>
            <li>Nearby assignment updates</li>
            <li>Real-time worker status controls</li>
          </ul>
        </aside>

        <section className="auth-card glass-card auth-login-card">
          <header className="auth-card-head">
            <p className="section-eyebrow">Login</p>
            <h2>Worker Sign In</h2>
          </header>

          <form className="auth-fields" onSubmit={onSubmit}>
            <label className="auth-field">
              <span>Email ID</span>
              <input
                type="email"
                className="auth-input"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                className="auth-input"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
            New worker?{" "}
            <Link to="/register" className="auth-inline-link">
              Start your application
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
