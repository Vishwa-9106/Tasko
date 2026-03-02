import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import UserDashboardShell from "../components/UserDashboardShell";

export default function HomePage() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);

  useEffect(() => {
    const loadServices = async () => {
      const response = await api.get("/api/services");
      setServices(response.data);
    };

    loadServices().catch(() => {
      setServices([
        { id: "cleaning", name: "Home Cleaning" },
        { id: "plumbing", name: "Plumbing" },
        { id: "electrician", name: "Electrician" }
      ]);
    });
  }, []);

  const categoryOptions = useMemo(() => {
    if (services.length === 0) return [];
    return services.map((service) => ({ value: service.name || service.id, label: service.name || service.id }));
  }, [services]);

  return (
    <UserDashboardShell
      activeTab="home"
      title="Book Trusted Services"
      subtitle="Explore premium categories and continue to booking with your date, time, and preferred plan."
    >
      <section className="user-grid cards">
        {categoryOptions.length === 0 ? (
          <article className="user-card">
            <h2>Categories</h2>
            <p>Service categories are currently unavailable.</p>
          </article>
        ) : (
          categoryOptions.map((service) => (
            <article
              key={service.value}
              className="user-card user-category-card"
              onClick={() => navigate(`/booking?category=${encodeURIComponent(service.value)}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/booking?category=${encodeURIComponent(service.value)}`);
                }
              }}
            >
              <h3>{service.label}</h3>
              <p>Choose your preferred slot and booking plan.</p>
              <div className="user-actions">
                <button
                  type="button"
                  className="user-btn primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/booking?category=${encodeURIComponent(service.value)}`);
                  }}
                >
                  Book Now
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </UserDashboardShell>
  );
}
