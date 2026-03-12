import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import { useAuth } from "../context/AuthContext";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";
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
  const services = normalizeServices(
    packageInput?.servicesIncluded || packageInput?.services_included || packageInput?.services
  );
  const normalizedServices = services.length > 0 ? services : servicesFromDetails;

  return {
    package_id: Number(packageInput?.package_id) || Number(packageInput?.id) || index + 1,
    package_name: String(packageInput?.package_name || packageInput?.name || `Tasko Package ${index + 1}`).trim(),
    description: String(
      packageInput?.description || "Tasko recurring service package with verified professionals."
    ).trim(),
    price: Number.isFinite(Number(packageInput?.price)) ? Number(packageInput.price) : 0,
    duration_days: toDurationDays(packageInput?.duration_days ?? packageInput?.duration),
    visit_frequency: String(packageInput?.visit_frequency || packageInput?.visitFrequency || packageInput?.frequency || "weekly").trim(),
    services: normalizedServices
  };
}

function normalizeSubscription(record, index) {
  return {
    id: String(record?.id || record?.user_package_id || index + 1),
    packageName: String(record?.packageName || record?.package_name || `Package ${index + 1}`).trim(),
    packagePrice: Number(record?.packagePrice ?? record?.package_price ?? 0) || 0,
    startDate: String(record?.startDate || record?.start_date || "").trim(),
    timeSlot: String(record?.timeSlot || record?.time_slot || "").trim(),
    status: String(record?.status || "active").trim(),
    paymentStatus: String(record?.paymentStatus || record?.payment_status || "paid").trim(),
    fullAddress: String(record?.fullAddress || "").trim(),
    addressTitle: String(record?.addressTitle || record?.address_title || "").trim()
  };
}

function normalizePackageVisit(record, index) {
  return {
    id: String(record?.id || record?.schedule_id || index + 1),
    userPackageId: String(record?.userPackageId || record?.user_package_id || ""),
    packageName: String(record?.packageName || record?.package_name || "").trim(),
    serviceDate: String(record?.serviceDate || record?.service_date || "").trim(),
    timeSlot: String(record?.timeSlot || record?.time_slot || "").trim(),
    status: String(record?.status || "pending").trim(),
    visitIndex: Number(record?.visitIndex ?? record?.visit_index ?? index + 1) || index + 1,
    totalVisits: Number(record?.totalVisits ?? record?.total_visits ?? 1) || 1,
    fullAddress: String(record?.fullAddress || record?.address || "").trim()
  };
}

