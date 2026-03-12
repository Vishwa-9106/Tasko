import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { api, WORKER_ID_KEY, WORKER_SESSION_TOKEN_KEY } from "../api";
import TaskoBrandMark from "../components/TaskoBrandMark";

const sections = [
  { id: "home", label: "Home", href: "/home" },
  { id: "jobs", label: "Jobs", href: "/jobs" },
  { id: "progress", label: "Progress", href: "/progress" }
];

const workerWorkspacePollIntervalMs = 15000;
const workerJobCheckpointsKey = "tasko_worker_job_checkpoints";

function readText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (typeof value === "string") {
    const fromString = new Date(value);
    return Number.isNaN(fromString.getTime()) ? null : fromString;
  }
  if (typeof value === "object") {
    const seconds =
      typeof value.seconds === "number"
        ? value.seconds
        : typeof value._seconds === "number"
          ? value._seconds
          : null;
    if (seconds !== null) {
      const fromSeconds = new Date(seconds * 1000);
      return Number.isNaN(fromSeconds.getTime()) ? null : fromSeconds;
    }
  }
  return null;
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

function normalizeStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (!normalized || normalized === "pending") return "assigned";
  return normalized;
}

function formatStatusLabel(value) {
  const normalized = String(value || "assigned");
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getJobDate(job) {
  return readText(job?.date) || readText(job?.serviceDate) || readText(job?.bookingDate) || readText(job?.booking_date) || "";
}

function getJobTime(job) {
  return readText(job?.time) || readText(job?.preferredTimeSlot) || readText(job?.timeSlot) || readText(job?.time_slot) || "";
}

function resolveJobDateTime(job) {
  const dateValue = getJobDate(job);
  const timeValue = getJobTime(job);

  if (dateValue) {
    const withTime = timeValue ? new Date(`${dateValue} ${timeValue}`) : new Date(dateValue);
    if (!Number.isNaN(withTime.getTime())) return withTime;
  }

  return (
    readDate(job?.scheduledAt) ||
    readDate(job?.updatedAt) ||
    readDate(job?.updated_at) ||
    readDate(job?.createdAt) ||
    readDate(job?.created_at) ||
    null
  );
}

function normalizeDateKey(value) {
  const parsed = readDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
}

function formatDate(value, options = { dateStyle: "medium" }) {
  const parsed = readDate(value);
  if (!parsed) return "-";
  return new Intl.DateTimeFormat("en-IN", options).format(parsed);
}

function formatDateTime(job) {
  const dateValue = resolveJobDateTime(job);
  const timeValue = getJobTime(job);

  if (!dateValue) {
    return [getJobDate(job) || "-", timeValue || "-"];
  }

  return [
    formatDate(dateValue, { weekday: "short", day: "numeric", month: "short" }),
    timeValue || new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(dateValue)
  ];
}

function getCustomerName(job) {
  return readText(job?.userName) || readText(job?.user_name) || readText(job?.customerName) || "Customer";
}

function getCustomerPhone(job) {
  return readText(job?.userPhone) || readText(job?.user_phone) || readText(job?.customerPhone) || "";
}

function getJobBookingType(job) {
  const explicitType = readText(job?.bookingType) || readText(job?.booking_type);
  if (explicitType.toLowerCase() === "package") return "package";
  return String(job?.id || "").startsWith("package-") ? "package" : "service";
}

function getJobActionId(job) {
  const scheduleId = readText(job?.scheduleId) || readText(job?.schedule_id);
  if (scheduleId) return scheduleId;
  return String(job?.id || "").replace(/^package-/, "");
}

function getServiceName(job) {
  return (
    readText(job?.serviceName) ||
    readText(job?.subCategory) ||
    readText(job?.sub_category) ||
    readText(job?.category) ||
    readText(job?.serviceCategory) ||
    "Service Job"
  );
}

function getServiceCategory(job) {
  return (
    readText(job?.serviceCategory) ||
    readText(job?.service_category) ||
    readText(job?.category) ||
    readText(job?.serviceName) ||
    "General Service"
  );
}

function getAddress(job) {
  return readText(job?.address) || readText(job?.serviceAddress) || readText(job?.service_address) || "Address pending";
}

function getInstructions(job) {
  return (
    readText(job?.specialInstructions) ||
    readText(job?.special_instructions) ||
    readText(job?.notes) ||
    readText(job?.workDescription) ||
    readText(job?.work_description) ||
    "No special instructions provided."
  );
}

function getMapHref(job) {
  const address = getAddress(job);
  if (!address || address === "Address pending") return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getRating(job) {
  const candidates = [job?.rating, job?.customerRating, job?.customer_rating, job?.reviewRating, job?.review_rating];
  const value = candidates.find((entry) => Number.isFinite(Number(entry)));
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function sanitizeOtp(value) {
  return String(value || "").replace(/\s+/g, "");
}

function getExpectedOtp(job, kind) {
  const keys =
    kind === "start"
      ? ["startOtp", "start_otp", "jobStartOtp", "job_start_otp", "serviceStartOtp"]
      : ["completionOtp", "completion_otp", "jobCompletionOtp", "job_completion_otp", "serviceCompletionOtp"];

  const match = keys.find((key) => readText(job?.[key]));
  return match ? readText(job?.[match]) : "";
}

function hasArrivalRecord(job) {
  return Boolean(readDate(job?.workerArrivedAt) || readDate(job?.worker_arrived_at));
}

function hasCompletionOtpRequested(job) {
  return Boolean(
    readDate(job?.completionOtpRequestedAt) ||
      readDate(job?.completion_otp_requested_at) ||
      readText(job?.completionOtp) ||
      readText(job?.completion_otp)
  );
}

function sortBySchedule(left, right) {
  const leftDate = resolveJobDateTime(left);
  const rightDate = resolveJobDateTime(right);
  if (!leftDate && !rightDate) return 0;
  if (!leftDate) return 1;
  if (!rightDate) return -1;
  return leftDate.getTime() - rightDate.getTime();
}

function readStoredCheckpoints() {
  try {
    const stored = localStorage.getItem(workerJobCheckpointsKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredCheckpoints(value) {
  localStorage.setItem(workerJobCheckpointsKey, JSON.stringify(value));
}

function SummaryCard({ label, value, hint }) {
  return (
    <article className="worker-flow-stat-card">
      <p className="worker-flow-stat-label">{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}

function EmptyState({ title, copy, action }) {
  return (
    <article className="worker-flow-empty">
      <h3>{title}</h3>
      <p>{copy}</p>
      {action || null}
    </article>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="worker-flow-info-row">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function WorkerWorkspacePage({ section, jobId = "" }) {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [activeJobTab, setActiveJobTab] = useState("upcoming");
  const [jobActionLoading, setJobActionLoading] = useState("");
  const [jobActionError, setJobActionError] = useState("");
  const [jobActionMessage, setJobActionMessage] = useState("");
  const [otpDrafts, setOtpDrafts] = useState({});
  const [storedCheckpoints, setStoredCheckpoints] = useState(() => readStoredCheckpoints());
  const hasLoadedWorkspaceRef = useRef(false);

  const workerId = worker?.worker_id || worker?.id || localStorage.getItem(WORKER_ID_KEY) || "default";
  const workerCheckpoints = storedCheckpoints?.[workerId] || {};
  const online = Boolean(worker?.online);
  const workerName = worker?.name || worker?.full_name || "Worker";
  const workerInitials = getInitials(workerName);

  const persistCheckpointUpdate = useCallback((updater) => {
    setStoredCheckpoints((current) => {
      const next = updater(current);
      writeStoredCheckpoints(next);
      return next;
    });
  }, []);

  const clearWorkerSession = useCallback(() => {
    localStorage.removeItem(WORKER_SESSION_TOKEN_KEY);
    localStorage.removeItem(WORKER_ID_KEY);
  }, []);

  const loadWorkerWorkspace = useCallback(
    async ({ showLoader = false } = {}) => {
      const sessionToken = localStorage.getItem(WORKER_SESSION_TOKEN_KEY);
      if (!sessionToken) {
        navigate("/login", { replace: true });
        return;
      }

      if (showLoader || !hasLoadedWorkspaceRef.current) {
        setLoading(true);
      }
      setError("");

      try {
        const [workerResult, jobsResult, packageJobsResult] = await Promise.allSettled([
          api.get("/api/workers/me"),
          api.get("/api/workers/my-jobs"),
          api.get("/api/workers/my-package-jobs")
        ]);

        if (workerResult.status !== "fulfilled") {
          throw workerResult.reason;
        }

        const workerPayload = workerResult.value.data;
        const serviceJobs = jobsResult.status === "fulfilled" && Array.isArray(jobsResult.value.data) ? jobsResult.value.data : [];
        const packageJobs =
          packageJobsResult.status === "fulfilled" && Array.isArray(packageJobsResult.value.data) ? packageJobsResult.value.data : [];

        if (workerPayload.status !== "Active") {
          clearWorkerSession();
          navigate("/login", { replace: true });
          return;
        }

        if (workerPayload.worker_id) {
          localStorage.setItem(WORKER_ID_KEY, workerPayload.worker_id);
        }

        setWorker(workerPayload);
        setJobs([...serviceJobs, ...packageJobs]);
      } catch (loadError) {
        if (loadError?.response?.status === 401 || loadError?.response?.status === 403) {
          clearWorkerSession();
          navigate("/login", { replace: true });
          return;
        }

        setError(loadError?.response?.data?.message || "Failed to load worker workspace.");
      } finally {
        setLoading(false);
        hasLoadedWorkspaceRef.current = true;
      }
    },
    [clearWorkerSession, navigate]
  );

  useEffect(() => {
    loadWorkerWorkspace({ showLoader: true }).catch(() => {});
  }, [loadWorkerWorkspace]);

  useEffect(() => {
    const sessionToken = localStorage.getItem(WORKER_SESSION_TOKEN_KEY);
    if (!sessionToken) return undefined;

    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadWorkerWorkspace().catch(() => {});
    }, workerWorkspacePollIntervalMs);

    return () => clearInterval(poll);
  }, [loadWorkerWorkspace]);

  const toggleOnlineStatus = async () => {
    if (!worker) return;

    const nextOnline = !online;
    setStatusUpdating(true);
    setError("");

    try {
      await api.patch("/api/workers/me/status", { online: nextOnline });
      setWorker((current) => (current ? { ...current, online: nextOnline } : current));
    } catch (toggleError) {
      setError(toggleError?.response?.data?.message || "Failed to update worker availability.");
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

  const getFlowStatus = useCallback(
    (job) => {
      const serverStatus = normalizeStatus(job?.status);
      if (serverStatus === "completed") return "completed";
      if (serverStatus === "in_progress") return "in_progress";
      if (serverStatus === "cancelled") return "cancelled";
      if (hasArrivalRecord(job)) return "arrived";
      if (workerCheckpoints?.[job.id]?.arrivedAt) return "arrived";
      return "assigned";
    },
    [workerCheckpoints]
  );

  const upcomingJobs = useMemo(
    () =>
      jobs
        .filter((job) => {
          const status = normalizeStatus(job?.status);
          return !["in_progress", "completed", "cancelled"].includes(status);
        })
        .sort(sortBySchedule),
    [jobs]
  );

  const inProgressJobs = useMemo(
    () => jobs.filter((job) => normalizeStatus(job?.status) === "in_progress").sort(sortBySchedule),
    [jobs]
  );

  const completedJobs = useMemo(
    () =>
      jobs
        .filter((job) => normalizeStatus(job?.status) === "completed")
        .sort((left, right) => sortBySchedule(right, left)),
    [jobs]
  );

  const todayKey = normalizeDateKey(new Date());

  const todayJobsCount = useMemo(
    () => jobs.filter((job) => normalizeDateKey(resolveJobDateTime(job) || getJobDate(job)) === todayKey).length,
    [jobs, todayKey]
  );

  const pendingJobsToday = useMemo(
    () =>
      jobs.filter((job) => {
        const status = normalizeStatus(job?.status);
        return normalizeDateKey(resolveJobDateTime(job) || getJobDate(job)) === todayKey && !["completed", "cancelled"].includes(status);
      }).length,
    [jobs, todayKey]
  );

  const nextAssignedJob = upcomingJobs[0] || null;

  const averageRating = useMemo(() => {
    const completedRatings = completedJobs.map(getRating).filter((value) => value !== null);
    if (completedRatings.length > 0) {
      const total = completedRatings.reduce((sum, value) => sum + value, 0);
      return (total / completedRatings.length).toFixed(1);
    }
    if (Number.isFinite(Number(worker?.rating)) && Number(worker?.rating) > 0) {
      return Number(worker.rating).toFixed(1);
    }
    return "--";
  }, [completedJobs, worker?.rating]);

  const completionRate = useMemo(() => {
    const trackedJobs = jobs.filter((job) => normalizeStatus(job?.status) !== "cancelled").length;
    if (!trackedJobs) return "0%";
    return `${Math.round((completedJobs.length / trackedJobs) * 100)}%`;
  }, [completedJobs.length, jobs]);

  const weeklyJobCount = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - 6);

    return jobs.filter((job) => {
      const jobDate = resolveJobDateTime(job);
      return jobDate ? jobDate >= weekStart && jobDate <= now : false;
    }).length;
  }, [jobs]);

  const selectedJob = useMemo(() => jobs.find((job) => String(job.id) === String(jobId)) || null, [jobId, jobs]);

  const updateOtpDraft = (targetJobId, kind, value) => {
    setOtpDrafts((current) => ({
      ...current,
      [targetJobId]: {
        ...current[targetJobId],
        [kind]: value
      }
    }));
  };

  const setJobCheckpoint = (targetJobId, patch) => {
    persistCheckpointUpdate((current) => {
      const nextWorkerCheckpoints = {
        ...(current?.[workerId] || {}),
        [targetJobId]: {
          ...((current?.[workerId] || {})[targetJobId] || {}),
          ...patch
        }
      };

      return {
        ...current,
        [workerId]: nextWorkerCheckpoints
      };
    });
  };

  const updateJobStatus = async (targetJob, nextStatus, otpKind) => {
    const enteredOtp = sanitizeOtp(otpDrafts?.[targetJob.id]?.[otpKind]);
    const expectedOtp = sanitizeOtp(getExpectedOtp(targetJob, otpKind));

    if (!enteredOtp) {
      setJobActionError("Enter the OTP shared by the customer.");
      setJobActionMessage("");
      return;
    }

    if (expectedOtp && enteredOtp !== expectedOtp) {
      setJobActionError("The entered OTP does not match the booking record.");
      setJobActionMessage("");
      return;
    }

    if (!expectedOtp && enteredOtp.length < 4) {
      setJobActionError("Enter a valid OTP to continue.");
      setJobActionMessage("");
      return;
    }

    setJobActionLoading(targetJob.id);
    setJobActionError("");
    setJobActionMessage("");

    try {
      if (getJobBookingType(targetJob) === "package") {
        await api.patch(`/api/workers/my-package-jobs/${getJobActionId(targetJob)}/status`, { status: nextStatus });
      } else {
        await api.patch(`/api/bookings/${targetJob.id}/status`, { status: nextStatus });
      }
      setJobs((current) =>
        current.map((job) => (job.id === targetJob.id ? { ...job, status: nextStatus, updatedAt: new Date().toISOString() } : job))
      );

      if (nextStatus === "in_progress") {
        setJobCheckpoint(targetJob.id, { startedAt: new Date().toISOString() });
        setJobActionMessage("Job is now in progress.");
      } else if (nextStatus === "completed") {
        setJobCheckpoint(targetJob.id, { completedAt: new Date().toISOString() });
        setJobActionMessage("Job marked as completed.");
      }

      setOtpDrafts((current) => ({
        ...current,
        [targetJob.id]: {
          ...current[targetJob.id],
          [otpKind]: ""
        }
      }));

      loadWorkerWorkspace().catch(() => {});
    } catch (actionError) {
      setJobActionError(actionError?.response?.data?.message || "Failed to update job status.");
    } finally {
      setJobActionLoading("");
    }
  };

  const markArrived = async (targetJobId) => {
    const targetJob = jobs.find((job) => job.id === targetJobId);
    setJobActionLoading(targetJobId);
    setJobActionError("");
    setJobActionMessage("");

    try {
      const response =
        getJobBookingType(targetJob) === "package"
          ? await api.post(`/api/workers/my-package-jobs/${getJobActionId(targetJob)}/arrived`)
          : await api.post(`/api/workers/my-jobs/${targetJobId}/arrived`);
      const arrivalPayload = response?.data?.schedule || response?.data || {};

      setJobCheckpoint(targetJobId, {
        arrivedAt: arrivalPayload.workerArrivedAt || new Date().toISOString()
      });
      setJobs((current) =>
        current.map((job) =>
          job.id === targetJobId
            ? {
                ...job,
                ...arrivalPayload,
                id: targetJobId,
                bookingId: targetJobId,
                booking_id: targetJobId,
                scheduleId: getJobActionId(targetJob),
                updatedAt: new Date().toISOString()
              }
            : job
        )
      );
      setJobActionMessage("Arrival recorded. The customer can now view the start OTP in the user app.");
      loadWorkerWorkspace().catch(() => {});
    } catch (arrivalError) {
      setJobActionError(arrivalError?.response?.data?.message || "Failed to record arrival.");
    } finally {
      setJobActionLoading("");
    }
  };

  const requestCompletionOtp = async (targetJobId) => {
    const targetJob = jobs.find((job) => job.id === targetJobId);
    setJobActionLoading(targetJobId);
    setJobActionError("");
    setJobActionMessage("");

    try {
      const response =
        getJobBookingType(targetJob) === "package"
          ? await api.post(`/api/workers/my-package-jobs/${getJobActionId(targetJob)}/request-completion-otp`)
          : await api.post(`/api/workers/my-jobs/${targetJobId}/request-completion-otp`);
      const completionPayload = response?.data?.schedule || response?.data || {};

      setJobs((current) =>
        current.map((job) =>
          job.id === targetJobId
            ? {
                ...job,
                ...completionPayload,
                id: targetJobId,
                bookingId: targetJobId,
                booking_id: targetJobId,
                scheduleId: getJobActionId(targetJob),
                updatedAt: new Date().toISOString()
              }
            : job
        )
      );
      setJobActionMessage("Completion OTP sent. Ask the customer to check the popup or notification page.");
      loadWorkerWorkspace().catch(() => {});
    } catch (completionError) {
      setJobActionError(completionError?.response?.data?.message || "Failed to request completion OTP.");
    } finally {
      setJobActionLoading("");
    }
  };

  const renderJobCard = (job, variant = "upcoming") => {
    const [dateLabel, timeLabel] = formatDateTime(job);
    const flowStatus = getFlowStatus(job);
    const phone = getCustomerPhone(job);
    const mapHref = getMapHref(job);
    const rating = getRating(job);
    const startedAt = workerCheckpoints?.[job.id]?.startedAt;

    return (
      <article key={`${variant}-${job.id}`} className="worker-flow-job-card">
        <div className="worker-flow-job-top">
          <div>
            <p className="worker-flow-job-service">{getServiceName(job)}</p>
            <h3>{getCustomerName(job)}</h3>
          </div>
          <span className={`worker-flow-status worker-flow-status-${flowStatus}`}>{formatStatusLabel(flowStatus)}</span>
        </div>

        <div className="worker-flow-job-meta">
          {variant === "completed" ? (
            <>
              <InfoRow label="Date" value={dateLabel} />
              <InfoRow label="Rating" value={rating !== null ? `${rating.toFixed(1)} / 5` : "Not rated yet"} />
            </>
          ) : variant === "inProgress" ? (
            <>
              <InfoRow
                label="Start Time"
                value={startedAt ? formatDate(startedAt, { timeStyle: "short", dateStyle: "medium" }) : `${dateLabel}, ${timeLabel}`}
              />
              <InfoRow label="Phone" value={phone || "-"} />
            </>
          ) : (
            <>
              <InfoRow label="Date & Time" value={`${dateLabel}, ${timeLabel}`} />
              <InfoRow label="Address" value={getAddress(job)} />
            </>
          )}
        </div>

        <div className="worker-flow-job-actions">
          {variant === "upcoming" ? (
            <Link to={`/jobs/${job.id}`} className="worker-flow-btn worker-flow-btn-secondary">
              View Job Details
            </Link>
          ) : variant === "inProgress" ? (
            <Link to={`/jobs/${job.id}`} className="worker-flow-btn worker-flow-btn-primary">
              Complete Job
            </Link>
          ) : null}

          {variant !== "completed" && mapHref ? (
            <a href={mapHref} target="_blank" rel="noreferrer" className="worker-flow-btn worker-flow-btn-ghost">
              Navigate
            </a>
          ) : null}
        </div>
      </article>
    );
  };

  const renderHomeSection = () => {
    const summaryCards = [
      { label: "Today's Jobs", value: todayJobsCount, hint: "Scheduled for the current day" },
      { label: "Completed Jobs", value: completedJobs.length, hint: "Finished across your current list" },
      { label: "Pending Jobs", value: upcomingJobs.length, hint: "Assigned and waiting to start" },
      { label: "Worker Rating", value: averageRating === "--" ? "New" : averageRating, hint: "Live service quality snapshot" }
    ];

    return (
      <div className="worker-flow-section-stack">
        <section className="worker-flow-hero-card">
          <div>
            <p className="worker-flow-eyebrow">Worker Home</p>
            <h1>Hello, {workerName}</h1>
            <p>Stay on top of the next job, switch availability instantly, and keep the task flow moving in real time.</p>
          </div>
          <div className="worker-flow-hero-actions">
            <button
              type="button"
              className={`worker-flow-toggle${online ? " is-online" : ""}`}
              onClick={toggleOnlineStatus}
              disabled={statusUpdating}
            >
              <span className="worker-flow-toggle-track">
                <span className="worker-flow-toggle-thumb" />
              </span>
              <span>{statusUpdating ? "Updating..." : online ? "Online" : "Offline"}</span>
            </button>
            <p className="worker-flow-refresh-note">Auto-refresh every 15 seconds while this screen is open.</p>
          </div>
        </section>

        <section className="worker-flow-stats-grid">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
          ))}
        </section>

        <section className="worker-flow-focus-card">
          <div className="worker-flow-focus-head">
            <div>
              <p className="worker-flow-eyebrow">Next Assigned Job</p>
              <h2>Keep the next stop visible</h2>
            </div>
            <Link to="/jobs" className="worker-flow-text-link">
              View all jobs
            </Link>
          </div>

          {nextAssignedJob ? (
            <div className="worker-flow-next-job">
              <div className="worker-flow-next-job-main">
                <div>
                  <p className="worker-flow-job-service">{getServiceName(nextAssignedJob)}</p>
                  <h3>{getCustomerName(nextAssignedJob)}</h3>
                </div>
                <span className={`worker-flow-status worker-flow-status-${getFlowStatus(nextAssignedJob)}`}>
                  {formatStatusLabel(getFlowStatus(nextAssignedJob))}
                </span>
              </div>

              <div className="worker-flow-next-job-grid">
                <InfoRow label="Scheduled Time" value={formatDateTime(nextAssignedJob).join(", ")} />
                <InfoRow label="Location" value={getAddress(nextAssignedJob)} />
                <InfoRow label="Phone" value={getCustomerPhone(nextAssignedJob) || "-"} />
                <InfoRow label="Category" value={getServiceCategory(nextAssignedJob)} />
              </div>

              <div className="worker-flow-job-actions">
                <Link to={`/jobs/${nextAssignedJob.id}`} className="worker-flow-btn worker-flow-btn-primary">
                  View Job Details
                </Link>
                {getMapHref(nextAssignedJob) ? (
                  <a href={getMapHref(nextAssignedJob)} target="_blank" rel="noreferrer" className="worker-flow-btn worker-flow-btn-secondary">
                    Navigate to Location
                  </a>
                ) : (
                  <button type="button" className="worker-flow-btn worker-flow-btn-secondary is-disabled" disabled>
                    Navigate to Location
                  </button>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No assigned jobs right now"
              copy="When new work is assigned, it will appear here first so the worker can move straight into execution."
              action={
                <Link to="/jobs" className="worker-flow-btn worker-flow-btn-secondary">
                  Open Jobs
                </Link>
              }
            />
          )}
        </section>
      </div>
    );
  };

  const renderJobsSection = () => {
    const tabs = [
      { id: "upcoming", label: "Upcoming", count: upcomingJobs.length },
      { id: "inProgress", label: "In Progress", count: inProgressJobs.length },
      { id: "completed", label: "Completed", count: completedJobs.length }
    ];

    const activeJobs =
      activeJobTab === "inProgress" ? inProgressJobs : activeJobTab === "completed" ? completedJobs : upcomingJobs;

    return (
      <div className="worker-flow-section-stack">
        <section className="worker-flow-panel">
          <div className="worker-flow-panel-head">
            <div>
              <p className="worker-flow-eyebrow">Jobs</p>
              <h1>Track each assigned task</h1>
              <p>Use the tabs to move from assigned jobs to active work and finished history without leaving the main flow.</p>
            </div>
          </div>

          <div className="worker-flow-tabs" role="tablist" aria-label="Worker jobs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`worker-flow-tab${activeJobTab === tab.id ? " is-active" : ""}`}
                onClick={() => setActiveJobTab(tab.id)}
              >
                <span>{tab.label}</span>
                <strong>{tab.count}</strong>
              </button>
            ))}
          </div>
        </section>

        {activeJobs.length === 0 ? (
          <EmptyState
            title={`No ${tabs.find((tab) => tab.id === activeJobTab)?.label.toLowerCase()} jobs`}
            copy="The list updates automatically when job status changes or new assignments arrive."
          />
        ) : (
          <section className="worker-flow-job-list">
            {activeJobs.map((job) =>
              renderJobCard(job, activeJobTab === "inProgress" ? "inProgress" : activeJobTab === "completed" ? "completed" : "upcoming")
            )}
          </section>
        )}
      </div>
    );
  };

  const renderProgressSection = () => {
    const metrics = [
      { label: "Total Jobs Completed", value: completedJobs.length, hint: "Finished tasks in the current dataset" },
      { label: "Average Rating", value: averageRating === "--" ? "New" : `${averageRating} / 5`, hint: "Based on worker and completed job ratings" },
      { label: "Completion Rate", value: completionRate, hint: "Completed vs. active tracked jobs" },
      { label: "Weekly Job Count", value: weeklyJobCount, hint: "Jobs scheduled in the last 7 days" },
      { label: "Pending Jobs Today", value: pendingJobsToday, hint: "Still open on today's schedule" }
    ];

    return (
      <div className="worker-flow-section-stack">
        <section className="worker-flow-panel">
          <div className="worker-flow-panel-head">
            <div>
              <p className="worker-flow-eyebrow">Progress</p>
              <h1>Performance snapshot</h1>
              <p>Keep the worker performance picture visible without mixing it into profile or earnings pages.</p>
            </div>
          </div>
        </section>

        <section className="worker-flow-progress-grid">
          {metrics.map((metric) => (
            <SummaryCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
          ))}
        </section>
      </div>
    );
  };

  const renderProfileSection = () => {
    const profileFields = [
      { label: "Full Name", value: worker?.full_name || worker?.name || "-" },
      { label: "Email ID", value: worker?.email || "Not available" },
      { label: "Phone Number", value: worker?.phone || "Not available" },
      { label: "Selected Category", value: worker?.category || "-" },
      { label: "Worker ID", value: worker?.worker_id || worker?.id || "-" },
      { label: "Account Status", value: worker?.status || "-" },
      { label: "Joining Date", value: worker?.joining_date ? formatDate(worker.joining_date) : "-" },
      { label: "Availability", value: online ? "Online" : "Offline" }
    ];

    const quickStats = [
      { label: "Completed Jobs", value: completedJobs.length, hint: "Jobs finished so far" },
      { label: "Pending Jobs", value: upcomingJobs.length, hint: "Assigned and waiting to start" },
      { label: "Today's Jobs", value: todayJobsCount, hint: "Scheduled for today" },
      { label: "Average Rating", value: averageRating === "--" ? "New" : averageRating, hint: "Current worker rating" }
    ];

    return (
      <div className="worker-flow-section-stack">
        <section className="worker-flow-panel">
          <div className="worker-flow-panel-head">
            <div>
              <p className="worker-flow-eyebrow">Profile</p>
              <h1>Worker account details</h1>
              <p>Review the main profile information used in the worker app and keep the basic identity details visible in one place.</p>
            </div>
            <Link to="/home" className="worker-flow-text-link">
              Back to Home
            </Link>
          </div>
        </section>

        <section className="worker-flow-detail-grid">
          <article className="worker-flow-detail-card">
            <div className="worker-flow-profile-head">
              <div className="worker-flow-profile-avatar">{workerInitials}</div>
              <div>
                <p className="worker-flow-job-service">{worker?.category || "Worker"}</p>
                <h2>{workerName}</h2>
                <p>{worker?.email || "No email available"}</p>
              </div>
            </div>

            <div className="worker-flow-detail-rows">
              {profileFields.map((item) => (
                <InfoRow key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </article>

          <article className="worker-flow-detail-card">
            <div className="worker-flow-workflow-head">
              <p className="worker-flow-eyebrow">Quick Overview</p>
              <h2>Current worker snapshot</h2>
            </div>

            <div className="worker-flow-profile-summary">
              {quickStats.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
              ))}
            </div>
          </article>
        </section>
      </div>
    );
  };

  const renderJobDetailsSection = () => {
    if (!selectedJob) {
      return (
        <EmptyState
          title="Job not found"
          copy="The selected job is not available in the current worker assignment list."
          action={
            <Link to="/jobs" className="worker-flow-btn worker-flow-btn-secondary">
              Back to Jobs
            </Link>
          }
        />
      );
    }

    const flowStatus = getFlowStatus(selectedJob);
    const phone = getCustomerPhone(selectedJob);
    const mapHref = getMapHref(selectedJob);
    const [dateLabel, timeLabel] = formatDateTime(selectedJob);
    const actionInFlight = jobActionLoading === selectedJob.id;
    const completionOtpRequested = hasCompletionOtpRequested(selectedJob);

    return (
      <div className="worker-flow-section-stack">
        <section className="worker-flow-panel">
          <div className="worker-flow-panel-head">
            <div>
              <p className="worker-flow-eyebrow">Job Details</p>
              <h1>{getServiceName(selectedJob)}</h1>
              <p>Follow the worker execution path from arrival to completion without leaving the job screen.</p>
            </div>
            <Link to="/jobs" className="worker-flow-text-link">
              Back to Jobs
            </Link>
          </div>
        </section>

        <section className="worker-flow-detail-grid">
          <article className="worker-flow-detail-card">
            <div className="worker-flow-job-top">
              <div>
                <p className="worker-flow-job-service">{getServiceCategory(selectedJob)}</p>
                <h2>{getCustomerName(selectedJob)}</h2>
              </div>
              <span className={`worker-flow-status worker-flow-status-${flowStatus}`}>{formatStatusLabel(flowStatus)}</span>
            </div>

            <div className="worker-flow-detail-rows">
              <InfoRow label="Customer Name" value={getCustomerName(selectedJob)} />
              <InfoRow label="Phone Number" value={phone || "-"} />
              <InfoRow label="Service Category" value={getServiceCategory(selectedJob)} />
              <InfoRow label="Address" value={getAddress(selectedJob)} />
              <InfoRow label="Scheduled Time" value={`${dateLabel}, ${timeLabel}`} />
              <InfoRow label="Special Instructions" value={getInstructions(selectedJob)} />
            </div>

            <div className="worker-flow-detail-actions">
              {phone ? (
                <a href={`tel:${phone}`} className="worker-flow-btn worker-flow-btn-primary">
                  Call Customer
                </a>
              ) : (
                <button type="button" className="worker-flow-btn worker-flow-btn-primary is-disabled" disabled>
                  Call Customer
                </button>
              )}

              {mapHref ? (
                <a href={mapHref} target="_blank" rel="noreferrer" className="worker-flow-btn worker-flow-btn-secondary">
                  Open Map / Navigation
                </a>
              ) : (
                <button type="button" className="worker-flow-btn worker-flow-btn-secondary is-disabled" disabled>
                  Open Map / Navigation
                </button>
              )}

              {flowStatus === "assigned" ? (
                <button type="button" className="worker-flow-btn worker-flow-btn-ghost" onClick={() => markArrived(selectedJob.id)}>
                  I Arrived
                </button>
              ) : (
                <button type="button" className="worker-flow-btn worker-flow-btn-ghost is-disabled" disabled>
                  I Arrived
                </button>
              )}
            </div>
          </article>

          <article className="worker-flow-detail-card worker-flow-workflow-card">
            <div className="worker-flow-workflow-head">
              <p className="worker-flow-eyebrow">Execution Flow</p>
              <h2>Assigned - Arrived - Start OTP - In Progress - Completion OTP - Completed</h2>
            </div>

            {jobActionError ? <p className="worker-flow-feedback is-error">{jobActionError}</p> : null}
            {jobActionMessage ? <p className="worker-flow-feedback is-success">{jobActionMessage}</p> : null}

            {flowStatus === "assigned" ? (
              <div className="worker-flow-step-card">
                <h3>Waiting for arrival</h3>
                <p>Open navigation, reach the customer location, and tap I Arrived to unlock the start step.</p>
              </div>
            ) : null}

            {flowStatus === "arrived" ? (
              <div className="worker-flow-step-card">
                <h3>Enter Start OTP</h3>
                <p>The customer shares the start OTP after the worker reaches the location.</p>
                <input
                  className="worker-flow-input"
                  value={otpDrafts?.[selectedJob.id]?.start || ""}
                  onChange={(event) => updateOtpDraft(selectedJob.id, "start", event.target.value)}
                  placeholder="Enter start OTP"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="worker-flow-btn worker-flow-btn-primary"
                  onClick={() => updateJobStatus(selectedJob, "in_progress", "start")}
                  disabled={actionInFlight}
                >
                  {actionInFlight ? "Starting..." : "Start Job"}
                </button>
              </div>
            ) : null}

            {flowStatus === "in_progress" ? (
              <div className="worker-flow-step-card">
                <h3>Job Status: In Progress</h3>
                {completionOtpRequested ? (
                  <>
                    <p>The completion OTP has been sent to the customer. Enter it here to finish the job.</p>
                    <input
                      className="worker-flow-input"
                      value={otpDrafts?.[selectedJob.id]?.completion || ""}
                      onChange={(event) => updateOtpDraft(selectedJob.id, "completion", event.target.value)}
                      placeholder="Enter completion OTP"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      className="worker-flow-btn worker-flow-btn-primary"
                      onClick={() => updateJobStatus(selectedJob, "completed", "completion")}
                      disabled={actionInFlight}
                    >
                      {actionInFlight ? "Completing..." : "Complete Job"}
                    </button>
                  </>
                ) : (
                  <>
                    <p>Finish the work and request the completion OTP from the customer before closing the job.</p>
                    <button
                      type="button"
                      className="worker-flow-btn worker-flow-btn-primary"
                      onClick={() => requestCompletionOtp(selectedJob.id)}
                      disabled={actionInFlight}
                    >
                      {actionInFlight ? "Sending..." : "Request Completion OTP"}
                    </button>
                  </>
                )}
              </div>
            ) : null}

            {flowStatus === "completed" ? (
              <div className="worker-flow-step-card is-complete">
                <h3>Job completed</h3>
                <p>The booking has been marked complete and will now appear in the completed history tab.</p>
              </div>
            ) : null}
          </article>
        </section>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="worker-flow-page">
        <main className="worker-flow-shell worker-flow-main">
          <section className="worker-flow-hero-card">
            <div>
              <p className="worker-flow-eyebrow">Worker Workspace</p>
              <h1>Loading worker interface</h1>
              <p>Preparing jobs, live availability, and job execution controls.</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="worker-flow-page">
      <header className="worker-flow-header">
        <div className="worker-flow-shell worker-flow-header-inner">
          <Link to="/home" className="worker-flow-brand" aria-label="Tasko worker home">
            <TaskoBrandMark className="worker-flow-brand-mark" />
            <div>
              <strong>TASKO</strong>
              <span>Worker App</span>
            </div>
          </Link>

          <nav className="worker-flow-nav" aria-label="Worker sections">
            {sections.map((item) => (
              <NavLink key={item.id} to={item.href} className={({ isActive }) => `worker-flow-nav-link${isActive ? " is-active" : ""}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="worker-flow-header-actions">
            <button
              type="button"
              className={`worker-flow-availability${online ? " is-online" : ""}`}
              onClick={toggleOnlineStatus}
              disabled={statusUpdating}
            >
              <span className="worker-flow-availability-dot" aria-hidden="true" />
              {statusUpdating ? "Updating..." : online ? "Online" : "Offline"}
            </button>
            <button
              type="button"
              className="worker-flow-avatar worker-flow-avatar-btn"
              aria-label="Open worker profile"
              onClick={() => navigate("/profile")}
            >
              {workerInitials}
            </button>
            <button type="button" className="worker-flow-btn worker-flow-btn-ghost worker-flow-logout" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="worker-flow-shell worker-flow-main">
        {error ? <p className="worker-flow-feedback is-error worker-flow-top-feedback">{error}</p> : null}
        {jobActionError && section !== "details" ? <p className="worker-flow-feedback is-error worker-flow-top-feedback">{jobActionError}</p> : null}
        {jobActionMessage && section !== "details" ? <p className="worker-flow-feedback is-success worker-flow-top-feedback">{jobActionMessage}</p> : null}

        {section === "home"
          ? renderHomeSection()
          : section === "jobs"
            ? renderJobsSection()
            : section === "progress"
              ? renderProgressSection()
              : section === "profile"
                ? renderProfileSection()
                : renderJobDetailsSection()}
      </main>
    </div>
  );
}
