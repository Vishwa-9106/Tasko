import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({
    category: "",
    date: "",
    time: "",
    notes: ""
  });
  const [message, setMessage] = useState("");

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    try {
      await api.post("/api/bookings", {
        userId: user.uid,
        ...formData
      });
      setMessage("Booking submitted successfully.");
      setFormData({ category: "", date: "", time: "", notes: "" });
    } catch (error) {
      setMessage(error.response?.data?.message || "Booking failed");
    }
  };

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-3 text-2xl font-bold">Service Categories</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {categoryOptions.map((service) => (
            <div key={service.value} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium">
              {service.label}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="mb-3 text-xl font-semibold">Book a Service</h3>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <select
            className="input"
            value={formData.category}
            onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
            required
          >
            <option value="">Select Category</option>
            {categoryOptions.map((service) => (
              <option key={service.value} value={service.value}>
                {service.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={formData.date}
            onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
            required
          />
          <input
            type="time"
            className="input"
            value={formData.time}
            onChange={(event) => setFormData((prev) => ({ ...prev, time: event.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Additional notes"
            value={formData.notes}
            onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
          />
          <button type="submit" className="btn btn-primary md:col-span-2">
            Confirm Booking
          </button>
        </form>
        {message ? <p className="mt-3 text-sm text-brand-700">{message}</p> : null}
      </section>
    </div>
  );
}