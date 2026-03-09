import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";
import {
  calculateServiceTotal,
  formatServicePrice,
  normalizeServiceDetail
} from "../utils/services";

export default function ServiceDetailsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const categorySlug = String(params.category || "").trim();
  const serviceSlug = String(params.serviceSlug || "").trim();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPricingOptionId, setSelectedPricingOptionId] = useState("");
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);

  useEffect(() => {
    const cacheKey = `service:detail:${categorySlug}:${serviceSlug}`;

    const loadService = async () => {
      const cached = readSessionCache(cacheKey, 5 * 60 * 1000);
      if (cached) {
        const normalized = normalizeServiceDetail(cached);
        setService(normalized);
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/services/${encodeURIComponent(categorySlug)}/${encodeURIComponent(serviceSlug)}`);
      writeSessionCache(cacheKey, response.data);
      setService(normalizeServiceDetail(response.data));
      setLoading(false);
    };

    loadService()
      .catch(() => {
        setService(null);
      })
      .finally(() => setLoading(false));
  }, [categorySlug, serviceSlug]);

  useEffect(() => {
    if (!service) return;
    setSelectedPricingOptionId((current) => current || service.pricingOptions[0]?.id || "");
    setSelectedAddonIds([]);
  }, [service]);

  const selectedPricingOption = useMemo(
    () => service?.pricingOptions.find((option) => option.id === selectedPricingOptionId) || service?.pricingOptions[0] || null,
    [selectedPricingOptionId, service]
  );

  const selectedAddons = useMemo(
    () => (service?.addons || []).filter((addon) => selectedAddonIds.includes(addon.id)),
    [selectedAddonIds, service]
  );

  const priceSummary = useMemo(
    () => calculateServiceTotal(selectedPricingOption, selectedAddons),
    [selectedAddons, selectedPricingOption]
  );

  const handleBookNow = () => {
    if (!service || !selectedPricingOption) return;

    const next = new URLSearchParams();
    next.set("serviceId", service.id);
    next.set("categorySlug", service.categorySlug);
    next.set("serviceSlug", service.slug);
    next.set("pricingOptionId", selectedPricingOption.id);
    if (selectedAddonIds.length > 0) {
      next.set("addonIds", selectedAddonIds.join(","));
    }
    next.set("totalPrice", String(priceSummary.totalPrice));

    navigate(`/booking?${next.toString()}`);
  };

  return (
    <UserPortalShell activeNav="home">
      <section className="tasko-page-header">
        <p>Service Details</p>
        <h1>{loading ? "Loading service..." : service?.name || "Service details unavailable"}</h1>
        <p>Review service scope, choose a pricing option, add extras, and continue to booking.</p>
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
              <p className="tasko-service-category-pill">{service.category}</p>
              <h2>{service.name}</h2>
              <p className="tasko-service-rating">
                ⭐ {service.rating.toFixed(1)} ({service.reviewCount} reviews)
              </p>
              <div className="tasko-service-details-meta">
                <div>
                  <span>Starting price</span>
                  <strong>{formatServicePrice(service.pricingOptions[0]?.price || service.basePrice)}</strong>
                </div>
                <div>
                  <span>Duration</span>
                  <strong>{service.duration || "Flexible"}</strong>
                </div>
              </div>
              <div className="tasko-card-actions">
                <button type="button" onClick={handleBookNow}>
                  Book Now
                </button>
                <button type="button" className="tasko-secondary-button" onClick={() => navigate(-1)}>
                  Back
                </button>
              </div>
            </div>

            <div className="tasko-service-details-media">
              {service.image ? (
                <img src={service.image} alt={service.name} className="tasko-service-details-image" />
              ) : (
                <div className="tasko-service-image-fallback">
                  <span>{service.category}</span>
                  <strong>{service.name}</strong>
                </div>
              )}
            </div>
          </section>

          <section className="tasko-content-panel">
            <div className="tasko-section-head">
              <p>Description</p>
              <h2>About this service</h2>
            </div>
            <p className="tasko-service-body-copy">{service.description}</p>
          </section>

          <section className="tasko-content-panel">
            <div className="tasko-section-head">
              <p>Pricing</p>
              <h2>Choose a pricing option</h2>
            </div>
            <div className="tasko-service-option-grid">
              {service.pricingOptions.map((option) => {
                const isSelected = option.id === selectedPricingOption?.id;
                return (
                  <label key={option.id} className={`tasko-service-option-card ${isSelected ? "is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="pricingOption"
                      value={option.id}
                      checked={isSelected}
                      onChange={() => setSelectedPricingOptionId(option.id)}
                    />
                    <div>
                      <div className="tasko-service-option-head">
                        <strong>{option.title}</strong>
                        <span>{formatServicePrice(option.price)}</span>
                      </div>
                      <p>{option.description || "Standard scope for this tier."}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="tasko-content-panel">
            <div className="tasko-section-head">
              <p>Add-ons</p>
              <h2>Optional extras</h2>
            </div>
            {service.addons.length === 0 ? (
              <p className="tasko-empty-state">No add-ons available for this service.</p>
            ) : (
              <div className="tasko-service-addon-list">
                {service.addons.map((addon) => {
                  const checked = selectedAddonIds.includes(addon.id);
                  return (
                    <label key={addon.id} className="tasko-service-addon-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedAddonIds((current) =>
                            checked ? current.filter((id) => id !== addon.id) : [...current, addon.id]
                          )
                        }
                      />
                      <div>
                        <div className="tasko-service-option-head">
                          <strong>{addon.title}</strong>
                          <span>+{formatServicePrice(addon.price)}</span>
                        </div>
                        <p>{addon.description || "Optional add-on for extra convenience."}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section className="tasko-service-details-grid">
            <section className="tasko-content-panel">
              <div className="tasko-section-head">
                <p>Included</p>
                <h2>What&apos;s included</h2>
              </div>
              <ul className="tasko-service-list">
                {service.includedServices.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="tasko-content-panel">
              <div className="tasko-section-head">
                <p>Not Included</p>
                <h2>What&apos;s not included</h2>
              </div>
              <ul className="tasko-service-list">
                {service.notIncludedServices.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </section>

          <section className="tasko-content-panel tasko-service-summary-panel">
            <div className="tasko-section-head">
              <p>Price Summary</p>
              <h2>Booking summary</h2>
            </div>
            <div className="tasko-service-summary-grid">
              <p>
                <span>Selected service price</span>
                <strong>{formatServicePrice(priceSummary.basePrice)}</strong>
              </p>
              <p>
                <span>Add-ons price</span>
                <strong>{formatServicePrice(priceSummary.addonsPrice)}</strong>
              </p>
              <p className="is-total">
                <span>Total price</span>
                <strong>{formatServicePrice(priceSummary.totalPrice)}</strong>
              </p>
            </div>
          </section>

          <div className="tasko-sticky-booking-bar">
            <div>
              <span>Total</span>
              <strong>{formatServicePrice(priceSummary.totalPrice)}</strong>
            </div>
            <button type="button" onClick={handleBookNow}>
              Book Now
            </button>
          </div>
        </>
      )}
    </UserPortalShell>
  );
}
