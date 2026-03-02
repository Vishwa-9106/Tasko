import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, WORKER_ID_KEY, WORKER_SESSION_TOKEN_KEY } from "../api";
import BrandLogo from "../components/landing/BrandLogo";

const tabs = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "earnings", label: "My Earnings", href: "/my-earnings" },
  { id: "profile", label: "Profile", href: "/profile" }
];

function resolveDateTime(job) {
  if (!job?.date) return null;

  const withTime = job.time ? `${job.date} ${job.time}` : job.date;
  const parsed = new Date(withTime);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(job.date);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeDateKey(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function WorkerWorkspacePage({ activeTab }) {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const online = Boolean(worker?.online);
  const workerName = worker?.name || "Worker";
  const workerInitial = workerName.trim().charAt(0).toUpperCase() || "W";

  const clearWorkerSession = () => {
    localStorage.removeItem(WORKER_SESSION_TOKEN_KEY);
    localStorage.removeItem(WORKER_ID_KEY);
  };

  const loadWorkerWorkspace = useCallback(async () => {
    const sessionToken = localStorage.getItem(WORKER_SESSION_TOKEN_KEY);
    if (!sessionToken) {
      navigate("/login", { replace: true });
      return;
    }

    if (!worker) {
      setLoading(true);
    }
    setError("");

    try {
      const workerRequest = api.get("/api/workers/me");
      const jobsRequest = activeTab === "dashboard" ? api.get("/api/workers/my-jobs") : Promise.resolve(null);
      const [workerResponse, jobsResponse] = await Promise.all([workerRequest, jobsRequest]);
      const workerPayload = workerResponse.data;

      if (workerPayload.status !== "Active") {
        clearWorkerSession();
        navigate("/login", { replace: true });
        return;
      }

      if (workerPayload.worker_id) {
        localStorage.setItem(WORKER_ID_KEY, workerPayload.worker_id);
      }

      setWorker(workerPayload);
      if (jobsResponse) {
        setJobs(Array.isArray(jobsResponse.data) ? jobsResponse.data : []);
      }
    } catch (loadError) {
      if (loadError?.response?.status === 401 || loadError?.response?.status === 403) {
        clearWorkerSession();
        navigate("/login", { replace: true });
        return;
      }

      setError(loadError?.response?.data?.message || "Failed to load worker dashboard.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, navigate, worker]);

  useEffect(() => {
    loadWorkerWorkspace().catch(() => {});
  }, [loadWorkerWorkspace]);

  useEffect(() => {
    const sessionToken = localStorage.getItem(WORKER_SESSION_TOKEN_KEY);
    if (!sessionToken) return undefined;

    const poll = setInterval(() => {
      loadWorkerWorkspace().catch(() => {});
    }, 10000);

    return () => clearInterval(poll);
  }, [loadWorkerWorkspace]);

  const toggleOnlineStatus = async () => {
    if (!worker) return;

    const nextOnline = !online;
    setStatusUpdating(true);

    try {
      await api.patch("/api/workers/me/status", { online: nextOnline });
      setWorker((current) => (current ? { ...current, online: nextOnline } : current));
    } catch (toggleError) {
      setError(toggleError?.response?.data?.message || "Failed to update availability.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const logout = async () => {
    const sessionToken = localStorage.getItem(WORKER_SESSION_TOKEN_KEY);
    clearWorkerSession();
    if (sessionToken) {
      await api.post("/api/workers/logout", { sessionToken }).catch(() => {});
    }
    navigate("/login", { replace: true });
  };

  const assignedJobs = useMemo(
    () => jobs.filter((job) => !["completed", "cancelled"].includes(String(job.status || "").toLowerCase())),
    [jobs]
  );

  const upcomingJobs = useMemo(() => {
    const now = new Date();
    return assignedJobs
      .filter((job) => {
        const jobDate = resolveDateTime(job);
        return jobDate ? jobDate.getTime() >= now.getTime() : true;
      })
      .sort((left, right) => {
        const leftDate = resolveDateTime(left);
        const rightDate = resolveDateTime(right);
        if (!leftDate || !rightDate) return 0;
        return leftDate.getTime() - rightDate.getTime();
      })
      .slice(0, 4);
  }, [assignedJobs]);

  const dailyProgress = useMemo(() => {
    const todayKey = normalizeDateKey(new Date().toISOString());
    const todaysJobs = jobs.filter((job) => normalizeDateKey(job.date) === todayKey);
    const completedToday = todaysJobs.filter((job) => String(job.status || "").toLowerCase() === "completed").length;
    return {
      assigned: assignedJobs.length,
      upcoming: upcomingJobs.length,
      completedToday
    };
  }, [assignedJobs.length, jobs, upcomingJobs.length]);

  if (loading) {
    return (
      <div className="worker-console-shell">
        <div className="worker-shell worker-console-loading-card">
          <p className="section-eyebrow">Loading</p>
          <h2>Preparing your dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="worker-console-shell">
      <header className="worker-console-nav-wrap">
        <div className="worker-shell worker-console-nav">
          <Link to="/dashboard" className="worker-console-logo" aria-label="Tasko worker dashboard">
            <BrandLogo compact />
          </Link>

          <nav className="worker-console-menu" aria-label="Worker dashboard navigation">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={tab.href}
                className={`worker-console-menu-link ${activeTab === tab.id ? "is-active" : ""}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="worker-console-actions">
            <button
              type="button"
              className={`worker-availability-toggle ${online ? "is-online" : "is-offline"}`}
              onClick={toggleOnlineStatus}
              disabled={statusUpdating}
            >
              <span
                className={`worker-availability-dot ${online ? "is-online" : "is-offline"}`}
                aria-hidden="true"
              />
              {statusUpdating ? "Updating..." : online ? "Online" : "Offline"}
            </button>

            <div className="worker-profile-indicator" title={`${workerName} is ${online ? "online" : "offline"}`}>
              <span className={`worker-profile-status-dot ${online ? "is-online" : "is-offline"}`} aria-hidden="true" />
              <span className="worker-profile-avatar" aria-hidden="true">
                {workerInitial}
              </span>
            </div>

            <button type="button" className="worker-logout-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="worker-shell worker-console-main">
        <section className="worker-hero-panel">
          <p className="section-eyebrow">Worker Console</p>
          <h1>Welcome, {workerName}</h1>
          <p>Manage assignments, track your progress, and control availability from one premium workspace.</p>
          <div className="worker-meta-row">
            <span className="worker-meta-pill">Primary Category: {worker?.category || "-"}</span>
            <span className={`worker-meta-pill ${online ? "is-online" : "is-offline"}`}>
              Status: {online ? "Available for jobs" : "Unavailable"}
            </span>
          </div>
        </section>

        {error ? <p className="auth-error">{error}</p> : null}

        {activeTab === "dashboard" ? (
          <>
            <section className="worker-grid-metrics">
              <article className="worker-metric-card">
                <p>Assigned Jobs</p>
                <h3>{dailyProgress.assigned}</h3>
              </article>
              <article className="worker-metric-card">
                <p>Upcoming Jobs</p>
                <h3>{dailyProgress.upcoming}</h3>
              </article>
              <article className="worker-metric-card">
                <p>Completed Today</p>
                <h3>{dailyProgress.completedToday}</h3>
              </article>
            </section>

            <section className="worker-grid-panels">
              <article className="worker-data-card">
                <h2>Assigned Jobs</h2>
                {assignedJobs.length === 0 ? (
                  <p className="worker-empty-state">No assigned jobs yet.</p>
                ) : (
                  <div className="worker-job-list">
                    {assignedJobs.map((job) => (
                      <div key={job.id} className="worker-job-item">
                        <h3>{job.category || "Service Job"}</h3>
                        <p>
                          {job.date || "-"} {job.time ? `at ${job.time}` : ""}
                        </p>
                        <span className="worker-job-status">Status: {job.status || "assigned"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="worker-data-card">
                <h2>Upcoming Jobs</h2>
                {upcomingJobs.length === 0 ? (
                  <p className="worker-empty-state">No upcoming jobs in schedule.</p>
                ) : (
                  <div className="worker-job-list">
                    {upcomingJobs.map((job) => (
                      <div key={`${job.id}-upcoming`} className="worker-job-item">
                        <h3>{job.category || "Service Job"}</h3>
                        <p>
                          {job.date || "-"} {job.time ? `at ${job.time}` : ""}
                        </p>
                        <span className="worker-job-status">Priority: Upcoming</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </>
        ) : activeTab === "earnings" ? (
          <section className="worker-placeholder-card">
            <p className="section-eyebrow">My Earnings</p>
            <h2>Earnings dashboard is coming soon</h2>
            <p>This page is reserved for payout history, weekly summaries, and transaction insights.</p>
          </section>
        ) : (
          <section className="worker-placeholder-card">
            <p className="section-eyebrow">Profile</p>
            <h2>Profile management is coming soon</h2>
            <p>This page will include your professional details and account settings.</p>
          </section>
        )}
      </main>
    </div>
  );
}
