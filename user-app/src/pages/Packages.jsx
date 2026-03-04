import { useEffect, useState } from "react";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import "./Packages.css";

const fallbackPackages = [
  {
    package_id: 1,
    package_name: "Basic Home Care",
    description: "Daily home support package for essential household chores.",
    price: 999,
    duration_days: 30,
    visit_frequency: "daily",
    services: ["Floor Cleaning", "Dish Washing", "Trash Cleaning"]
  },
  {
    package_id: 2,
    package_name: "Weekly Deep Cleaning",
    description: "Focused deep cleaning package for bathrooms, kitchens and windows.",
    price: 499,
    duration_days: 7,
    visit_frequency: "weekly",
    services: ["Bathroom Cleaning", "Kitchen Cleaning", "Window Cleaning"]
  },
  {
    package_id: 3,
    package_name: "Vehicle Care Package",
    description: "Recurring vehicle wash package for bikes and cars.",
    price: 799,
    duration_days: 30,
    visit_frequency: "every_2_days",
    services: ["Bike Wash", "Car Wash"]
  }
];

function toPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function toDurationDays(value) {
  const numberValue = Number(value);
  if (Number.isFinite(numberValue) && numberValue > 0) {
    return Math.trunc(numberValue);
  }

  const text = String(value || "");
  const match = text.match(/\d+/);
  if (!match) return 30;
  return Number(match[0]) || 30;
}

function toFrequencyLabel(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (normalized === "daily") return "Daily";
  if (normalized === "weekly") return "Weekly";
  if (normalized === "every_2_days" || normalized === "every2days") return "Every 2 Days";
  if (normalized === "monthly") return "Monthly";
  return "Flexible";
}

function normalizeServices(input) {
  if (Array.isArray(input) && input.length > 0) {
    return input
      .map((value) => (typeof value === "string" ? value.trim() : String(value || "").trim()))
      .filter(Boolean);
  }
  return [];
}

function normalizePackage(packageInput, index) {
  const details = Array.isArray(packageInput?.service_details) ? packageInput.service_details : [];
  const servicesFromDetails = details
    .map((detail) => String(detail?.sub_category_name || "").trim())
    .filter(Boolean);
  const services = normalizeServices(packageInput?.services);
  const normalizedServices = services.length > 0 ? services : servicesFromDetails;

  return {
    package_id: Number(packageInput?.package_id) || Number(packageInput?.id) || index + 1,
    package_name: String(packageInput?.package_name || packageInput?.name || `Tasko Package ${index + 1}`).trim(),
    description: String(
      packageInput?.description || "Tasko recurring service package with verified professionals."
    ).trim(),
    price: Number.isFinite(Number(packageInput?.price)) ? Number(packageInput.price) : 0,
    duration_days: toDurationDays(packageInput?.duration_days ?? packageInput?.duration),
    visit_frequency: String(packageInput?.visit_frequency || packageInput?.frequency || "weekly").trim(),
    services: normalizedServices
  };
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 10.2L8.3 14L15.5 6.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PackagesPage() {
  const [packages, setPackages] = useState(fallbackPackages);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState(0);

  useEffect(() => {
    const loadPackages = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/api/packages");
        const normalized = Array.isArray(response.data)
          ? response.data.map((item, index) => normalizePackage(item, index)).filter((item) => item.package_name)
          : [];
        setPackages(normalized.length > 0 ? normalized : fallbackPackages);
      } catch (_error) {
        setError("Unable to load packages right now. Showing default plans.");
        setPackages(fallbackPackages);
      } finally {
        setLoading(false);
      }
    };

    loadPackages().catch(() => {
      setPackages(fallbackPackages);
      setLoading(false);
      setError("Unable to load packages right now. Showing default plans.");
    });
  }, []);

  return (
    <UserPortalShell activeNav="packages">
      <section className="tasko-page-header">
        <p>Packages</p>
        <h1>Choose Your Service Package</h1>
        <p>Select a recurring plan and subscribe to regular services at fixed pricing.</p>
      </section>

      {error ? <p className="tasko-empty-state">{error}</p> : null}
      {loading ? <p className="tasko-empty-state">Loading packages...</p> : null}

      <section className="tasko-packages-grid-wrap">
        <div className="tasko-packages-grid">
          {packages.map((pkg) => (
            <article key={pkg.package_id} className="tasko-package-card-v2">
              <div className="tasko-package-card-head">
                <h3>{pkg.package_name}</h3>
                <span className="tasko-package-duration-badge">{pkg.duration_days} Days</span>
              </div>

              <p className="tasko-package-price">{toPrice(pkg.price)}</p>
              <p className="tasko-package-frequency">{toFrequencyLabel(pkg.visit_frequency)} Visits</p>
              <p className="tasko-package-description">{pkg.description}</p>

              <ul className="tasko-package-service-list">
                {(pkg.services.length > 0 ? pkg.services : ["Customizable service list"]).map((service) => (
                  <li key={`${pkg.package_id}-${service}`}>
                    <span className="tasko-package-check-icon">
                      <CheckIcon />
                    </span>
                    <span>{service}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="tasko-package-subscribe-btn"
                onClick={() => setSelectedPackageId(pkg.package_id)}
              >
                {selectedPackageId === pkg.package_id ? "Selected Package" : "Subscribe Package"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </UserPortalShell>
  );
}
