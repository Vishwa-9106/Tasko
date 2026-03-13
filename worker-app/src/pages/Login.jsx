import { useEffect, useState } from "react";
import { signInWithCustomToken, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, WORKER_ID_KEY } from "../api";
import TaskoBrandMark from "../components/TaskoBrandMark";
import { auth, initializeFirebaseClient, waitForInitialAuthSession } from "../firebase";

function getWorkerAuthErrorMessage(error) {
  const code = error?.code || "";
  const fallback = error?.response?.data?.message || error?.message || "Worker sign-in failed.";

  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "Invalid worker ID/email or password.";
  }
  if (code === "auth/user-disabled") {
    return "This worker account is disabled. Please contact Tasko admin.";
  }
  if (code === "auth/invalid-email") {
    return "Enter a valid login email.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection and retry.";
  }

  return fallback;
}

function isEmailIdentifier(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function resolveWorkerIdentifier(identifier) {
  const normalizedIdentifier = String(identifier || "").trim();
  if (!normalizedIdentifier) {
    throw new Error("Worker ID or login email is required.");
  }

  if (isEmailIdentifier(normalizedIdentifier)) {
    return {
      email: normalizedIdentifier.toLowerCase(),
      workerId: ""
    };
  }

  const workerId = normalizedIdentifier.toUpperCase();
  const response = await api.get(`/api/workers/${encodeURIComponent(workerId)}`);
  const worker = response.data || {};

  return {
    email: String(worker.email || "").trim().toLowerCase(),
    workerId: String(worker.worker_id || worker.id || workerId).trim().toUpperCase()
  };
}

function isFirebaseInvalidCredential(error) {
  const code = error?.code || "";
  return code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    waitForInitialAuthSession()
      .then((firebaseUser) => {
        if (active && firebaseUser) {
          navigate("/home", { replace: true });
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [navigate]);

  const successMessage =
    new URLSearchParams(location.search).get("reset") === "success"
      ? "Your password has been successfully updated. Please log in."
      : "";

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedIdentifier = identifier.trim();
      const data = await resolveWorkerIdentifier(normalizedIdentifier);

      if (!data?.email) {
        throw new Error("Worker login email could not be resolved.");
      }

      await initializeFirebaseClient();
      let credential;

      try {
        credential = await signInWithEmailAndPassword(auth, data.email, password);
      } catch (firebaseError) {
        if (!isFirebaseInvalidCredential(firebaseError)) {
          throw firebaseError;
        }

        const fallbackResponse = await api.post("/api/workers/auth/login", {
          identifier: normalizedIdentifier,
          password
        });
        const customToken = fallbackResponse.data?.customToken;
        if (!customToken) {
          throw new Error("Worker login failed.");
        }
        credential = await signInWithCustomToken(auth, customToken);
      }

      const idToken = await credential.user.getIdToken(true);
      const validateResponse = await api.post("/api/workers/session/validate", { idToken });
      const workerId = validateResponse.data?.worker?.workerId || data?.workerId;

      if (workerId) {
        localStorage.setItem(WORKER_ID_KEY, workerId);
      }
      navigate("/home", { replace: true });
    } catch (loginError) {
      if (auth) {
        await signOut(auth).catch(() => {});
      }
      setError(getWorkerAuthErrorMessage(loginError));
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
            <p>Access assigned jobs, live availability controls, and the worker execution flow with the credentials issued by Tasko.</p>
            <ul className="auth-copy-points">
              <li>WORKER ID OR EMAIL LOGIN</li>
              <li>ADMIN-APPROVED ACCESS</li>
              <li>FIREBASE-SECURED WORKSPACE</li>
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
                placeholder="Worker ID or login email"
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
              <div className="auth-helper-row">
                <span className="auth-helper-copy">Need to reset your password?</span>
                <Link to="/forgot-password" className="auth-inline-link">
                  Forgot Password?
                </Link>
              </div>
              {successMessage ? <p className="auth-success">{successMessage}</p> : null}
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
