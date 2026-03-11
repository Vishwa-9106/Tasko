import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import UserPortalShell from "../components/UserPortalShell";
import OrderSummaryPanel from "../components/pricing/OrderSummaryPanel";
import PricingConfigurator from "../components/pricing/PricingConfigurator";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";
import {
  flattenServiceCatalog,
  normalizeServiceCatalog,
  normalizeText
} from "../utils/serviceCatalog";
import {
  buildSelectionSummary,
  calculatePricingSelection,
  createInitialSelection,
  formatRupee
} from "../utils/pricingModels";

const tabs = [
  { id: "current", label: "Current" },
  { id: "upcoming", label: "Upcoming" },
  { id: "old", label: "Old" }
];

const oldStatuses = new Set(["completed", "cancelled"]);

function formatTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function toStatusLabel(status) {
  const normalized = String(status || "pending")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return "Pending";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseBookingSlot(booking) {
  const rawDate = String(booking?.serviceDate || booking?.date || "").trim();
  const rawTime = String(booking?.preferredTimeSlot || booking?.time || "").trim();
  if (!rawDate) return null;

  const combined = rawTime ? `${rawDate}T${rawTime}` : rawDate;
  const parsed = new Date(combined);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(rawDate);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getBookingBucket(booking) {
  const status = String(booking?.status || "").toLowerCase();
  if (oldStatuses.has(status)) return "old";
  const slot = parseBookingSlot(booking);
  if (slot && slot.getTime() > Date.now()) return "upcoming";
  return "current";
}

function formatSlotDate(booking) {
  const slot = parseBookingSlot(booking);
  if (!slot) return booking?.serviceDate || booking?.date || "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(slot);
}

function formatSlotTime(booking) {
  const rawTime = String(booking?.preferredTimeSlot || booking?.time || "").trim();
  if (!rawTime) return "-";
  const parsed = new Date(`1970-01-01T${rawTime}`);
  if (Number.isNaN(parsed.getTime())) return rawTime;
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(parsed);
}

function buildSelectionFromQuery(searchParams, pricingModel, pricingConfig) {
  const defaults = createInitialSelection(pricingModel, pricingConfig);
  return {
    ...defaults,
    selectedPackage: searchParams.get("selectedPackageId") || defaults.selectedPackage,
    selectedUnits: Number(searchParams.get("selectedUnits") || defaults.selectedUnits || 1),
    selectedHours: Number(searchParams.get("selectedHours") || defaults.selectedHours || 2),
    selectedShift: searchParams.get("selectedShiftId") || defaults.selectedShift,
    selectedMeal: searchParams.get("selectedMealId") || defaults.selectedMeal,
    selectedAddons: (searchParams.get("selectedAddonIds") || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  };
}

export default function BookingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("current");
  const [submitting, setSubmitting] = useState(false);
  const [updatingBookingId, setUpdatingBookingId] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [bookingsMessage, setBookingsMessage] = useState("");
  const [bookingSuccessModal, setBookingSuccessModal] = useState(null);
  const [selection, setSelection] = useState({
    selectedPackage: "",
    selectedUnits: 1,
    selectedHours: 2,
    selectedShift: "",
    selectedMeal: "",
    selectedAddons: []
  });
  const [formData, setFormData] = useState({
    categoryId: searchParams.get("categoryId") || "",
    subcategoryId: searchParams.get("subcategoryId") || "",
    serviceDate: "",
    preferredTimeSlot: "",
    workDescription: "",
    specialInstructions: ""
  });

  useEffect(() => {
    const loadCatalog = async () => {
      const cached = readSessionCache("service-catalog:v2", 5 * 60 * 1000);
      if (cached) {
        setCatalogCategories(normalizeServiceCatalog({ categories: cached }));
        return;
      }

      const response = await api.get("/api/service-catalog");
      const normalized = normalizeServiceCatalog(response.data);
      writeSessionCache("service-catalog:v2", normalized);
      setCatalogCategories(normalized);
    };

    loadCatalog().catch(() => {
      setCatalogCategories(normalizeServiceCatalog({}));
    });
  }, []);

  const serviceCatalog = useMemo(() => flattenServiceCatalog(catalogCategories), [catalogCategories]);

  const selectedService = useMemo(
    () =>
      serviceCatalog.find(
        (entry) =>
          entry.subcategoryId === formData.subcategoryId ||
          (!formData.subcategoryId && normalizeText(entry.subCategoryName) === normalizeText(searchParams.get("subcategoryId")))
      ) || null,
    [formData.subcategoryId, searchParams, serviceCatalog]
  );

  useEffect(() => {
    if (!selectedService) {
      return;
    }
    setSelection(buildSelectionFromQuery(searchParams, selectedService.pricingModel, selectedService.pricingConfig));
  }, [searchParams, selectedService]);

  const calculation = useMemo(
    () =>
      selectedService
        ? calculatePricingSelection(selectedService.pricingModel, selectedService.pricingConfig, selection)
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
    [selectedService, selection]
  );

  const loadBookings = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!user?.uid) {
      setBookings([]);
      return;
    }

    const cacheKey = `bookings:user:${user.uid}`;
    const cached = forceRefresh ? null : readSessionCache(cacheKey, 30 * 1000);
    if (Array.isArray(cached)) {
      setBookings(cached);
      setBookingsLoading(false);
      return;
    }

    setBookingsLoading(true);
    setBookingsMessage("");
    try {
      const response = await api.get("/api/bookings", { params: { userId: user.uid, limit: 20 } });
      const nextBookings = Array.isArray(response.data) ? response.data : [];
      setBookings(nextBookings);
      writeSessionCache(cacheKey, nextBookings);
    } catch (_error) {
      setBookings([]);
      setBookingsMessage("Unable to load bookings right now.");
    } finally {
      setBookingsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadBookings().catch(() => {
      setBookings([]);
      setBookingsLoading(false);
      setBookingsMessage("Unable to load bookings right now.");
    });
  }, [loadBookings]);

  const categoryOptions = useMemo(
    () =>
      catalogCategories.map((category) => ({
        value: category.id,
        label: category.name
      })),
    [catalogCategories]
  );

  const subCategoryOptions = useMemo(
    () => serviceCatalog.filter((entry) => entry.categoryId === formData.categoryId),
    [formData.categoryId, serviceCatalog]
  );

  const bookingCounts = useMemo(
    () =>
      bookings.reduce(
        (acc, booking) => {
          acc[getBookingBucket(booking)] += 1;
          return acc;
        },
        { current: 0, upcoming: 0, old: 0 }
      ),
    [bookings]
  );

  const visibleBookings = useMemo(() => {
    const filtered = bookings.filter((booking) => getBookingBucket(booking) === activeTab);
    return [...filtered].sort((left, right) => {
      const leftTime = parseBookingSlot(left)?.getTime() || 0;
      const rightTime = parseBookingSlot(right)?.getTime() || 0;
      return activeTab === "upcoming" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [activeTab, bookings]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user || !selectedService) return;

    if (!formData.serviceDate || !formData.preferredTimeSlot) {
      setFormMessage("Please choose a service date and time slot.");
      return;
    }

    setSubmitting(true);
    setFormMessage("");

    try {
      await api.post("/api/bookings", {
        userId: user.uid,
        userName: user.displayName || "",
        userEmail: user.email || "",
        categoryId: selectedService.categoryId,
        subCategoryId: selectedService.subcategoryId,
        serviceCategory: selectedService.categoryName,
        subCategory: selectedService.subCategoryName,
        serviceDate: formData.serviceDate,
        preferredTimeSlot: formData.preferredTimeSlot,
        workDescription: formData.workDescription,
        specialInstructions: formData.specialInstructions,
        pricingModel: selectedService.pricingModel,
        selectedPackageId: selection.selectedPackage,
        selectedUnits: selection.selectedUnits,
        selectedHours: selection.selectedHours,
        selectedShiftId: selection.selectedShift,
        selectedMealId: selection.selectedMeal,
        selectedAddonIds: selection.selectedAddons
      });

      setBookingSuccessModal({
        title: "Booking Confirmed",
        message: `${selectedService.subCategoryName} booking was created successfully.`
      });
      setFormData((current) => ({
        ...current,
        serviceDate: "",
        preferredTimeSlot: "",
        workDescription: "",
        specialInstructions: ""
      }));
      await loadBookings({ forceRefresh: true });
      setActiveTab("upcoming");
    } catch (error) {
      setFormMessage(error?.response?.data?.message || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    setUpdatingBookingId(bookingId);
    try {
      await api.patch(`/api/bookings/${bookingId}/status`, { status: "cancelled" });
      await loadBookings({ forceRefresh: true });
    } catch (_error) {
      setBookingsMessage("Unable to cancel this booking right now.");
    } finally {
      setUpdatingBookingId("");
    }
  };

  return (
    <UserPortalShell activeNav="bookings">
      <section className="tasko-page-header">
        <p>Booking Workspace</p>
        <h1>Flexible Booking</h1>
        <p>Choose a service, configure its pricing model, and track every booking from one place.</p>
      </section>

      {bookingSuccessModal ? (
        <div
          className="tasko-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tasko-booking-success-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setBookingSuccessModal(null);
            }
          }}
        >
          <div className="tasko-modal-card tasko-success-modal-card">
            <div className="tasko-modal-head">
              <div>
                <p>Booking</p>
                <h3 id="tasko-booking-success-title">{bookingSuccessModal.title}</h3>
              </div>
            </div>
            <div className="tasko-modal-body">
              <p>{bookingSuccessModal.message}</p>
              <p>Your booking is now listed in the upcoming section.</p>
            </div>
            <div className="tasko-modal-actions">
              <button type="button" className="tasko-secondary-button" onClick={() => setBookingSuccessModal(null)}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setBookingSuccessModal(null);
                  setActiveTab("upcoming");
                }}
              >
                View Upcoming
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="tasko-content-panel">
        <div className="tasko-section-head">
          <p>Create</p>
          <h2>New Booking</h2>
        </div>

        <form className="tasko-booking-form" onSubmit={handleSubmit}>
          <label className="tasko-booking-field">
            <span>Service Category</span>
            <select
              value={formData.categoryId}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  categoryId: event.target.value,
                  subcategoryId: ""
                }))
              }
              required
            >
              <option value="">Select service category</option>
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="tasko-booking-field">
            <span>Sub Category</span>
            <select
              value={formData.subcategoryId}
              onChange={(event) => setFormData((current) => ({ ...current, subcategoryId: event.target.value }))}
              required
              disabled={!formData.categoryId}
            >
              <option value="">Select sub category</option>
              {subCategoryOptions.map((service) => (
                <option key={service.subcategoryId} value={service.subcategoryId}>
                  {service.subCategoryName}
                </option>
              ))}
            </select>
          </label>

          <label className="tasko-booking-field">
            <span>Service Date</span>
            <input
              type="date"
              min={formatTodayDate()}
              value={formData.serviceDate}
              onChange={(event) => setFormData((current) => ({ ...current, serviceDate: event.target.value }))}
              required
            />
          </label>

          <label className="tasko-booking-field">
            <span>Preferred Time Slot</span>
            <input
              type="time"
              value={formData.preferredTimeSlot}
              onChange={(event) => setFormData((current) => ({ ...current, preferredTimeSlot: event.target.value }))}
              required
            />
          </label>

          <label className="tasko-booking-field full">
            <span>Work Description</span>
            <textarea
              placeholder="Tell Tasko what needs to be done"
              value={formData.workDescription}
              onChange={(event) => setFormData((current) => ({ ...current, workDescription: event.target.value }))}
            />
          </label>

          <label className="tasko-booking-field full">
            <span>Special Instructions</span>
            <textarea
              placeholder="Any access notes, preferred approach, or special instructions"
              value={formData.specialInstructions}
              onChange={(event) => setFormData((current) => ({ ...current, specialInstructions: event.target.value }))}
            />
          </label>
        </form>

        {selectedService ? (
          <section className="tasko-service-pricing-layout">
            <div className="tasko-service-pricing-main">
              <div className="tasko-booking-service-summary">
                <div>
                  <p className="tasko-pricing-summary-label">Selected Service</p>
                  <h3>{selectedService.subCategoryName}</h3>
                  <p>{selectedService.categoryName}</p>
                  <p>{selectedService.paymentFlow === "postpaid" ? "Inspection and estimate approval" : "Prepaid booking"}</p>
                </div>
                <button type="button" className="tasko-secondary-button" onClick={() => navigate(`/services/${selectedService.categorySlug}/${selectedService.serviceSlug}`)}>
                  Open Detail Page
                </button>
              </div>

              <PricingConfigurator
                pricingModel={selectedService.pricingModel}
                pricingConfig={selectedService.pricingConfig}
                selection={selection}
                onSelectionChange={(patch) => setSelection((current) => ({ ...current, ...patch }))}
              />
            </div>

            <OrderSummaryPanel
              serviceName={selectedService.subCategoryName}
              pricingModel={selectedService.pricingModel}
              pricingConfig={selectedService.pricingConfig}
              calculation={calculation}
            />
          </section>
        ) : (
          <p className="tasko-empty-state">Select a category and sub category to configure pricing.</p>
        )}

        {selectedService ? (
          <div className="tasko-booking-actions-row">
            <button type="submit" className="tasko-booking-submit" onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? "Submitting..."
                : selectedService.pricingModel === "inspection"
                  ? "Book Inspection"
                  : "Confirm Booking"}
            </button>
          </div>
        ) : null}

        {formMessage ? <p className="tasko-empty-state">{formMessage}</p> : null}
      </section>

      <section className="tasko-content-panel">
        <div className="tasko-section-head">
          <p>History</p>
          <h2>Your Bookings</h2>
        </div>

        <div className="tasko-chip-row">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tasko-chip ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label} ({bookingCounts[tab.id]})
            </button>
          ))}
        </div>

        {bookingsLoading ? <p className="tasko-empty-state">Loading bookings...</p> : null}

        {!bookingsLoading && visibleBookings.length === 0 ? (
          <p className="tasko-empty-state">No bookings found in this section.</p>
        ) : (
          <div className="tasko-booking-grid">
            {visibleBookings.map((booking) => {
              const canCancel = !oldStatuses.has(String(booking.status || "").toLowerCase());
              const selectedPackageName = booking?.selectedPackage?.name || booking?.selectedPackageId || "-";
              const selectedMealName = booking?.selectedMeal?.name || booking?.selectedMealId || "-";
              const selectedShiftName = booking?.selectedShift?.name || booking?.selectedShiftId || "-";
              const pricingModel = String(booking.pricingModel || "").trim();
              return (
                <article key={booking.id} className="tasko-card tasko-booking-card">
                  <div className="tasko-booking-card-head">
                    <h3>{booking.subCategory || booking.category || "Service Booking"}</h3>
                    <span className={`tasko-booking-status is-${getBookingBucket(booking)}`}>
                      {toStatusLabel(booking.status)}
                    </span>
                  </div>

                  <div className="tasko-booking-meta-grid">
                    <p><strong>Category:</strong> {booking.serviceCategory || "-"}</p>
                    <p><strong>Date:</strong> {formatSlotDate(booking)}</p>
                    <p><strong>Time:</strong> {formatSlotTime(booking)}</p>
                    <p><strong>Pricing Model:</strong> {toStatusLabel(pricingModel)}</p>
                    <p><strong>Payment Status:</strong> {toStatusLabel(booking.paymentStatus || "pending")}</p>
                    <p><strong>Approval Status:</strong> {toStatusLabel(booking.approvalStatus || "not_required")}</p>
                    <p><strong>Total:</strong> {formatRupee(booking.finalPrice || booking.totalPrice || 0)}</p>
                    {pricingModel === "package" ? <p><strong>Package:</strong> {selectedPackageName}</p> : null}
                    {pricingModel === "per_unit" ? <p><strong>Units:</strong> {booking.selectedUnits || "-"}</p> : null}
                    {pricingModel === "time_based" ? <p><strong>Shift:</strong> {selectedShiftName}</p> : null}
                    {pricingModel === "time_based" ? <p><strong>Hours:</strong> {booking.selectedHours || "-"}</p> : null}
                    {pricingModel === "meal_based" ? <p><strong>Meal:</strong> {selectedMealName}</p> : null}
                    {pricingModel === "inspection" ? <p><strong>Visit Charge:</strong> {formatRupee(booking.visitCharge || 0)}</p> : null}
                    {pricingModel === "inspection" ? <p><strong>Worker Estimate:</strong> {booking.workerEstimate ? formatRupee(booking.workerEstimate) : "-"}</p> : null}
                  </div>

                  <p className="tasko-booking-notes">
                    <strong>Selection:</strong> {buildSelectionSummary(
                      pricingModel,
                      {
                        selectedPackage: booking.selectedPackage || null,
                        selectedUnits: booking.selectedUnits || null,
                        selectedHours: booking.selectedHours || null,
                        selectedShift: booking.selectedShift || null,
                        selectedMeal: booking.selectedMeal || null,
                        selectedAddons: Array.isArray(booking.selectedAddons) ? booking.selectedAddons : [],
                        basePrice: booking.finalPrice || booking.totalPrice || 0,
                        addonsPrice: booking.addonsPrice || 0,
                        visitCharge: booking.visitCharge || null,
                        finalPrice: booking.finalPrice || booking.totalPrice || 0
                      },
                      booking.pricingConfig || {}
                    )}
                  </p>

                  <p className="tasko-booking-notes">
                    <strong>Instructions:</strong> {booking.specialInstructions || booking.notes || "No special instructions."}
                  </p>

                  {canCancel ? (
                    <div className="tasko-booking-actions-row">
                      <button
                        type="button"
                        className="tasko-booking-cancel"
                        onClick={() => cancelBooking(booking.id)}
                        disabled={updatingBookingId === booking.id}
                      >
                        {updatingBookingId === booking.id ? "Cancelling..." : "Cancel Booking"}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {bookingsMessage ? <p className="tasko-empty-state">{bookingsMessage}</p> : null}
      </section>
    </UserPortalShell>
  );
}
