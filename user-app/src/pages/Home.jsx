import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import { CategoryIcon, SearchIcon } from "../components/PortalIcons";
import { groceryCategories, howTaskoWorks, packageFallbacks, serviceCategories } from "./homeData";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePackageList(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return packageFallbacks;
  }

  const normalized = list
    .map((item, index) => {
      const name =
        item?.package_name ||
        item?.name ||
        item?.serviceType ||
        item?.plan ||
        `Tasko Plan ${index + 1}`;
      const durationDays = Number(item?.duration_days);
      const duration =
        Number.isFinite(durationDays) && durationDays > 0
          ? `${Math.trunc(durationDays)} days`
          : item?.duration || "Flexible";
      const frequency = item?.visit_frequency || item?.frequency || "";
      const normalizedFrequency = String(frequency || "")
        .replace(/_/g, " ")
        .trim();
      return {
        id: item?.id || item?._id || item?.package_id || `${name}-${index}`,
        name,
        description: normalizedFrequency
          ? `${duration} | ${normalizedFrequency} support plan for regular service bookings.`
          : `${duration} support plan for regular service bookings.`
      };
    })
    .filter((item) => Boolean(item.name));

  return normalized.length > 0 ? normalized : packageFallbacks;
}

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [packages, setPackages] = useState(packageFallbacks);

  useEffect(() => {
    if (location.hash !== "#home-footer") return;
    const timer = window.setTimeout(() => {
      document.getElementById("home-footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  useEffect(() => {
    const loadData = async () => {
      const cachedPackages = readSessionCache("packages:list", 5 * 60 * 1000);
      if (Array.isArray(cachedPackages) && cachedPackages.length > 0) {
        setPackages(normalizePackageList(cachedPackages));
        return;
      }

      const packageResponse = await api.get("/api/packages");
      writeSessionCache("packages:list", packageResponse.data);
      setPackages(normalizePackageList(packageResponse.data));
    };

    loadData().catch(() => {
      setPackages(packageFallbacks);
    });
  }, []);

  const groceryKeywords = useMemo(
    () =>
      groceryCategories.flatMap((category) =>
        normalizeText(category.name)
          .split(" ")
          .filter(Boolean)
      ),
    []
  );

  const handleSearch = (event) => {
    event.preventDefault();
    const normalized = normalizeText(searchQuery);
    if (!normalized) return;

    const isGroceryQuery = groceryKeywords.some((keyword) => normalized.includes(keyword));
    if (isGroceryQuery) {
      navigate(`/taskomart?search=${encodeURIComponent(searchQuery.trim())}`);
      return;
    }

    navigate(`/services?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <UserPortalShell activeNav="home">
      <section className="tasko-hero-panel" id="top">
        <p className="tasko-hero-eyebrow">Trusted Home Services Platform</p>
        <h1>Book Trusted Home Services Easily</h1>
        <p>
          Discover verified professionals, book instantly, and shop groceries from TaskoMart in one seamless
          experience.
        </p>
        <form className="tasko-search-form" onSubmit={handleSearch}>
          <label htmlFor="service-or-grocery-search" className="sr-only">
            Search services or groceries
          </label>
          <SearchIcon className="tasko-search-icon" />
          <input
            id="service-or-grocery-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search for services or groceries..."
          />
          <button type="submit">Search</button>
        </form>
      </section>

      <section className="tasko-content-panel">
        <div className="tasko-section-head">
          <p>Home Services</p>
          <h2>Service Categories</h2>
        </div>
        <div className="tasko-category-grid">
          {serviceCategories.map((category) => (
            <article key={category.id} className="tasko-card">
              <span className="tasko-card-icon">
                <CategoryIcon name={category.icon} className="tasko-line-icon" />
              </span>
              <h3>{category.name}</h3>
              <button type="button" onClick={() => navigate(`/services?category=${encodeURIComponent(category.name)}`)}>
                View Subcategories
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="tasko-content-panel" id="taskomart-section">
        <div className="tasko-section-head">
          <p>TaskoMart</p>
          <h2>Grocery Categories</h2>
        </div>
        <div className="tasko-category-grid grocery">
          {groceryCategories.map((category) => (
            <article key={category.id} className="tasko-card">
              <span className="tasko-card-icon">
                <CategoryIcon name={category.icon} className="tasko-line-icon" />
              </span>
              <h3>{category.name}</h3>
              <button type="button" onClick={() => navigate(`/taskomart?category=${encodeURIComponent(category.name)}`)}>
                Browse Products
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="tasko-content-panel">
        <div className="tasko-section-head">
          <p>Plans</p>
          <h2>Service Packages</h2>
        </div>
        <div className="tasko-package-grid">
          {packages.slice(0, 3).map((pkg) => (
            <article key={pkg.id} className="tasko-card package">
              <h3>{pkg.name}</h3>
              <p>{pkg.description}</p>
              <button type="button" onClick={() => navigate("/packages")}>
                View Details
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="tasko-content-panel">
        <div className="tasko-section-head">
          <p>Quick Guide</p>
          <h2>How Tasko Works</h2>
        </div>
        <div className="tasko-steps-grid">
          {howTaskoWorks.map((step) => (
            <article key={step.id} className="tasko-step-card">
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </UserPortalShell>
  );
}
