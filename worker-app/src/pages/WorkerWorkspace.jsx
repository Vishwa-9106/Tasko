import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, WORKER_ID_KEY, WORKER_SESSION_TOKEN_KEY } from "../api";
import TaskoBrandMark from "../components/TaskoBrandMark";

const tabs = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "earnings", label: "My Earnings", href: "/my-earnings" },
  { id: "profile", label: "Profile", href: "/profile" }
];

const workerDashboardPollIntervalMs = 60000;

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

function toStatusLabel(value) {
  const normalized = String(value || "assigned")
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase();

  if (!normalized) return "Assigned";

  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(value) {
  return String(value || "Worker")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatJobSlot(job) {
  const resolved = resolveDateTime(job);
  if (!resolved) {
    return [job?.date || "-", job?.time || "-"];
  }

  return [
    new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(resolved),
    job?.time ||
      new Intl.DateTimeFormat("en-IN", {
        timeStyle: "short"
      }).format(resolved)
  ];
}

export default function WorkerWorkspacePage({ activeTab }) {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const hasLoadedWorkspaceRef = useRef(false);

  const online = Boolean(worker?.online);
  const workerName = worker?.name || "Worker";
  const workerInitials = getInitials(workerName);

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

    if (!hasLoadedWorkspaceRef.current) {
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
      hasLoadedWorkspaceRef.current = true;
    }
  }, [activeTab, navigate]);

  useEffect(() => {
    loadWorkerWorkspace().catch(() => {});
  }, [loadWorkerWorkspace]);

  useEffect(() => {
    if (activeTab !== "dashboard") return undefined;
    const sessionToken = localStorage.getItem(WORKER_SESSION_TOKEN_KEY);
    if (!sessionToken) return undefined;

    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadWorkerWorkspace().catch(() => {});
    }, workerDashboardPollIntervalMs);

    return () => clearInterval(poll);
  }, [activeTab, loadWorkerWorkspace]);

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
      <div className="user-console-page landing-sync worker-sync-console">
        <main className="user-shell user-console-main">
          <section className="user-console-hero">
            <p className="user-console-eyebrow">Worker Console</p>
            <h1>Loading workspace</h1>
            <p>Preparing your assignments and profile data.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="user-console-page landing-sync worker-sync-console">
      <header className="user-console-nav-wrap">
        <div className="user-shell user-console-nav">
          <Link to="/dashboard" className="user-console-brand" aria-label="Tasko worker dashboard">
            <TaskoBrandMark />
            <span>TASKO</span>
          </Link>

          <nav className="user-console-menu" aria-label="Worker dashboard navigation">
            {tabs.map((tab) => (
              <Link key={tab.id} to={tab.href} className={`user-console-menu-link ${activeTab === tab.id ? "is-active" : ""}`}>
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="worker-sync-nav-actions">
            <button
              type="button"
              className={`worker-sync-status-btn${online ? " is-online" : ""}`}
              onClick={toggleOnlineStatus}
              disabled={statusUpdating}
            >
              <span className={`worker-sync-status-dot${online ? " is-online" : ""}`} aria-hidden="true" />
              {statusUpdating ? "Updating..." : online ? "Available" : "Offline"}
            </button>

            <button
              type="button"
              className="user-profile-icon-btn"
              onClick={() => navigate("/profile")}
              aria-label="Open worker profile"
              title="Profile"
            >
              <span className={`user-profile-icon-dot${online ? "" : " worker-sync-dot-offline"}`} aria-hidden="true" />
              <span className="user-profile-icon-text" aria-hidden="true">
                {workerInitials}
              </span>
            </button>

            <button type="button" className="user-btn secondary tasko-inline-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="user-shell user-console-main">
        <section className="user-console-hero">
          <p className="user-console-eyebrow">Worker Console</p>
          <h1>Welcome, {workerName}</h1>
          <p>Manage assignments, availability, and your worker account from the same Tasko dashboard system.</p>
          <div className="user-pill-tabs worker-sync-meta-tabs">
            <span className="user-pill-tab active">Primary Category: {worker?.category || "-"}</span>
            <span className={`user-pill-tab${online ? " active" : ""}`}>Status: {online ? "Available for jobs" : "Unavailable"}</span>
          </div>
        </section>

        {error ? <p className="user-empty worker-sync-error">{error}</p> : null}

        {activeTab === "dashboard" ? (
          <>
            <section className="sync-overview-grid">
              <article className="user-card sync-stat-card">
                <p className="sync-stat-label">Assigned Jobs</p>
                <h2>{dailyProgress.assigned}</h2>
                <p>Open jobs currently under your responsibility.</p>
              </article>
              <article className="user-card sync-stat-card">
                <p className="sync-stat-label">Upcoming Jobs</p>
                <h2>{dailyProgress.upcoming}</h2>
                <p>Scheduled tasks that are next in your queue.</p>
              </article>
              <article className="user-card sync-stat-card">
                <p className="sync-stat-label">Completed Today</p>
                <h2>{dailyProgress.completedToday}</h2>
                <p>Jobs marked completed on today&apos;s date.</p>
              </article>
            </section>

            <section className="worker-sync-panel-grid">
              <article className="user-card">
                <h2>Assigned Jobs</h2>
                {assignedJobs.length === 0 ? (
                  <p className="user-empty">No assigned jobs yet.</p>
                ) : (
                  <div className="user-list">
                    {assignedJobs.map((job) => {
                      const [dateLabel, timeLabel] = formatJobSlot(job);
                      return (
                        <article key={job.id} className="user-list-item sync-assignment-card">
                          <div className="user-list-item-head">
                            <h3>{job.category || "Service Job"}</h3>
                            <span className="user-status-tag">{toStatusLabel(job.status)}</span>
                          </div>
                          <div className="sync-meta-grid">
                            <p>
                              <strong>Date:</strong> {dateLabel}
                            </p>
                            <p>
                              <strong>Time:</strong> {timeLabel}
                            </p>
                            <p>
                              <strong>Job ID:</strong> {job.id || "-"}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </article>

              <article className="user-card">
                <h2>Upcoming Jobs</h2>
                {upcomingJobs.length === 0 ? (
                  <p className="user-empty">No upcoming jobs in your schedule.</p>
                ) : (
                  <div className="user-list">
                    {upcomingJobs.map((job) => {
                      const [dateLabel, timeLabel] = formatJobSlot(job);
                      return (
                        <article key={`${job.id}-upcoming`} className="user-list-item sync-assignment-card">
                          <div className="user-list-item-head">
                            <h3>{job.category || "Service Job"}</h3>
                            <span className="user-status-tag">Upcoming</span>
                          </div>
                          <div className="sync-meta-grid">
                            <p>
                              <strong>Date:</strong> {dateLabel}
                            </p>
                            <p>
                              <strong>Time:</strong> {timeLabel}
                            </p>
                            <p>
                              <strong>Status:</strong> {toStatusLabel(job.status)}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </article>
            </section>
          </>
        ) : activeTab === "earnings" ? (
          <section className="user-card">
            <h2>My Earnings</h2>
            <p>Earnings summaries, payout history, and weekly breakdowns will appear here.</p>
            <div className="user-list">
              <article className="user-list-item">
                <div className="user-list-item-head">
                  <h3>Upcoming payout tools</h3>
                  <span className="user-status-tag is-muted">Soon</span>
                </div>
                <p>Track transaction records and payout cycles in the same dashboard pattern used across Tasko.</p>
              </article>
            </div>
          </section>
        ) : (
          <section className="user-card">
            <h2>Profile</h2>
            <p>Professional details, worker account settings, and onboarding records will be managed here.</p>
            <div className="user-list">
              <article className="user-list-item">
                <div className="user-list-item-head">
                  <h3>Profile tools in progress</h3>
                  <span className="user-status-tag is-muted">Soon</span>
                </div>
                <p>Use the availability toggle above while the rest of profile management is being connected.</p>
              </article>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
