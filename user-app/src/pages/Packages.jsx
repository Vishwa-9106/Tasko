import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import UserDashboardShell from "../components/UserDashboardShell";

function normalizeDate(daysFromNow = 0) {
  const base = new Date();
  base.setDate(base.getDate() + daysFromNow);
  return base.toISOString().slice(0, 10);
}

export default function PackagesPage() {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [packageStates, setPackageStates] = useState({});

  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(`tasko_user_package_states_${user.uid}`);
    if (!saved) return;
    try {
      setPackageStates(JSON.parse(saved));
    } catch (_error) {
      setPackageStates({});
    }
  }, [user]);

  useEffect(() => {
    const loadPackages = async () => {
      const response = await api.get("/api/packages");
      setPackages(response.data);
    };

    loadPackages().catch(() => {
      setPackages([
        { id: "starter", name: "Home Cleaning Weekly", serviceType: "Home Cleaning", frequency: "Weekly" },
        { id: "plus", name: "Plumbing Every 2 Days", serviceType: "Plumbing", frequency: "Every 2 Days" },
        { id: "pro", name: "Electrical Monthly", serviceType: "Electrical", frequency: "Monthly" }
      ]);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`tasko_user_package_states_${user.uid}`, JSON.stringify(packageStates));
  }, [packageStates, user]);

  const updatePackageState = (id, nextState) => {
    setPackageStates((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        ...nextState
      }
    }));
  };

  return (
    <UserDashboardShell
      activeTab="packages"
      title="Package Plans"
      subtitle="Manage active package subscriptions with upcoming schedule and quick pause/cancel controls."
    >
      <section className="user-grid cards">
        {packages.map((pkg) => (
          (() => {
            const pkgId = pkg.id || pkg.name;
            const status = packageStates[pkgId]?.status || "active";
            if (status === "cancelled") return null;
            const nextDate = packageStates[pkgId]?.nextDate || pkg.nextScheduledDate || normalizeDate(3);
            const serviceType = pkg.serviceType || pkg.category || pkg.name;
            const frequency = pkg.frequency || pkg.plan || "Weekly";

            return (
              <article key={pkgId} className="user-card">
                <h3>{serviceType}</h3>
                <p>Frequency: {frequency}</p>
                <p>Next scheduled date: {nextDate}</p>
                <p>Status: {status}</p>
                <div className="user-actions">
                  <button
                    type="button"
                    className="user-btn secondary"
                    onClick={() =>
                      updatePackageState(pkgId, {
                        status: status === "paused" ? "active" : "paused"
                      })
                    }
                  >
                    {status === "paused" ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    className="user-btn danger"
                    onClick={() =>
                      updatePackageState(pkgId, {
                        status: "cancelled"
                      })
                    }
                  >
                    Cancel
                  </button>
                </div>
              </article>
            );
          })()
        ))}
      </section>
    </UserDashboardShell>
  );
}
