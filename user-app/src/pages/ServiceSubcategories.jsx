import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import { CategoryIcon, SearchIcon } from "../components/PortalIcons";
import { serviceCategories } from "./homeData";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeNames(items) {
  return Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
}

function toCategoryKey(value) {
  return normalizeText(value);
}

function guessIcon(categoryName) {
  const matched = serviceCategories.find((category) => toCategoryKey(category.name) === toCategoryKey(categoryName));
  return matched?.icon || "cleaning";
}

const fallbackSubcategoryCatalog = serviceCategories.reduce((acc, category) => {
  acc[category.name] = category.subcategories;
  return acc;
}, {});

export default function ServiceSubcategoriesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const selectedCategory = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    const loadServices = async () => {
      const response = await api.get("/api/services");
      const list = Array.isArray(response.data) ? response.data : [];
      setServices(list);
      setLoading(false);
    };

    loadServices()
      .catch(() => {
        setServices([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const availableCategories = useMemo(() => {
    const fromApi = dedupeNames(services.map((service) => service?.category));
    const fromCatalog = serviceCategories.map((category) => category.name);
    return dedupeNames([...fromCatalog, ...fromApi]);
  }, [services]);

  const subcategories = useMemo(() => {
    const grouped = new Map();

    services.forEach((service) => {
      const categoryName = String(service?.category || "").trim();
      const serviceName = String(service?.name || service?.category || "").trim();
      if (!categoryName || !serviceName) return;
      if (!grouped.has(categoryName)) {
        grouped.set(categoryName, []);
      }
      grouped.get(categoryName).push(serviceName);
    });

    const normalizedSelected = toCategoryKey(selectedCategory);
    const normalizedSearch = normalizeText(search);
    const normalizedGroups = Array.from(grouped.entries()).map(([categoryName, names]) => ({
      categoryName,
      names: dedupeNames(names)
    }));

    const fromApi = normalizedGroups
      .filter((group) => !normalizedSelected || toCategoryKey(group.categoryName) === normalizedSelected)
      .flatMap((group) => group.names.map((name) => ({ categoryName: group.categoryName, name })));

    const fromFallback = Object.entries(fallbackSubcategoryCatalog)
      .filter(([categoryName]) => !normalizedSelected || toCategoryKey(categoryName) === normalizedSelected)
      .flatMap(([categoryName, names]) => names.map((name) => ({ categoryName, name })));

    const merged = dedupeNames(
      [...fromApi, ...fromFallback].map((item) => `${item.categoryName}||${item.name}`)
    ).map((value) => {
      const [categoryName, name] = value.split("||");
      return { categoryName, name };
    });

    if (!normalizedSearch) {
      return merged;
    }

    return merged.filter((item) => normalizeText(`${item.categoryName} ${item.name}`).includes(normalizedSearch));
  }, [search, selectedCategory, services]);

  const pageTitle = selectedCategory ? `${selectedCategory} Subcategories` : "Service Subcategories";

  return (
    <UserPortalShell activeNav="home">
      <section className="tasko-page-header">
        <p>Service Discovery</p>
        <h1>{pageTitle}</h1>
        <p>Pick a subcategory and continue directly to booking.</p>
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
            <label htmlFor="subcat-search" className="sr-only">
              Search subcategories
            </label>
            <SearchIcon className="tasko-search-icon" />
            <input
              id="subcat-search"
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
              placeholder="Search subcategories"
            />
          </form>
        </div>

        {loading ? <p className="tasko-empty-state">Loading services...</p> : null}

        {!loading && subcategories.length === 0 ? (
          <p className="tasko-empty-state">No subcategories found for the selected filter.</p>
        ) : (
          <div className="tasko-subcategory-grid">
            {subcategories.map((item) => (
              <article key={`${item.categoryName}-${item.name}`} className="tasko-card">
                <span className="tasko-card-icon">
                  <CategoryIcon name={guessIcon(item.categoryName)} className="tasko-line-icon" />
                </span>
                <h3>{item.name}</h3>
                <p>{item.categoryName}</p>
                <button type="button" onClick={() => navigate(`/booking?category=${encodeURIComponent(item.name)}`)}>
                  Book Now
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </UserPortalShell>
  );
}

