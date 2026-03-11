import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import { CategoryIcon, SearchIcon } from "../components/PortalIcons";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";
import {
  buildServicePath,
  flattenServiceCatalog,
  guessServiceCategoryIcon,
  normalizeServiceCatalog,
  toCategoryKey
} from "../utils/serviceCatalog";

function pricingModelLabel(pricingModel) {
  return String(pricingModel || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ServiceSubcategoriesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const selectedCategory = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    const loadCatalog = async () => {
      const cached = readSessionCache("service-catalog:v2", 5 * 60 * 1000);
      if (cached) {
        setCatalogCategories(normalizeServiceCatalog({ categories: cached }));
        setLoading(false);
        return;
      }

      const response = await api.get("/api/service-catalog");
      const normalized = normalizeServiceCatalog(response.data);
      writeSessionCache("service-catalog:v2", normalized);
      setCatalogCategories(normalized);
      setLoading(false);
    };

    loadCatalog()
      .catch(() => {
        setCatalogCategories(normalizeServiceCatalog({}));
      })
      .finally(() => setLoading(false));
  }, []);

  const availableCategories = useMemo(
    () => catalogCategories.map((category) => category.name).filter(Boolean),
    [catalogCategories]
  );

  const services = useMemo(() => {
    const normalizedSearch = toCategoryKey(search);
    return flattenServiceCatalog(catalogCategories).filter((service) => {
      const matchesCategory =
        !selectedCategory || toCategoryKey(service.categoryName) === toCategoryKey(selectedCategory);
      const matchesSearch =
        !normalizedSearch ||
        toCategoryKey(`${service.subCategoryName} ${service.categoryName} ${service.description}`).includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [catalogCategories, search, selectedCategory]);

  return (
    <UserPortalShell activeNav="home">
      <section className="tasko-page-header">
        <p>Service Discovery</p>
        <h1>{selectedCategory ? `${selectedCategory} Services` : "Flexible Service Booking"}</h1>
        <p>Explore service-specific pricing models, choose how you want the service delivered, and continue to booking.</p>
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
                    if (isActive) {
                      next.delete("category");
                    } else {
                      next.set("category", categoryName);
                    }
                    setSearchParams(next);
                  }}
                >
                  {categoryName}
                </button>
              );
            })}
          </div>

          <form className="tasko-inline-search" onSubmit={(event) => event.preventDefault()}>
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
                if (event.target.value.trim()) {
                  next.set("search", event.target.value);
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
              <article key={service.subcategoryId} className="tasko-card tasko-service-card tasko-service-card-flexible">
                <span className="tasko-card-icon">
                  <CategoryIcon name={guessServiceCategoryIcon(service.categoryName)} className="tasko-line-icon" />
                </span>
                <div className="tasko-service-card-copy">
                  <div className="tasko-service-card-badges">
                    <span className="tasko-service-model-chip">{pricingModelLabel(service.pricingModel)}</span>
                    <span className={`tasko-service-model-chip is-${service.paymentFlow}`}>{service.paymentFlow}</span>
                  </div>
                  <h3>{service.subCategoryName}</h3>
                  <p>{service.categoryName}</p>
                  <p className="tasko-service-card-description">{service.description}</p>
                </div>
                <div className="tasko-service-card-meta">
                  <p className="tasko-service-price">{service.startingPriceLabel}</p>
                  <p>Bookable with live order summary</p>
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
