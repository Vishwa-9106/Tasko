import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import BrandLogo from "../components/landing/BrandLogo";

export default function WaitingApprovalPage() {
  const navigate = useNavigate();
  const workerId = localStorage.getItem("tasko_worker_id");
  const [status, setStatus] = useState("pending");
  const [worker, setWorker] = useState(null);

  useEffect(() => {
    if (!workerId) {
      navigate("/login", { replace: true });
      return;
    }

    const checkStatus = async () => {
      const response = await api.get(`/api/workers/${workerId}`);
      setStatus(response.data.status || "pending");
      setWorker(response.data);

      if (response.data.status === "approved") {
        navigate("/dashboard", { replace: true });
      }
    };

    checkStatus().catch(() => setStatus("pending"));
    const interval = setInterval(() => {
      checkStatus().catch(() => setStatus("pending"));
    }, 6000);

    return () => clearInterval(interval);
  }, [navigate, workerId]);

  const logout = () => {
    localStorage.removeItem("tasko_worker_id");
    navigate("/login", { replace: true });
  };

  const submittedCategories = Array.isArray(worker?.categories) && worker.categories.length > 0 ? worker.categories : [];
  const testCompleted = Boolean(worker?.assessment);

  return (
    <div className="worker-approval-screen">
      <div className="worker-shell worker-approval-shell">
        <div className="worker-approval-card">
          <div className="worker-approval-brand">
            <BrandLogo compact />
          </div>
          <p className="section-eyebrow">Verification In Progress</p>
          <h1>Your request is under review. Admin has not approved your account yet.</h1>

          <div className="worker-approval-status-row">
            <span className="worker-approval-badge" aria-live="polite">
              🟡 Pending Approval
            </span>
            <span className="worker-approval-substatus">Current status: {status}</span>
          </div>

          <div className="worker-approval-grid">
            <article className="worker-approval-item">
              <p>Submitted categories</p>
              <h2>{submittedCategories.length > 0 ? submittedCategories.join(", ") : "Not available"}</h2>
            </article>
            <article className="worker-approval-item">
              <p>Test status</p>
              <h2>{testCompleted ? "Completed" : "Not completed"}</h2>
            </article>
          </div>

          <button type="button" className="worker-approval-logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
