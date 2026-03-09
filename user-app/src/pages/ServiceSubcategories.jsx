import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import { CategoryIcon, SearchIcon } from "../components/PortalIcons";
import { serviceCategories } from "./homeData";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";
import {
  buildServicePath,
  formatServicePrice,
  matchesServiceFilter,
  normalizeServicesResponse
} from "../utils/services";
import { toCategoryKey } from "../utils/serviceCatalog";

function guessIcon(categoryName) {
  const matched = serviceCategories.find((category) => toCategoryKey(category.name) === toCategoryKey(categoryName));
  return matched?.icon || "cleaning";
}

export default function ServiceSubcategoriesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [servicesPayload, setServicesPayload] = useState({ categories: [], services: [] });
  const [loading, setLoading] = useState(true);
  const selectedCategory = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    const loadServices = async () => {
      const cached = readSessionCache("services:list:v1", 5 * 60 * 1000);
      if (cached) {
        setServicesPayload(normalizeServicesResponse(cached));
        setLoading(false);
        return;
      }

      const response = await api.get("/api/services", {
        params: { status: "active" }
      });
      writeSessionCache("services:list:v1", response.data);
      setServicesPayload(normalizeServicesResponse(response.data));
      setLoading(false);
    };

    loadServices()
      .catch(() => {
        setServicesPayload({ categories: [], services: [] });
      })
      .finally(() => setLoading(false));
  }, []);

  const availableCategories = useMemo(() => {
    if (servicesPayload.categories.length > 0) {
      return servicesPayload.categories;
    }

    return Array.from(new Set(servicesPayload.services.map((service) => service.category))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [servicesPayload]);

  const services = useMemo(
    () => servicesPayload.services.filter((service) => matchesServiceFilter(service, selectedCategory, search)),
    [search, selectedCategory, servicesPayload]
  );

  const pageTitle = selectedCategory ? `${selectedCategory} Services` : "Service Discovery";

  return (
    <UserPortalShell activeNav="home">
      <section className="tasko-page-header">
        <p>Service Discovery</p>
        <h1>{pageTitle}</h1>
        <p>Explore full service details, compare pricing tiers, add-ons, and continue to booking.</p>
      </section>

      <section className="tasko-content-panel">
        <div className="tasko-toolbar">
          <div className="tasko-chip-row">
            {availableCategories.map((categoryName) => {
              const isActive = toCategoryKey(selectedCategory) === toCategoryKey(categoryName);
              return (
                <button
                  key={categoryName}
                  type="button"
                  className={`tasko-chip ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("category", categoryName);
                    setSearchParams(next);
                  }}
                >
                  {categoryName}
                </button>
              );
            })}
          </div>

          <form
            className="tasko-inline-search"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <label htmlFor="service-search" className="sr-only">
              Search services
            </label>
            <SearchIcon className="tasko-search-icon" />
            <input
              id="service-search"
              type="search"
              value={search}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                const nextValue = event.target.value;
                if (nextValue.trim()) {
                  next.set("search", nextValue);
                } else {
                  next.delete("search");
                }
                setSearchParams(next);
              }}
              placeholder="Search services"
            />
          </form>
        </div>

        {loading ? <p className="tasko-empty-state">Loading services...</p> : null}

        {!loading && services.length === 0 ? (
          <p className="tasko-empty-state">No services found for the selected filter.</p>
        ) : (
          <div className="tasko-subcategory-grid">
            {services.map((service) => (
              <article key={service.id || `${service.categorySlug}-${service.slug}`} className="tasko-card tasko-service-card">
                <span className="tasko-card-icon">
                  <CategoryIcon name={guessIcon(service.category)} className="tasko-line-icon" />
                </span>
                <div className="tasko-service-card-copy">
                  <h3>{service.name}</h3>
                  <p>{service.category}</p>
                  <p className="tasko-service-card-description">{service.description}</p>
                </div>
                <div className="tasko-service-card-meta">
                  <p className="tasko-service-price">Starting {formatServicePrice(service.startingPrice || service.basePrice)}</p>
                  <p>{service.duration || "Flexible duration"}</p>
                  <p>
                    ⭐ {service.rating.toFixed(1)} ({service.reviewCount} reviews)
                  </p>
                </div>
                <div className="tasko-card-actions">
                  <button type="button" onClick={() => navigate(buildServicePath(service))}>
                    View Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </UserPortalShell>
  );
}
