import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function WaitingApprovalPage() {
  const navigate = useNavigate();
  const workerId = localStorage.getItem("tasko_worker_id");
  const [status, setStatus] = useState("pending");

  useEffect(() => {
    if (!workerId) {
      navigate("/");
      return;
    }

    const checkStatus = async () => {
      const response = await api.get(`/api/workers/${workerId}`);
      setStatus(response.data.status || "pending");

      if (response.data.status === "approved") {
        navigate("/dashboard");
      }
    };

    checkStatus().catch(() => setStatus("pending"));
    const interval = setInterval(() => {
      checkStatus().catch(() => setStatus("pending"));
    }, 5000);

    return () => clearInterval(interval);
  }, [navigate, workerId]);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="card text-center">
        <h2 className="mb-2 text-2xl font-bold">Waiting for Approval</h2>
        <p className="text-sm text-slate-600">
          Current status: <span className="font-semibold capitalize text-orange-700">{status}</span>
        </p>
        <p className="mt-2 text-sm text-slate-600">Admin review is required before dashboard access.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-accent-700">
          Back to Landing
        </Link>
      </div>
    </div>
  );
}