function formatDate(value) {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function PackagesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [packages, setPackages] = useState(fallbackPackages);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [error, setError] = useState("");
  const [subscriptionsError, setSubscriptionsError] = useState("");
  const [visits, setVisits] = useState([]);
  const [visitsError, setVisitsError] = useState("");

  useEffect(() => {
    if (location.hash !== "#my-packages") return;
    const timer = window.setTimeout(() => {
      document.getElementById("my-packages")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  useEffect(() => {
    const loadPackages = async () => {
      setLoading(true);
      setError("");

      try {
        const cachedPackages = readSessionCache("packages:list", 5 * 60 * 1000);
        if (Array.isArray(cachedPackages) && cachedPackages.length > 0) {
          const normalizedCached = cachedPackages.map((item, index) => normalizePackage(item, index)).filter((item) => item.package_name);
          setPackages(normalizedCached.length > 0 ? normalizedCached : fallbackPackages);
        }

        const response = await api.get("/api/packages");
        const normalized = Array.isArray(response.data)
          ? response.data.map((item, index) => normalizePackage(item, index)).filter((item) => item.package_name)
          : [];
        writeSessionCache("packages:list", Array.isArray(response.data) ? response.data : []);
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

  useEffect(() => {
    if (!user?.uid) {
      setSubscriptions([]);
      return;
    }

    const loadSubscriptions = async () => {
      setSubscriptionsLoading(true);
      setSubscriptionsError("");
      try {
        const cacheKey = `package-subscriptions:${user.uid}`;
        const cached = readSessionCache(cacheKey, 30 * 1000);
        if (Array.isArray(cached)) {
          setSubscriptions(cached.map((item, index) => normalizeSubscription(item, index)));
        }

        const response = await api.get("/api/package-subscriptions", {
          params: { userId: user.uid }
        });
        const normalized = Array.isArray(response.data)
          ? response.data.map((item, index) => normalizeSubscription(item, index))
          : [];
        writeSessionCache(cacheKey, Array.isArray(response.data) ? response.data : []);
        setSubscriptions(normalized);
      } catch (_error) {
        setSubscriptionsError("Unable to load your active package subscriptions right now.");
      } finally {
        setSubscriptionsLoading(false);
      }
    };

    loadSubscriptions().catch(() => {
      setSubscriptions([]);
      setSubscriptionsLoading(false);
      setSubscriptionsError("Unable to load your active package subscriptions right now.");
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setVisits([]);
      return;
    }

    const loadVisits = async () => {
      setVisitsLoading(true);
      setVisitsError("");
      try {
        const response = await api.get("/api/package-schedules", {
          params: { userId: user.uid }
        });
        const normalized = Array.isArray(response.data)
          ? response.data.map((item, index) => normalizePackageVisit(item, index))
          : [];
        setVisits(normalized);
      } catch (_error) {
        setVisitsError("Unable to load package visit schedule right now.");
      } finally {
        setVisitsLoading(false);
      }
    };

    loadVisits().catch(() => {
      setVisits([]);
      setVisitsLoading(false);
      setVisitsError("Unable to load package visit schedule right now.");
    });
  }, [user?.uid]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((item) => String(item.status || "").toLowerCase() === "active"),
    [subscriptions]
  );

  const visitsBySubscription = useMemo(() => {
    const grouped = new Map();
    visits.forEach((visit) => {
      const list = grouped.get(visit.userPackageId) || [];
      list.push(visit);
      grouped.set(visit.userPackageId, list);
    });
    grouped.forEach((list, key) => {
      grouped.set(
        key,
        [...list].sort((left, right) => new Date(left.serviceDate).getTime() - new Date(right.serviceDate).getTime())
      );
    });
    return grouped;
  }, [visits]);

  return (
    <UserPortalShell activeNav="packages">
      <section className="tasko-page-header">
        <p>Packages</p>
        <h1>Manage Packages & Subscriptions</h1>
        <p>Review your active package subscriptions or start a new recurring service plan.</p>
      </section>

      <section className="tasko-content-panel" id="my-packages">
        <div className="tasko-section-head">
          <p>Active</p>
          <h2>My Packages</h2>
        </div>

        {subscriptionsLoading ? <p className="tasko-empty-state">Loading your package subscriptions...</p> : null}
        {!subscriptionsLoading && subscriptionsError ? <p className="tasko-empty-state">{subscriptionsError}</p> : null}
        {!subscriptionsLoading && !subscriptionsError && activeSubscriptions.length === 0 ? (
          <p className="tasko-empty-state">No active package subscriptions yet. Subscribe to a package below.</p>
        ) : null}

        {activeSubscriptions.length > 0 ? (
          <div className="tasko-my-packages-grid">
            {activeSubscriptions.map((subscription) => (
              (() => {
                const schedule = visitsBySubscription.get(subscription.id) || [];
                const nextVisit = schedule.find((visit) => !["completed", "cancelled"].includes(String(visit.status).toLowerCase())) || null;
                const completedVisits = schedule.filter((visit) => String(visit.status).toLowerCase() === "completed").length;

                return (
                  <article key={subscription.id} className="tasko-card tasko-my-package-card">
                    <div className="tasko-my-package-head">
                      <div>
                        <p className="tasko-package-frequency">{subscription.status}</p>
                        <h3>{subscription.packageName}</h3>
                      </div>
                      <span className="tasko-package-duration-badge">{subscription.paymentStatus}</span>
                    </div>
                    <p className="tasko-package-price">{toPrice(subscription.packagePrice)}</p>
                    <div className="tasko-my-package-meta">
                      <p><strong>Start Date:</strong> {formatDate(subscription.startDate)}</p>
                      <p><strong>Time Slot:</strong> {subscription.timeSlot || "-"}</p>
                      <p><strong>Address:</strong> {subscription.addressTitle || "Saved Address"}</p>
                    </div>
                    <p className="tasko-package-description">{subscription.fullAddress || "Address not available."}</p>

                    <div className="tasko-package-visit-summary">
                      <p><strong>Completed Visits:</strong> {completedVisits}/{schedule.length || 0}</p>
                      <p>
                        <strong>Next Visit:</strong>{" "}
                        {nextVisit ? `${formatDate(nextVisit.serviceDate)} • ${nextVisit.timeSlot || "-"}` : "No pending visits"}
                      </p>
                    </div>

                    {schedule.length > 0 ? (
                      <div className="tasko-package-visit-list">
                        {schedule.slice(0, 4).map((visit) => (
                          <div key={visit.id} className="tasko-package-visit-item">
                            <strong>
                              Visit {visit.visitIndex}/{visit.totalVisits}
                            </strong>
                            <span>{formatDate(visit.serviceDate)}</span>
                            <span>{visit.timeSlot || "-"}</span>
                            <span>{visit.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })()
            ))}
          </div>
        ) : null}

        {visitsLoading ? <p className="tasko-empty-state">Loading package visit schedule...</p> : null}
        {!visitsLoading && visitsError ? <p className="tasko-empty-state">{visitsError}</p> : null}
      </section>

      {error ? <p className="tasko-empty-state">{error}</p> : null}
      {loading ? <p className="tasko-empty-state">Loading packages...</p> : null}

      <section className="tasko-packages-grid-wrap">
        <div className="tasko-section-head">
          <p>Explore</p>
          <h2>Available Packages</h2>
        </div>

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
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M4.5 10.2L8.3 14L15.5 6.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>{service}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="tasko-package-subscribe-btn"
                onClick={() => navigate(`/subscribe/${pkg.package_id}`)}
              >
                Subscribe Package
              </button>
            </article>
          ))}
        </div>
      </section>
    </UserPortalShell>
  );
}
