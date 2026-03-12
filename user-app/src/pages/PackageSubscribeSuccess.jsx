import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import "./PackageSubscribe.css";

function formatDate(value) {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function PackageSubscribeSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscriptionId } = useParams();
  const [subscription, setSubscription] = useState(location.state?.subscription || null);
  const [loading, setLoading] = useState(!location.state?.subscription);
  const [error, setError] = useState("");

  useEffect(() => {
    if (subscription) return;

    const loadSubscription = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/package-subscriptions/${subscriptionId}`);
        setSubscription(response.data || null);
      } catch (loadError) {
        setError(loadError?.response?.data?.message || "Failed to load subscription details.");
      } finally {
        setLoading(false);
      }
    };

    loadSubscription().catch(() => {
      setLoading(false);
      setError("Failed to load subscription details.");
    });
  }, [subscription, subscriptionId]);

  return (
    <UserPortalShell activeNav="packages">
      <section className="tasko-page-header">
        <p>Success</p>
        <h1>Package Subscription Active</h1>
        <p>Your recurring package has been confirmed and is now active.</p>
      </section>

      <section className="tasko-content-panel tasko-subscribe-success-card">
        {loading ? <p className="tasko-empty-state">Loading subscription details...</p> : null}
        {!loading && error ? <p className="tasko-empty-state">{error}</p> : null}
        {!loading && subscription ? (
          <>
            <div className="tasko-section-head">
              <p>Confirmed</p>
              <h2>{subscription.packageName || subscription.package_name}</h2>
            </div>
            <div className="tasko-subscribe-summary-list">
              <div>
                <span>Package Name</span>
                <strong>{subscription.packageName || subscription.package_name}</strong>
              </div>
              <div>
                <span>Start Date</span>
                <strong>{formatDate(subscription.startDate || subscription.start_date)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{subscription.status || "active"}</strong>
              </div>
            </div>
            <div className="tasko-subscribe-actions">
              <button type="button" onClick={() => navigate("/packages#my-packages", { replace: true })}>
                Go to My Packages
              </button>
            </div>
          </>
        ) : null}
      </section>
    </UserPortalShell>
  );
}
