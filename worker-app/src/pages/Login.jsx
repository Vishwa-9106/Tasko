import { useState } from "react";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
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

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");
  const [error, setError] = useState("");

  const routeWorkerByStatus = async (uid, idToken) => {
    // Some environments can return 401 from token verification even after successful Firebase sign-in.
    // Do not block worker access on that specific backend token-check failure.
    try {
      await api.post("/api/auth/validate", { idToken, expectedRole: "worker" });
    } catch (validationError) {
      if (validationError?.response?.status !== 401) {
        throw validationError;
      }
    }

    const workerResponse = await api.get(`/api/workers/${uid}`);
    localStorage.setItem("tasko_worker_id", uid);

    if (workerResponse.data.status === "approved") {
      navigate("/dashboard");
      return;
    }

    navigate("/waiting");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const idToken = await credential.user.getIdToken();
      await routeWorkerByStatus(credential.user.uid, idToken);
    } catch (loginError) {
      setError(getFirebaseLoginErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (providerName) => {
    setError("");
    setSocialLoading(providerName);

    try {
      const provider =
        providerName === "google"
          ? (() => {
              const googleProvider = new GoogleAuthProvider();
              googleProvider.setCustomParameters({ prompt: "select_account" });
              return googleProvider;
            })()
          : (() => {
              const appleProvider = new OAuthProvider("apple.com");
              appleProvider.addScope("email");
              appleProvider.addScope("name");
              return appleProvider;
            })();

      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();
      await routeWorkerByStatus(credential.user.uid, idToken);
    } catch (socialError) {
      const isMissingWorker = socialError?.response?.status === 404;

      if (isMissingWorker) {
        setError("No worker account found for this social login. Please register as worker first.");
        await signOut(auth).catch(() => {});
      } else {
        setError(getFirebaseLoginErrorMessage(socialError));
      }
    } finally {
      setSocialLoading("");
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

            <button
              type="submit"
              className="btn-luxury-primary btn-glow auth-submit-btn"
              disabled={loading || socialLoading !== ""}
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="worker-auth-divider">
            <span />
            <p>OR CONTINUE WITH</p>
            <span />
          </div>

          <div className="worker-social-actions">
            <button
              type="button"
              className="worker-social-btn"
              onClick={() => handleSocialLogin("google")}
              disabled={loading || socialLoading !== ""}
            >
              {socialLoading === "google" ? "SIGNING IN..." : "CONTINUE WITH GOOGLE"}
            </button>
            <button
              type="button"
              className="worker-social-btn dark"
              onClick={() => handleSocialLogin("apple")}
              disabled={loading || socialLoading !== ""}
            >
              {socialLoading === "apple" ? "SIGNING IN..." : "CONTINUE WITH APPLE"}
            </button>
          </div>

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
