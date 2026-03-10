import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import OrderSummaryPanel from "../components/pricing/OrderSummaryPanel";
import PricingConfigurator from "../components/pricing/PricingConfigurator";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";
import {
  flattenServiceCatalog,
  normalizeServiceCatalog
} from "../utils/serviceCatalog";
import {
  buildStartingPriceLabel,
  calculatePricingSelection,
  createInitialSelection,
  formatRupee,
  normalizeText
} from "../utils/pricingModels";

function findService(catalog, categorySlug, serviceSlug) {
  const services = flattenServiceCatalog(catalog);
  return (
    services.find((entry) => {
      const matchesCategory =
        normalizeText(entry.categorySlug) === normalizeText(categorySlug) ||
        normalizeText(entry.categoryId) === normalizeText(categorySlug) ||
        normalizeText(entry.categoryName) === normalizeText(categorySlug);
      const matchesService =
        normalizeText(entry.serviceSlug) === normalizeText(serviceSlug) ||
        normalizeText(entry.subcategoryId) === normalizeText(serviceSlug) ||
        normalizeText(entry.subCategoryName) === normalizeText(serviceSlug);
      return matchesCategory && matchesService;
    }) || null
  );
}

export default function ServiceDetailsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const categorySlug = String(params.category || "").trim();
  const serviceSlug = String(params.serviceSlug || "").trim();
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState({
    selectedPackage: "",
    selectedUnits: 1,
    selectedHours: 2,
    selectedShift: "",
    selectedMeal: "",
    selectedAddons: []
  });

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

  const service = useMemo(
    () => findService(catalogCategories, categorySlug, serviceSlug),
    [catalogCategories, categorySlug, serviceSlug]
  );

  useEffect(() => {
    if (!service) {
      return;
    }
    setSelection(createInitialSelection(service.pricingModel, service.pricingConfig));
  }, [service]);

  const calculation = useMemo(
    () =>
      service
        ? calculatePricingSelection(service.pricingModel, service.pricingConfig, selection)
        : {
            selectedPackage: null,
            selectedUnits: null,
            selectedHours: null,
            selectedShift: null,
            selectedMeal: null,
            selectedAddons: [],
            basePrice: 0,
            addonsPrice: 0,
            visitCharge: null,
            finalPrice: 0
          },
    [selection, service]
  );

  const handleBookNow = () => {
    if (!service) return;

    const next = new URLSearchParams();
    next.set("categoryId", service.categoryId);
    next.set("subcategoryId", service.subcategoryId);
    if (selection.selectedPackage) next.set("selectedPackageId", selection.selectedPackage);
    if (selection.selectedUnits) next.set("selectedUnits", String(selection.selectedUnits));
    if (selection.selectedHours) next.set("selectedHours", String(selection.selectedHours));
    if (selection.selectedShift) next.set("selectedShiftId", selection.selectedShift);
    if (selection.selectedMeal) next.set("selectedMealId", selection.selectedMeal);
    if (selection.selectedAddons.length > 0) next.set("selectedAddonIds", selection.selectedAddons.join(","));
    navigate(`/booking?${next.toString()}`);
  };

  return (
    <UserPortalShell activeNav="home">
      <section className="tasko-page-header">
        <p>Service Details</p>
        <h1>{loading ? "Loading service..." : service?.subCategoryName || "Service details unavailable"}</h1>
        <p>Choose the pricing model that fits the job, review the live order summary, and continue to booking.</p>
      </section>

      {loading ? (
        <section className="tasko-content-panel">
          <p className="tasko-empty-state">Loading service details...</p>
        </section>
      ) : !service ? (
        <section className="tasko-content-panel">
          <p className="tasko-empty-state">We could not load this service right now.</p>
        </section>
      ) : (
        <>
          <section className="tasko-content-panel tasko-service-details-hero">
            <div className="tasko-service-details-copy">
              <p className="tasko-service-category-pill">{service.categoryName}</p>
              <h2>{service.subCategoryName}</h2>
              <p className="tasko-service-rating">4.8 Tasko rating</p>
              <div className="tasko-service-details-meta">
                <div>
                  <span>Starting price</span>
                  <strong>{buildStartingPriceLabel(service.pricingModel, service.pricingConfig)}</strong>
                </div>
                <div>
                  <span>Payment flow</span>
                  <strong>{service.paymentFlow === "postpaid" ? "Inspection first" : "Pay during booking"}</strong>
                </div>
              </div>
              <p className="tasko-service-body-copy">{service.description}</p>
              <div className="tasko-card-actions">
                <button type="button" onClick={handleBookNow}>
                  Book Now
                </button>
                <button type="button" className="tasko-secondary-button" onClick={() => navigate(-1)}>
                  Back
                </button>
              </div>
            </div>

            <div className="tasko-service-details-media tasko-service-highlight-card">
              <p>Pricing Model</p>
              <h3>{String(service.pricingModel).replace(/_/g, " ")}</h3>
              <p>{service.paymentFlow === "postpaid" ? "Inspection and approval workflow" : "Instant price calculation"}</p>
            </div>
          </section>

          <section className="tasko-service-pricing-layout">
            <div className="tasko-service-pricing-main">
              <PricingConfigurator
                pricingModel={service.pricingModel}
                pricingConfig={service.pricingConfig}
                selection={selection}
                onSelectionChange={(patch) => setSelection((current) => ({ ...current, ...patch }))}
              />
            </div>

            <OrderSummaryPanel
              serviceName={service.subCategoryName}
              pricingModel={service.pricingModel}
              pricingConfig={service.pricingConfig}
              calculation={calculation}
              actionLabel={service.pricingModel === "inspection" ? "Book Inspection" : "Continue to Booking"}
              onAction={handleBookNow}
            />
          </section>

          <div className="tasko-sticky-booking-bar">
            <div>
              <span>Total</span>
              <strong>{formatRupee(calculation.finalPrice || 0)}</strong>
            </div>
            <button type="button" onClick={handleBookNow}>
              {service.pricingModel === "inspection" ? "Book Inspection" : "Book Now"}
            </button>
          </div>
        </>
      )}
    </UserPortalShell>
  );
}
