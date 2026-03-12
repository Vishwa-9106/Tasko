import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import UserPortalShell from "../components/UserPortalShell";
import { useAuth } from "../context/AuthContext";
import "./PackageSubscribe.css";

const steps = [
  { id: "package", label: "Package" },
  { id: "address", label: "Address" },
  { id: "schedule", label: "Schedule" },
  { id: "payment", label: "Payment" }
];

const timeSlotOptions = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" }
];

const paymentMethods = [
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "wallet", label: "Wallet" }
];

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
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

function formatFrequency(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "every_2_days") return "Every 2 Days";
  if (normalized === "daily") return "Daily";
  if (normalized === "weekly") return "Weekly";
  if (normalized === "monthly") return "Monthly";
  return "Flexible";
}

function formatTimeSlot(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "afternoon") return "Afternoon";
  if (normalized === "evening") return "Evening";
  return "Morning";
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePackage(record) {
  const details = Array.isArray(record?.service_details) ? record.service_details : [];
  const services = Array.isArray(record?.servicesIncluded || record?.services_included || record?.services)
    ? (record.servicesIncluded || record.services_included || record.services).map((item) => String(item || "").trim()).filter(Boolean)
    : details.map((item) => String(item?.sub_category_name || "").trim()).filter(Boolean);

  return {
    package_id: Number(record?.package_id || record?.id || 0),
    package_name: String(record?.package_name || record?.name || "Tasko Package").trim(),
    price: Number(record?.price || 0) || 0,
    duration_days: Number(record?.duration_days || record?.duration || 0) || 30,
    visit_frequency: String(record?.visit_frequency || record?.visitFrequency || "weekly").trim(),
    description: String(record?.description || "").trim(),
    services
  };
}

function normalizeAddress(entry, index) {
  return {
    id: String(entry?.id || `address-${index + 1}`).trim(),
    title: String(entry?.title || `Address ${index + 1}`).trim(),
    street: String(entry?.street || "").trim(),
    city: String(entry?.city || "").trim(),
    pincode: String(entry?.pincode || "").trim()
  };
}

