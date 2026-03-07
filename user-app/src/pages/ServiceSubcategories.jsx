import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import { CategoryIcon, SearchIcon } from "../components/PortalIcons";
import { serviceCategories } from "./homeData";
import { flattenServiceCatalog, normalizeServiceCatalog, normalizeText, toCategoryKey } from "../utils/serviceCatalog";

function guessIcon(categoryName) {
  const matched = serviceCategories.find((category) => toCategoryKey(category.name) === toCategoryKey(categoryName));
  return matched?.icon || "cleaning";
}

export default function ServiceSubcategoriesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsItem, setDetailsItem] = useState(null);
  const selectedCategory = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    const loadCatalog = async () => {
      const response = await api.get("/api/service-catalog");
      setCatalog(normalizeServiceCatalog(response.data));
      setLoading(false);
    };

    loadCatalog()
      .catch(() => {
        setCatalog(normalizeServiceCatalog({}));
      })
      .finally(() => setLoading(false));
  }, []);

  const availableCategories = useMemo(() => catalog.map((category) => category.name).filter(Boolean), [catalog]);

  const subcategories = useMemo(() => {
    const normalizedSelected = toCategoryKey(selectedCategory);
    const normalizedSearch = normalizeText(search);

    return flattenServiceCatalog(catalog).filter((item) => {
      if (normalizedSelected && toCategoryKey(item.categoryName) !== normalizedSelected) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return normalizeText(`${item.categoryName} ${item.subCategoryName}`).includes(normalizedSearch);
    });
  }, [catalog, search, selectedCategory]);

  const pageTitle = selectedCategory ? `${selectedCategory} Subcategories` : "Service Subcategories";

  return (
    <UserPortalShell activeNav="home">
      <section className="tasko-page-header">
        <p>Service Discovery</p>
        <h1>{pageTitle}</h1>
        <p>Check pricing details first, then continue to booking with the exact service.</p>
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
              <article key={`${item.categoryId}-${item.subcategoryId || item.subCategoryName}`} className="tasko-card">
                <span className="tasko-card-icon">
                  <CategoryIcon name={guessIcon(item.categoryName)} className="tasko-line-icon" />
                </span>
                <h3>{item.subCategoryName}</h3>
                <p>{item.categoryName}</p>
                <p className="tasko-service-price">{item.priceSummary}</p>
                <div className="tasko-card-actions">
                  <button type="button" className="tasko-secondary-button" onClick={() => setDetailsItem(item)}>
                    View Details
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/booking?categoryId=${encodeURIComponent(item.categoryId)}&category=${encodeURIComponent(item.categoryName)}&subcategoryId=${encodeURIComponent(item.subcategoryId || "")}&subcategory=${encodeURIComponent(item.subCategoryName)}`
                      )
                    }
                  >
                    Book Now
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {detailsItem ? (
        <div className="tasko-modal-overlay" onClick={() => setDetailsItem(null)}>
          <div className="tasko-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="tasko-modal-head">
              <div>
                <p>Pricing Details</p>
                <h3>{detailsItem.subCategoryName}</h3>
              </div>
              <button type="button" className="tasko-secondary-button" onClick={() => setDetailsItem(null)}>
                Close
              </button>
            </div>
            <div className="tasko-modal-body">
              <p>
                <strong>Category:</strong> {detailsItem.categoryName}
              </p>
              <p>
                <strong>Price:</strong> {detailsItem.priceSummary}
              </p>
              <p>
                <strong>Pricing Model:</strong> {String(detailsItem.pricingType || "fixed").replace(/_/g, " ")}
              </p>
              <p>
                <strong>Notes:</strong> {detailsItem.pricingNotes || "No extra pricing note."}
              </p>
            </div>
            <div className="tasko-card-actions">
              <button type="button" className="tasko-secondary-button" onClick={() => setDetailsItem(null)}>
                Back
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/booking?categoryId=${encodeURIComponent(detailsItem.categoryId)}&category=${encodeURIComponent(detailsItem.categoryName)}&subcategoryId=${encodeURIComponent(detailsItem.subcategoryId || "")}&subcategory=${encodeURIComponent(detailsItem.subCategoryName)}`
                  )
                }
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </UserPortalShell>
  );
}
