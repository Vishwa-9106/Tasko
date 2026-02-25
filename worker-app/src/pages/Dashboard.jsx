import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function DashboardPage() {
  const navigate = useNavigate();
  const workerId = localStorage.getItem("tasko_worker_id");
  const [worker, setWorker] = useState(null);
  const [jobs, setJobs] = useState([]);

  const online = useMemo(() => Boolean(worker?.online), [worker]);

  useEffect(() => {
    if (!workerId) {
      navigate("/");
      return;
    }

    const loadDashboard = async () => {
      const [workerResponse, jobsResponse] = await Promise.all([
        api.get(`/api/workers/${workerId}`),
        api.get(`/api/workers/${workerId}/jobs`)
      ]);

      if (workerResponse.data.status !== "approved") {
        navigate("/waiting");
        return;
      }

      setWorker(workerResponse.data);
      setJobs(jobsResponse.data);
    };

    loadDashboard().catch(() => {
      setJobs([]);
    });
  }, [navigate, workerId]);

  const toggleOnline = async () => {
    if (!workerId || !worker) return;

    const nextValue = !online;
    await api.patch(`/api/workers/${workerId}/status`, { online: nextValue });
    setWorker((current) => ({ ...current, online: nextValue }));
  };

  const logout = () => {
    localStorage.removeItem("tasko_worker_id");
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Worker Dashboard</h2>
          <p className="text-sm text-slate-600">Track your status and assigned jobs.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleOnline} type="button" className="btn btn-primary">
            {online ? "Set Offline" : "Set Online"}
          </button>
          <button onClick={logout} type="button" className="btn btn-secondary">
            Logout
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="mb-3 text-lg font-semibold">Assigned Jobs</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-600">No jobs assigned yet.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-lg border border-orange-200 p-3">
                <p className="font-semibold">{job.category}</p>
                <p className="text-sm text-slate-600">
                  {job.date} at {job.time}
                </p>
                <p className="text-xs uppercase tracking-wide text-orange-700">Status: {job.status}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <Link to="/" className="text-sm text-accent-700">
        Back to Landing
      </Link>
    </div>
  );
}