export default function PackageSubscribePage() {
  const navigate = useNavigate();
  const { packageId } = useParams();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loadingPackage, setLoadingPackage] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [packageError, setPackageError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pkg, setPkg] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    title: "Home",
    street: "",
    city: "",
    pincode: ""
  });
  const [schedule, setSchedule] = useState({
    startDate: todayString(),
    timeSlot: "morning"
  });
  const [paymentMethod, setPaymentMethod] = useState("upi");

  useEffect(() => {
    const loadPackage = async () => {
      setLoadingPackage(true);
      setPackageError("");
      try {
        const response = await api.get(`/api/packages/${packageId}`);
        setPkg(normalizePackage(response.data || {}));
      } catch (error) {
        setPackageError(error?.response?.data?.message || "Failed to load package details.");
      } finally {
        setLoadingPackage(false);
      }
    };

    loadPackage().catch(() => {
      setPackageError("Failed to load package details.");
      setLoadingPackage(false);
    });
  }, [packageId]);

  useEffect(() => {
    if (!user?.uid) {
      setAddresses([]);
      setLoadingAddresses(false);
      return;
    }

    const loadAddresses = async () => {
      setLoadingAddresses(true);
      setAddressError("");
      try {
        const response = await api.get(`/api/users/${user.uid}/addresses`);
        const nextAddresses = Array.isArray(response.data?.addresses)
          ? response.data.addresses.map((entry, index) => normalizeAddress(entry, index))
          : [];
        setAddresses(nextAddresses);
        if (nextAddresses.length > 0) {
          setSelectedAddressId(nextAddresses[0].id);
        } else {
          setIsAddingAddress(true);
        }
      } catch (error) {
        setAddressError(error?.response?.data?.message || "Failed to load saved addresses.");
      } finally {
        setLoadingAddresses(false);
      }
    };

    loadAddresses().catch(() => {
      setAddressError("Failed to load saved addresses.");
      setLoadingAddresses(false);
    });
  }, [user?.uid]);

  const selectedAddress = useMemo(
    () => addresses.find((item) => item.id === selectedAddressId) || null,
    [addresses, selectedAddressId]
  );

  const canContinue = useMemo(() => {
    if (currentStep === 0) return Boolean(pkg);
    if (currentStep === 1) return Boolean(selectedAddress);
    if (currentStep === 2) return Boolean(schedule.startDate && schedule.timeSlot);
    return Boolean(paymentMethod && selectedAddress && schedule.startDate);
  }, [currentStep, paymentMethod, pkg, schedule.startDate, schedule.timeSlot, selectedAddress]);

  const addNewAddress = async () => {
    if (!user?.uid) return;
    if (!newAddress.title.trim() || !newAddress.street.trim() || !newAddress.city.trim() || !newAddress.pincode.trim()) {
      setAddressError("Title, street, city and pincode are required.");
      return;
    }

    setAddressError("");
    try {
      const response = await api.post(`/api/users/${user.uid}/addresses`, newAddress);
      const nextAddress = normalizeAddress(response.data?.address || newAddress, addresses.length);
      const nextAddresses = Array.isArray(response.data?.addresses)
        ? response.data.addresses.map((entry, index) => normalizeAddress(entry, index))
        : [...addresses, nextAddress];
      setAddresses(nextAddresses);
      setSelectedAddressId(nextAddress.id);
      setIsAddingAddress(false);
      setNewAddress({
        title: "Home",
        street: "",
        city: "",
        pincode: ""
      });
    } catch (error) {
      setAddressError(error?.response?.data?.message || "Failed to save address.");
    }
  };

  const goNext = () => {
    if (!canContinue || currentStep >= steps.length - 1) return;
    setCurrentStep((value) => value + 1);
  };

  const goBack = () => {
    if (currentStep <= 0) return;
    setCurrentStep((value) => value - 1);
  };

  const confirmSubscription = async () => {
    if (!user?.uid || !pkg || !selectedAddress) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await api.post("/api/package-subscriptions", {
        userId: user.uid,
        packageId: pkg.package_id,
        addressId: selectedAddress.id,
        addressTitle: selectedAddress.title,
        street: selectedAddress.street,
        city: selectedAddress.city,
        pincode: selectedAddress.pincode,
        startDate: schedule.startDate,
        timeSlot: schedule.timeSlot,
        paymentMethod
      });
      const subscription = response.data?.subscription;
      navigate(`/subscribe/success/${subscription?.id || subscription?.user_package_id}`, {
        replace: true,
        state: {
          subscription,
          packageName: pkg.package_name
        }
      });
    } catch (error) {
      setSubmitError(error?.response?.data?.message || "Failed to confirm package subscription.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <UserPortalShell activeNav="packages">
      <section className="tasko-page-header">
        <p>Subscription</p>
        <h1>Subscribe to Package</h1>
        <p>Complete your package subscription in a few guided steps.</p>
      </section>

      <section className="tasko-subscribe-layout">
        <div className="tasko-subscribe-main">
          <div className="tasko-subscribe-steps">
            {steps.map((step, index) => (
              <div key={step.id} className={`tasko-subscribe-step ${index === currentStep ? "is-active" : index < currentStep ? "is-complete" : ""}`}>
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
              </div>
            ))}
          </div>

          <article className="tasko-content-panel">
            {currentStep === 0 ? (
              <>
                <div className="tasko-section-head">
                  <p>Step 1</p>
                  <h2>Package Details</h2>
                </div>
                {loadingPackage ? <p className="tasko-empty-state">Loading package details...</p> : null}
                {!loadingPackage && packageError ? <p className="tasko-empty-state">{packageError}</p> : null}
                {!loadingPackage && pkg ? (
                  <div className="tasko-subscribe-package-card">
                    <div>
                      <p className="tasko-package-frequency">{formatFrequency(pkg.visit_frequency)} visits</p>
                      <h3>{pkg.package_name}</h3>
                      <p>{pkg.description}</p>
                    </div>
                    <div>
                      <p className="tasko-package-price">{formatPrice(pkg.price)}</p>
                      <p className="tasko-package-duration-badge">{pkg.duration_days} Days</p>
                    </div>
                    <div className="tasko-subscribe-chip-row">
                      {pkg.services.map((service) => (
                        <span key={service} className="tasko-subscribe-chip">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {currentStep === 1 ? (
              <>
                <div className="tasko-section-head">
                  <p>Step 2</p>
                  <h2>Select Address</h2>
                </div>
                {loadingAddresses ? <p className="tasko-empty-state">Loading saved addresses...</p> : null}
                {!loadingAddresses && addressError ? <p className="tasko-empty-state">{addressError}</p> : null}
                {!loadingAddresses ? (
                  <div className="tasko-subscribe-address-grid">
                    {addresses.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        className={`tasko-subscribe-address-card ${selectedAddressId === address.id ? "is-selected" : ""}`}
                        onClick={() => setSelectedAddressId(address.id)}
                      >
                        <strong>{address.title}</strong>
                        <span>{address.street}</span>
                        <span>{address.city || "-"}</span>
                        <span>{address.pincode || "-"}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {!loadingAddresses && (isAddingAddress || addresses.length === 0) ? (
                  <div className="tasko-subscribe-form-card">
                    <h3>Add New Address</h3>
                    <div className="tasko-subscribe-form-grid">
                      <input value={newAddress.title} onChange={(event) => setNewAddress((current) => ({ ...current, title: event.target.value }))} placeholder="Home / Office" />
                      <input value={newAddress.street} onChange={(event) => setNewAddress((current) => ({ ...current, street: event.target.value }))} placeholder="Street address" />
                      <input value={newAddress.city} onChange={(event) => setNewAddress((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
                      <input value={newAddress.pincode} onChange={(event) => setNewAddress((current) => ({ ...current, pincode: event.target.value }))} placeholder="Pincode" />
                    </div>
                    <div className="tasko-subscribe-inline-actions">
                      <button type="button" onClick={addNewAddress}>Save Address</button>
                      {addresses.length > 0 ? (
                        <button type="button" className="tasko-secondary-button" onClick={() => setIsAddingAddress(false)}>
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <button type="button" className="tasko-secondary-button" onClick={() => setIsAddingAddress(true)}>
                    Add New Address
                  </button>
                )}
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                <div className="tasko-section-head">
                  <p>Step 3</p>
                  <h2>Schedule Service</h2>
                </div>
                <div className="tasko-subscribe-form-grid">
                  <label>
                    <span>Start Date</span>
                    <input
                      type="date"
                      min={todayString()}
                      value={schedule.startDate}
                      onChange={(event) => setSchedule((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Preferred Time Slot</span>
                    <select value={schedule.timeSlot} onChange={(event) => setSchedule((current) => ({ ...current, timeSlot: event.target.value }))}>
                      {timeSlotOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                <div className="tasko-section-head">
                  <p>Step 4</p>
                  <h2>Payment & Confirmation</h2>
                </div>
                <div className="tasko-subscribe-payment-list">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      className={`tasko-subscribe-payment-card ${paymentMethod === method.value ? "is-selected" : ""}`}
                      onClick={() => setPaymentMethod(method.value)}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
                {submitError ? <p className="tasko-empty-state">{submitError}</p> : null}
              </>
            ) : null}

            <div className="tasko-subscribe-actions">
              <button type="button" className="tasko-secondary-button" onClick={() => navigate("/packages")}>
                Cancel
              </button>
              {currentStep > 0 ? (
                <button type="button" className="tasko-secondary-button" onClick={goBack}>
                  Back
                </button>
              ) : null}
              {currentStep < steps.length - 1 ? (
                <button type="button" onClick={goNext} disabled={!canContinue || loadingPackage || loadingAddresses}>
                  Continue
                </button>
              ) : (
                <button type="button" onClick={confirmSubscription} disabled={!canContinue || submitting}>
                  {submitting ? "Processing..." : "Confirm & Pay"}
                </button>
              )}
            </div>
          </article>
        </div>

        <aside className="tasko-content-panel tasko-subscribe-summary">
          <div className="tasko-section-head">
            <p>Summary</p>
            <h2>Order Summary</h2>
          </div>
          <div className="tasko-subscribe-summary-list">
            <div>
              <span>Package</span>
              <strong>{pkg?.package_name || "-"}</strong>
            </div>
            <div>
              <span>Price</span>
              <strong>{formatPrice(pkg?.price || 0)}</strong>
            </div>
            <div>
              <span>Selected Address</span>
              <strong>{selectedAddress ? `${selectedAddress.title}, ${selectedAddress.street}` : "-"}</strong>
            </div>
            <div>
              <span>Start Date</span>
              <strong>{formatDate(schedule.startDate)}</strong>
            </div>
            <div>
              <span>Time Slot</span>
              <strong>{formatTimeSlot(schedule.timeSlot)}</strong>
            </div>
            <div>
              <span>Payment Method</span>
              <strong>{paymentMethod.toUpperCase()}</strong>
            </div>
          </div>
        </aside>
      </section>
    </UserPortalShell>
  );
}
