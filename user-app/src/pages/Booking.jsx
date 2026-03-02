import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import UserDashboardShell from "../components/UserDashboardShell";

function formatTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    category: searchParams.get("category") || "",
    date: "",
    time: "",
    planType: "one-time",
    packageId: "",
    notes: ""
  });

  useEffect(() => {
    const loadData = async () => {
      const [servicesRes, packagesRes] = await Promise.all([api.get("/api/services"), api.get("/api/packages")]);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setPackages(Array.isArray(packagesRes.data) ? packagesRes.data : []);
    };

    loadData().catch(() => {
      setServices([
        { id: "home-cleaning", name: "Home Cleaning" },
        { id: "plumbing", name: "Plumbing" },
        { id: "electrical", name: "Electrical" }
      ]);
      setPackages([]);
    });
  }, []);

  useEffect(() => {
    const categoryFromQuery = searchParams.get("category");
    if (!categoryFromQuery) return;
    setFormData((current) => ({
      ...current,
      category: categoryFromQuery
    }));
  }, [searchParams]);

  const serviceOptions = useMemo(
    () => services.map((service) => ({ value: service.name || service.id, label: service.name || service.id })),
    [services]
  );

  const packageOptions = useMemo(
    () =>
      packages.map((pkg) => ({
        value: pkg.id || pkg.name,
        label: pkg.name || pkg.serviceType || "Package Plan"
      })),
    [packages]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setMessage("");

    try {
      await api.post("/api/bookings", {
        userId: user.uid,
        category: formData.category,
        date: formData.date,
        time: formData.time,
        notes: formData.notes,
        planType: formData.planType,
        packageId: formData.planType === "package" ? formData.packageId : ""
      });
      setMessage("Booking submitted successfully.");
      setFormData((current) => ({
        ...current,
        date: "",
        time: "",
        packageId: "",
        notes: ""
      }));
    } catch (error) {
      setMessage(error?.response?.data?.message || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <UserDashboardShell
      activeTab="home"
      title="Book Your Service"
      subtitle="Select category, date, time, and choose one-time service or a package plan."
    >
      <section className="user-card">
        <h2>Booking Details</h2>
        <form className="user-inline-fields" onSubmit={handleSubmit}>
          <select
            className="user-select"
            value={formData.category}
            onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
            required
          >
            <option value="">Select category</option>
            {serviceOptions.map((service) => (
              <option key={service.value} value={service.value}>
                {service.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="user-input"
            min={formatTodayDate()}
            value={formData.date}
            onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
            required
          />

          <input
            type="time"
            className="user-input"
            value={formData.time}
            onChange={(event) => setFormData((current) => ({ ...current, time: event.target.value }))}
            required
          />

          <select
            className="user-select"
            value={formData.planType}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                planType: event.target.value,
                packageId: ""
              }))
            }
            required
          >
            <option value="one-time">One-time</option>
            <option value="package">Package Plan</option>
          </select>

          {formData.planType === "package" ? (
            <select
              className="user-select"
              value={formData.packageId}
              onChange={(event) => setFormData((current) => ({ ...current, packageId: event.target.value }))}
              required
            >
              <option value="">Select package</option>
              {packageOptions.map((pkg) => (
                <option key={pkg.value} value={pkg.value}>
                  {pkg.label}
                </option>
              ))}
            </select>
          ) : (
            <span />
          )}

          <textarea
            className="user-textarea"
            placeholder="Add any special instructions"
            value={formData.notes}
            onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
          />

          <div className="user-actions">
            <button type="submit" className="user-btn primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Confirm Booking"}
            </button>
          </div>
        </form>
        {message ? <p className="user-empty">{message}</p> : null}
      </section>
    </UserDashboardShell>
  );
}
