import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { loadClientMapConfig, loadGoogleMapsApi } from "../utils/googleMaps";

const tabs = [
  { id: "current", label: "Current" },
  { id: "upcoming", label: "Upcoming" },
  { id: "old", label: "Old" }
];

const oldStatuses = new Set(["completed", "cancelled"]);
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 0
};
const GEOLOCATION_TARGET_ACCURACY = 20;
const GEOLOCATION_ACCEPTABLE_ACCURACY = 50;
const GEOLOCATION_REQUIRED_ACCURACY = 120;
const GEOLOCATION_SAMPLE_TIMEOUT_MS = 20000;
const DEFAULT_MAP_CENTER = {
  lat: 20.5937,
  lng: 78.9629
};
const DEFAULT_MAP_ZOOM = 5;
const LOCATION_MAP_ZOOM = 17;
const LOCATION_NUDGE_STEP = 0.0001;

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

function getLocationAccuracyValue(position) {
  const accuracy = Number(position?.coords?.accuracy);
  return Number.isFinite(accuracy) ? accuracy : Number.POSITIVE_INFINITY;
}

function isAccurateEnough(position) {
  const accuracy = getLocationAccuracyValue(position);
  return accuracy <= GEOLOCATION_TARGET_ACCURACY;
}

function isBetterLocationSample(nextPosition, bestPosition) {
  if (!bestPosition) {
    return true;
  }

  const nextAccuracy = getLocationAccuracyValue(nextPosition);
  const currentAccuracy = getLocationAccuracyValue(bestPosition);
  if (nextAccuracy !== currentAccuracy) {
    return nextAccuracy < currentAccuracy;
  }

  return Number(nextPosition?.timestamp || 0) > Number(bestPosition?.timestamp || 0);
}

function createGeolocationTimeoutError() {
  const timeoutError = new Error("Location request timed out. Please try again.");
  timeoutError.code = 3;
  return timeoutError;
}

function getBrowserLocation(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }

    let bestPosition = null;
    let settled = false;
    let watchId = null;
    let lastError = null;
    let timeoutId = null;

    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      callback();
    };

    const handleSuccess = (position) => {
      if (settled) {
        return;
      }

      if (isBetterLocationSample(position, bestPosition)) {
        bestPosition = position;
      }

      if (isAccurateEnough(position)) {
        finish(() => resolve(bestPosition || position));
      }
    };

    const handleError = (error) => {
      if (settled) {
        return;
      }

      if (error?.code === 1) {
        finish(() => reject(error));
        return;
      }

      lastError = error;
    };

    timeoutId = window.setTimeout(() => {
      if (bestPosition) {
        finish(() => resolve(bestPosition));
        return;
      }

      finish(() => reject(lastError || createGeolocationTimeoutError()));
    }, Math.max(Number(options?.timeout) || 0, GEOLOCATION_SAMPLE_TIMEOUT_MS));

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
    watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
  });
}

function buildReverseGeocodeCacheKey(latitude, longitude) {
  return `reverse-geocode:${Number(latitude).toFixed(5)}:${Number(longitude).toFixed(5)}`;
}

function buildForwardGeocodeCacheKey(address) {
  return `forward-geocode:${normalizeText(address).toLowerCase()}`;
}

function createLocationState(overrides = {}) {
  return {
    address: "",
    formattedAddress: "",
    latitude: null,
    longitude: null,
    accuracy: null,
    capturedAt: "",
    manuallyAdjusted: false,
    ...overrides
  };
}

function hasCoordinates(location) {
  return Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));
}

function getGeolocationErrorMessage(error) {
  if (!error || typeof error !== "object") {
    return "Unable to access your location right now.";
  }

  if (error.code === 1) {
    return "Location permission was denied. Enable it to use your current location.";
  }
  if (error.code === 2) {
    return "Your location could not be determined. Try again in an open area.";
  }
  if (error.code === 3) {
    return "Location request timed out. Please try again.";
  }
  return error.message || "Unable to access your location right now.";
}

function formatLocationAccuracy(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))} m` : "-";
}

function getLocationAccuracyState(value, manuallyAdjusted = false) {
  if (manuallyAdjusted) {
    return {
      label: "Manual pin",
      tone: "info",
      detail: "Adjusted on the map"
    };
  }
  const accuracy = Number(value);
  if (!Number.isFinite(accuracy)) {
    return {
      label: "Accuracy unavailable",
      tone: "neutral",
      detail: "Capture live location to see GPS precision."
    };
  }
  if (accuracy <= 30) {
    return {
      label: "High accuracy",
      tone: "success",
      detail: `Within about ${Math.round(accuracy)} m`
    };
  }
  if (accuracy <= 150) {
    return {
      label: "Approximate",
      tone: "info",
      detail: `Within about ${Math.round(accuracy)} m`
    };
  }
  if (accuracy <= 1000) {
    return {
      label: "Low accuracy",
      tone: "warning",
      detail: `Within about ${Math.round(accuracy)} m`
    };
  }
  return {
    label: "Very low accuracy",
    tone: "danger",
    detail: `Within about ${(accuracy / 1000).toFixed(1)} km`
  };
}

function formatLocationCapturedAt(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function formatCoordinateAddress(latitude, longitude) {
  return `Lat ${Number(latitude).toFixed(6)}, Lng ${Number(longitude).toFixed(6)}`;
}

function clampLatitude(value) {
  return Math.max(-90, Math.min(90, Number(value)));
}

function clampLongitude(value) {
  return Math.max(-180, Math.min(180, Number(value)));
}

function formatCoordinateInput(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(6) : "";
}

function buildGoogleMapsUrl({ address, latitude, longitude }) {
  const hasCoordinates = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const query = hasCoordinates ? `${latitude},${longitude}` : String(address || "").trim();
  if (!query) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
}

function buildGoogleMapsEmbedUrl({ address, latitude, longitude, zoom = LOCATION_MAP_ZOOM }) {
  const hasCoordinates = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const query = hasCoordinates ? `${latitude},${longitude}` : String(address || "").trim();
  if (!query) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${encodeURIComponent(
    String(zoom)
  )}&output=embed`;
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
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locationMessageTone, setLocationMessageTone] = useState("neutral");
  const [savedAddress, setSavedAddress] = useState("");
  const [savedAddressLoading, setSavedAddressLoading] = useState(false);
  const [locationSource, setLocationSource] = useState("saved");
  const [mapStatus, setMapStatus] = useState("idle");
  const [mapError, setMapError] = useState("");
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const [adjustLocationMode, setAdjustLocationMode] = useState(false);
  const [adjustLatitude, setAdjustLatitude] = useState("");
  const [adjustLongitude, setAdjustLongitude] = useState("");
  const [currentLocation, setCurrentLocation] = useState(createLocationState());
  const [savedLocation, setSavedLocation] = useState(createLocationState());
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapLibraryRef = useRef(null);
  const markerRef = useRef(null);
  const mapClickListenerRef = useRef(null);
  const markerDragListenerRef = useRef(null);
  const reverseGeocodeRequestsRef = useRef(new Map());
  const forwardGeocodeRequestsRef = useRef(new Map());
  const initialLocationRequestedRef = useRef(false);
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

  useEffect(() => {
    if (!user?.uid) {
      setSavedAddress("");
      return;
    }

    let isMounted = true;

    const hydrateSavedAddress = async () => {
      const cacheKey = `profile:${user.uid}`;
      const cached = readSessionCache(cacheKey, 30 * 1000);
      if (cached && typeof cached === "object") {
        if (isMounted) {
          setSavedAddress(String(cached.address || "").trim());
        }
        return;
      }

      setSavedAddressLoading(true);
      try {
        const response = await api.get("/api/users", {
          params: { userId: user.uid }
        });
        const users = Array.isArray(response.data) ? response.data : [];
        const current = users.find((entry) => entry.id === user.uid || entry.uid === user.uid) || {};
        const nextProfile = {
          name: current.name || user.displayName || "",
          mobile: current.number || current.mobile || "",
          email: current.mail || current.email || user.email || "",
          address: String(current.address || "").trim()
        };
        if (!isMounted) return;
        setSavedAddress(nextProfile.address);
        writeSessionCache(cacheKey, nextProfile);
      } catch (_error) {
        if (isMounted) {
          setSavedAddress("");
        }
      } finally {
        if (isMounted) {
          setSavedAddressLoading(false);
        }
      }
    };

    hydrateSavedAddress().catch(() => {
      if (isMounted) {
        setSavedAddress("");
        setSavedAddressLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.displayName, user?.email, user?.uid]);

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

  const resolveCoordinatesToAddress = useCallback(async (latitude, longitude, fallbackAddress = "") => {
    const normalizedLatitude = Number(Number(latitude).toFixed(6));
    const normalizedLongitude = Number(Number(longitude).toFixed(6));
    const cacheKey = buildReverseGeocodeCacheKey(normalizedLatitude, normalizedLongitude);
    const cachedAddress = readSessionCache(cacheKey, 12 * 60 * 60 * 1000);
    if (typeof cachedAddress === "string" && cachedAddress.trim()) {
      return cachedAddress.trim();
    }

    const existingRequest = reverseGeocodeRequestsRef.current.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    const fallbackResult = String(
      fallbackAddress || formatCoordinateAddress(normalizedLatitude, normalizedLongitude)
    ).trim();
    const request = api
      .post("/api/location/reverse-geocode", {
        latitude: normalizedLatitude,
        longitude: normalizedLongitude
      })
      .then((response) => {
        const resolvedAddress = String(response.data?.address || "").trim();
        if (resolvedAddress) {
          writeSessionCache(cacheKey, resolvedAddress);
          return resolvedAddress;
        }
        return fallbackResult;
      })
      .catch(() => fallbackResult)
      .finally(() => {
        reverseGeocodeRequestsRef.current.delete(cacheKey);
      });

    reverseGeocodeRequestsRef.current.set(cacheKey, request);
    return request;
  }, []);

  const applyLocationSelection = useCallback(
    async ({
      source,
      latitude,
      longitude,
      accuracy = null,
      capturedAt = new Date().toISOString(),
      manuallyAdjusted = false,
      fallbackAddress = ""
    }) => {
      const normalizedLatitude = Number(Number(latitude).toFixed(6));
      const normalizedLongitude = Number(Number(longitude).toFixed(6));
      const resolvedAddress = await resolveCoordinatesToAddress(
        normalizedLatitude,
        normalizedLongitude,
        fallbackAddress
      );
      const nextLocation = createLocationState({
        address: resolvedAddress,
        formattedAddress: resolvedAddress,
        latitude: normalizedLatitude,
        longitude: normalizedLongitude,
        accuracy,
        capturedAt,
        manuallyAdjusted
      });

      if (source === "current") {
        setCurrentLocation(nextLocation);
      } else {
        setSavedLocation(nextLocation);
      }
      setLocationSource(source);
      setLocationError("");
      return nextLocation;
    },
    [resolveCoordinatesToAddress]
  );

  const handleManualCoordinateSelection = useCallback(
    async (latitude, longitude) => {
      const source = locationSource === "current" ? "current" : "saved";
      const fallbackAddress =
        source === "current"
          ? currentLocation.formattedAddress || currentLocation.address
          : savedLocation.formattedAddress || savedLocation.address || savedAddress;
      const fallbackAccuracy = source === "current" ? currentLocation.accuracy : null;

      await applyLocationSelection({
        source,
        latitude,
        longitude,
        accuracy: fallbackAccuracy,
        manuallyAdjusted: true,
        fallbackAddress
      });
      setLocationMessage("Location updated. The adjusted map pin will be saved with this booking.");
      setLocationMessageTone("success");
    },
    [
      applyLocationSelection,
      currentLocation.accuracy,
      currentLocation.address,
      currentLocation.formattedAddress,
      locationSource,
      savedAddress,
      savedLocation.address,
      savedLocation.formattedAddress
    ]
  );

  const useCurrentLocation = useCallback(
    async ({ automatic = false } = {}) => {
      setLocationLoading(true);
      setLocationError("");
      if (!automatic) {
        setLocationMessage("");
        setLocationMessageTone("neutral");
      }

      try {
        const position = await getBrowserLocation(GEOLOCATION_OPTIONS);
        const latitude = Number(Number(position.coords.latitude).toFixed(6));
        const longitude = Number(Number(position.coords.longitude).toFixed(6));
        const accuracy = Number.isFinite(Number(position.coords.accuracy))
          ? Math.round(Number(position.coords.accuracy))
          : null;

        await applyLocationSelection({
          source: "current",
          latitude,
          longitude,
          accuracy,
          manuallyAdjusted: false
        });
        setAdjustLocationMode(false);
        if (Number.isFinite(accuracy) && accuracy > GEOLOCATION_REQUIRED_ACCURACY) {
          setLocationMessage(
            `Live location captured, but GPS accuracy is still very low at about ${
              accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${Math.round(accuracy)} m`
            }. Refresh again in an open area or adjust the location manually.`
          );
          setLocationMessageTone("warning");
        } else if (Number.isFinite(accuracy) && accuracy > GEOLOCATION_ACCEPTABLE_ACCURACY) {
          setLocationMessage("Live location captured, but GPS accuracy is still approximate. Refresh once more or fine-tune the point if needed.");
          setLocationMessageTone("warning");
        } else {
          setLocationMessage("Current GPS location captured. Drag the pin if the entrance point needs correction.");
          setLocationMessageTone("success");
        }
      } catch (error) {
        const nextError = getGeolocationErrorMessage(error);
        setLocationError(nextError);
        setAdjustLocationMode(mapStatus === "ready");
        setLocationMessage(
          mapStatus === "ready"
            ? "Allow location access for GPS accuracy, or adjust the service point manually on the map."
            : "Allow location access for GPS accuracy, or use your saved address for this booking."
        );
        setLocationMessageTone("warning");
      } finally {
        setLocationLoading(false);
      }
    },
    [applyLocationSelection, mapStatus]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    if (locationLoading) return;
    if (hasCoordinates(currentLocation) && locationSource !== "current") {
      setLocationSource("current");
      setLocationError("");
      setLocationMessage("Using the most recently captured GPS location for this booking.");
      setLocationMessageTone("info");
      return;
    }
    await useCurrentLocation();
  }, [currentLocation, locationLoading, locationSource, useCurrentLocation]);

  const handleUseSavedLocation = useCallback(() => {
    if (!savedAddress && !hasCoordinates(savedLocation)) {
      setLocationError("Add a saved address in Profile or use your current location to place the service pin.");
      return;
    }

    setLocationSource("saved");
    setLocationError("");
    setLocationMessage(
      hasCoordinates(savedLocation)
        ? "Saved address loaded on the map. Drag the pin if the exact doorstep location is different."
        : "Resolving your saved address on the map..."
    );
    setLocationMessageTone("info");
  }, [savedAddress, savedLocation]);

  const hasSavedAddress = Boolean(savedAddress);
  const hasCurrentCoordinates = hasCoordinates(currentLocation);
  const hasSavedCoordinates = hasCoordinates(savedLocation);
  const activeLocationSource = locationSource === "current" ? "current" : "saved";
  const activeLocation = activeLocationSource === "current" ? currentLocation : savedLocation;
  const hasActiveCoordinates = hasCoordinates(activeLocation);
  const activeLocationAccuracy = getLocationAccuracyState(activeLocation.accuracy, activeLocation.manuallyAdjusted);
  const activeLocationUpdatedAt = formatLocationCapturedAt(activeLocation.capturedAt);
  const activeLocationAddress =
    activeLocation.formattedAddress ||
    activeLocation.address ||
    (activeLocationSource === "saved" ? savedAddress : "") ||
    "Capture or adjust your service location on the map.";
  const activeLocationLabel = activeLocation.manuallyAdjusted
    ? "Adjusted Location"
    : activeLocationSource === "current"
      ? "Live Location"
      : "Saved Address";
  const activeLocationHeading = activeLocation.manuallyAdjusted
    ? "Adjusted location selected"
    : activeLocationSource === "current"
      ? "Current location selected"
      : "Saved address selected";
  const activeLocationSummary = activeLocation.manuallyAdjusted
    ? "This manually corrected pin will be saved for worker assignment and distance calculation."
    : activeLocationSource === "current"
      ? "Your browser GPS location is selected. Drag the marker if you need to fine-tune the exact spot."
      : "Your saved profile address is mapped here. Adjust the pin if the exact service point differs.";
  const activeLocationSourceLabel = activeLocation.manuallyAdjusted
    ? "Manual map pin"
    : activeLocationSource === "current"
      ? "Live GPS"
      : "Saved profile";
  const activeLocationAccuracyText = activeLocation.manuallyAdjusted
    ? "Adjusted on map"
    : activeLocationSource === "current"
      ? formatLocationAccuracy(activeLocation.accuracy)
      : hasActiveCoordinates
        ? "Geocoded"
        : "Pending";
  const activeLocationConfidence =
    activeLocationSource === "saved" && !activeLocation.manuallyAdjusted
      ? hasActiveCoordinates
        ? "Resolved from your saved address"
        : "Waiting for address lookup"
      : activeLocationAccuracy.detail;
  const hasDraftCoordinates =
    Number.isFinite(Number(adjustLatitude)) && Number.isFinite(Number(adjustLongitude));
  const previewLatitude = adjustLocationMode && hasDraftCoordinates ? Number(adjustLatitude) : activeLocation.latitude;
  const previewLongitude = adjustLocationMode && hasDraftCoordinates ? Number(adjustLongitude) : activeLocation.longitude;
  const previewAddress =
    adjustLocationMode && hasDraftCoordinates
      ? formatCoordinateAddress(previewLatitude, previewLongitude)
      : activeLocationAddress;
  const openInGoogleMapsUrl = buildGoogleMapsUrl({
    address: previewAddress,
    latitude: previewLatitude,
    longitude: previewLongitude
  });
  const embeddedMapUrl = buildGoogleMapsEmbedUrl({
    address: previewAddress,
    latitude: previewLatitude,
    longitude: previewLongitude
  });
  const showInteractiveMap = adjustLocationMode && Boolean(googleMapsApiKey);
  const showEmbeddedMap = Boolean(embeddedMapUrl) && !showInteractiveMap;

  useEffect(() => {
    let isMounted = true;

    loadClientMapConfig()
      .then((config) => {
        if (!isMounted) {
          return;
        }

        const apiKey = String(config?.googleMapsApiKey || "").trim();
        setGoogleMapsApiKey(apiKey);
        setMapStatus(apiKey ? "idle" : "unavailable");
        setMapError(
          apiKey
            ? ""
            : "Add GOOGLE_MAPS_BROWSER_API_KEY in the backend environment to enable draggable map editing."
        );
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setMapStatus("error");
        setMapError(error instanceof Error ? error.message : "Unable to load booking map configuration.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!adjustLocationMode || !googleMapsApiKey || !mapContainerRef.current) {
      return undefined;
    }

    let isMounted = true;
    setMapStatus("loading");
    setMapError("");

    loadGoogleMapsApi(googleMapsApiKey)
      .then((maps) => {
        if (!isMounted || !mapContainerRef.current) {
          return;
        }

        const center = hasDraftCoordinates
          ? { lat: Number(adjustLatitude), lng: Number(adjustLongitude) }
          : hasActiveCoordinates
            ? { lat: activeLocation.latitude, lng: activeLocation.longitude }
            : DEFAULT_MAP_CENTER;

        mapLibraryRef.current = maps;
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new maps.Map(mapContainerRef.current, {
            center,
            zoom: hasActiveCoordinates ? LOCATION_MAP_ZOOM : DEFAULT_MAP_ZOOM,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: "greedy"
          });
        }

        if (!markerRef.current) {
          markerRef.current = new maps.Marker({
            map: mapInstanceRef.current,
            position: center,
            draggable: true
          });
        }

        markerRef.current.setMap(mapInstanceRef.current);
        markerRef.current.setDraggable(true);
        markerRef.current.setPosition(center);
        mapInstanceRef.current.setCenter(center);
        mapInstanceRef.current.setZoom(hasActiveCoordinates ? LOCATION_MAP_ZOOM : DEFAULT_MAP_ZOOM);

        if (!mapClickListenerRef.current) {
          mapClickListenerRef.current = mapInstanceRef.current.addListener("click", (event) => {
            const latitude = event.latLng?.lat?.();
            const longitude = event.latLng?.lng?.();
            if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
              return;
            }

            setAdjustLatitude(formatCoordinateInput(latitude));
            setAdjustLongitude(formatCoordinateInput(longitude));
            markerRef.current?.setPosition?.({ lat: latitude, lng: longitude });
          });
        }

        if (!markerDragListenerRef.current) {
          markerDragListenerRef.current = markerRef.current.addListener("dragend", (event) => {
            const latitude = event.latLng?.lat?.();
            const longitude = event.latLng?.lng?.();
            if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
              return;
            }

            setAdjustLatitude(formatCoordinateInput(latitude));
            setAdjustLongitude(formatCoordinateInput(longitude));
          });
        }

        setMapStatus("ready");
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setMapStatus("error");
        setMapError(error instanceof Error ? error.message : "Unable to load Google Maps.");
      });

    return () => {
      isMounted = false;
    };
  }, [
    adjustLocationMode,
    googleMapsApiKey,
    hasActiveCoordinates
  ]);

  useEffect(() => {
    if (!showInteractiveMap || !mapInstanceRef.current || !markerRef.current) {
      return;
    }

    const center = hasDraftCoordinates
      ? { lat: Number(adjustLatitude), lng: Number(adjustLongitude) }
      : hasActiveCoordinates
        ? { lat: activeLocation.latitude, lng: activeLocation.longitude }
        : DEFAULT_MAP_CENTER;

    markerRef.current.setPosition(center);
    mapInstanceRef.current.setCenter(center);
    mapInstanceRef.current.setZoom(hasActiveCoordinates || hasDraftCoordinates ? LOCATION_MAP_ZOOM : DEFAULT_MAP_ZOOM);
  }, [
    activeLocation.latitude,
    activeLocation.longitude,
    adjustLatitude,
    adjustLongitude,
    hasActiveCoordinates,
    hasDraftCoordinates,
    showInteractiveMap
  ]);

  useEffect(
    () => () => {
      mapClickListenerRef.current?.remove?.();
      markerDragListenerRef.current?.remove?.();
      markerRef.current?.setMap?.(null);
      markerRef.current = null;
      mapInstanceRef.current = null;
      mapLibraryRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!savedAddress) {
      setSavedLocation(createLocationState());
      return;
    }

    let isMounted = true;

    const resolveSavedAddress = async () => {
      const cacheKey = buildForwardGeocodeCacheKey(savedAddress);
      const cachedLocation = readSessionCache(cacheKey, 12 * 60 * 60 * 1000);
      if (cachedLocation && hasCoordinates(cachedLocation)) {
        const nextLocation = createLocationState({
          address: String(cachedLocation.formattedAddress || cachedLocation.address || savedAddress).trim(),
          formattedAddress: String(cachedLocation.formattedAddress || cachedLocation.address || savedAddress).trim(),
          latitude: Number(Number(cachedLocation.latitude).toFixed(6)),
          longitude: Number(Number(cachedLocation.longitude).toFixed(6)),
          capturedAt: String(cachedLocation.capturedAt || new Date().toISOString())
        });

        if (isMounted) {
          setSavedLocation((current) => (current.manuallyAdjusted && hasCoordinates(current) ? current : nextLocation));
        }
        return;
      }

      try {
        let request = forwardGeocodeRequestsRef.current.get(cacheKey);
        if (!request) {
          request = api
            .post("/api/location/forward-geocode", {
              address: savedAddress
            })
            .finally(() => {
              forwardGeocodeRequestsRef.current.delete(cacheKey);
            });
          forwardGeocodeRequestsRef.current.set(cacheKey, request);
        }
        const response = await request;
        const formattedAddress = String(response.data?.address || savedAddress).trim();
        const latitude = Number(response.data?.latitude);
        const longitude = Number(response.data?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new Error("Resolved address is missing coordinates.");
        }

        const nextLocation = createLocationState({
          address: formattedAddress,
          formattedAddress,
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          capturedAt: new Date().toISOString()
        });
        writeSessionCache(cacheKey, nextLocation);

        if (isMounted) {
          setSavedLocation((current) => (current.manuallyAdjusted && hasCoordinates(current) ? current : nextLocation));
        }
      } catch (_error) {
        if (isMounted) {
          setSavedLocation((current) =>
            current.manuallyAdjusted && hasCoordinates(current)
              ? current
              : createLocationState({
                  address: savedAddress,
                  formattedAddress: savedAddress
                })
          );
        }
      }
    };

    void resolveSavedAddress();

    return () => {
      isMounted = false;
    };
  }, [savedAddress]);

  useEffect(() => {
    if (initialLocationRequestedRef.current) {
      return;
    }
    initialLocationRequestedRef.current = true;
    void useCurrentLocation({ automatic: true });
  }, [useCurrentLocation]);

  const handleToggleAdjustLocation = useCallback(async () => {
    if (adjustLocationMode) {
      setAdjustLocationMode(false);
      setLocationMessage("Location pin locked. You can still reopen adjustment mode if needed.");
      setLocationMessageTone("info");
      return;
    }

    setAdjustLocationMode(true);
    setLocationError("");
    setAdjustLatitude(
      formatCoordinateInput(hasActiveCoordinates ? activeLocation.latitude : DEFAULT_MAP_CENTER.lat)
    );
    setAdjustLongitude(
      formatCoordinateInput(hasActiveCoordinates ? activeLocation.longitude : DEFAULT_MAP_CENTER.lng)
    );
    setLocationMessage(
      googleMapsApiKey
        ? "Drag the marker on the map or edit the coordinates below to fine-tune the exact service point."
        : "Edit the latitude and longitude below to fine-tune the exact service point."
    );
    setLocationMessageTone("info");
  }, [activeLocation.latitude, activeLocation.longitude, adjustLocationMode, googleMapsApiKey, hasActiveCoordinates]);

  const handleNudgeLocation = useCallback((latitudeDelta, longitudeDelta) => {
    const baseLatitude = Number.isFinite(Number(adjustLatitude))
      ? Number(adjustLatitude)
      : hasActiveCoordinates
        ? activeLocation.latitude
        : DEFAULT_MAP_CENTER.lat;
    const baseLongitude = Number.isFinite(Number(adjustLongitude))
      ? Number(adjustLongitude)
      : hasActiveCoordinates
        ? activeLocation.longitude
        : DEFAULT_MAP_CENTER.lng;

    setAdjustLatitude(formatCoordinateInput(clampLatitude(baseLatitude + latitudeDelta)));
    setAdjustLongitude(formatCoordinateInput(clampLongitude(baseLongitude + longitudeDelta)));
  }, [activeLocation.latitude, activeLocation.longitude, adjustLatitude, adjustLongitude, hasActiveCoordinates]);

  const handleApplyAdjustedLocation = useCallback(async () => {
    const latitude = Number(adjustLatitude);
    const longitude = Number(adjustLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLocationError("Enter valid latitude and longitude values before applying the adjusted location.");
      return;
    }

    await handleManualCoordinateSelection(clampLatitude(latitude), clampLongitude(longitude));
    setAdjustLocationMode(false);
  }, [adjustLatitude, adjustLongitude, handleManualCoordinateSelection]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user || !selectedService) return;

    if (!formData.serviceDate || !formData.preferredTimeSlot) {
      setFormMessage("Please choose a service date and time slot.");
      return;
    }

    if (!hasActiveCoordinates) {
      setFormMessage("Select your service location on the map before confirming the booking.");
      return;
    }

    setSubmitting(true);
    setFormMessage("");

    try {
      const bookingAddress = activeLocation.formattedAddress || activeLocation.address || undefined;
      const bookingLatitude = activeLocation.latitude ?? undefined;
      const bookingLongitude = activeLocation.longitude ?? undefined;
      const bookingAccuracy = activeLocation.manuallyAdjusted ? undefined : activeLocation.accuracy ?? undefined;

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
        selectedAddonIds: selection.selectedAddons,
        address: bookingAddress,
        formattedAddress: bookingAddress,
        latitude: bookingLatitude,
        longitude: bookingLongitude,
        locationAccuracy: bookingAccuracy,
        locationSource: activeLocation.manuallyAdjusted
          ? "manual_map_pin"
          : activeLocationSource === "current"
            ? "browser_geolocation"
            : "saved_address_geocode"
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

          <div className="tasko-booking-field full">
            <span>Service Location</span>
            <div className="tasko-booking-location-card">
              <div className="tasko-booking-location-head">
                <div>
                  <p className="tasko-pricing-summary-label">{activeLocationLabel}</p>
                  <h3>{activeLocationHeading}</h3>
                  <p>{activeLocationSummary}</p>
                </div>
                <span className={`tasko-booking-location-status is-${activeLocationAccuracy.tone}`}>
                  {activeLocationAccuracy.label}
                </span>
              </div>

              <div className="tasko-booking-location-layout">
                <div className="tasko-booking-location-panel">
                  <div className="tasko-booking-location-address">
                    <p className="tasko-pricing-summary-label">Service Address</p>
                    <h4>{activeLocationAddress}</h4>
                    <p>
                      {adjustLocationMode
                        ? "Adjustment mode is on. Drag the marker or tap the map to correct the exact spot."
                        : savedAddressLoading
                          ? "Loading your saved address from profile."
                          : "The final marker position will be stored with this booking for worker routing."}
                    </p>
                  </div>

                  <div className="tasko-booking-location-meta">
                    <div className="tasko-booking-location-meta-item">
                      <span>Source</span>
                      <strong>{activeLocationSourceLabel}</strong>
                    </div>
                    <div className="tasko-booking-location-meta-item">
                      <span>Accuracy</span>
                      <strong>{activeLocationAccuracyText}</strong>
                    </div>
                    <div className="tasko-booking-location-meta-item">
                      <span>Confidence</span>
                      <strong>{activeLocationConfidence}</strong>
                    </div>
                    <div className="tasko-booking-location-meta-item">
                      <span>Updated</span>
                      <strong>{activeLocationUpdatedAt || (hasSavedAddress ? "Profile default" : "Not captured yet")}</strong>
                    </div>
                    {hasActiveCoordinates ? (
                      <div className="tasko-booking-location-meta-item tasko-booking-location-meta-item-wide">
                        <span>Coordinates</span>
                        <strong>
                          {`Lat ${activeLocation.latitude}, Lng ${activeLocation.longitude}`}
                        </strong>
                      </div>
                    ) : null}
                  </div>

                  <div className="tasko-booking-actions-row tasko-booking-location-actions">
                    <button
                      type="button"
                      className={`tasko-secondary-button tasko-booking-location-toggle ${activeLocationSource === "current" ? "is-active" : ""}`}
                      onClick={() => handleUseCurrentLocation()}
                      disabled={locationLoading}
                    >
                      {locationLoading
                        ? "Detecting..."
                        : hasCurrentCoordinates && activeLocationSource === "current"
                          ? "Refresh Live Location"
                          : "Use Current Location"}
                    </button>
                    <button
                      type="button"
                      className={`tasko-secondary-button tasko-booking-location-toggle ${activeLocationSource === "saved" ? "is-active" : ""}`}
                      onClick={handleUseSavedLocation}
                      disabled={!hasSavedAddress && !savedAddressLoading}
                    >
                      Use Saved Address
                    </button>
                    <button
                      type="button"
                      className={`tasko-secondary-button tasko-booking-location-toggle ${adjustLocationMode ? "is-active" : ""}`}
                      onClick={() => {
                        void handleToggleAdjustLocation();
                      }}
                    >
                      {adjustLocationMode ? "Cancel Adjust" : "Adjust Location"}
                    </button>
                    {openInGoogleMapsUrl ? (
                      <a
                        className="tasko-booking-location-link"
                        href={openInGoogleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in Google Maps
                      </a>
                    ) : null}
                  </div>

                  {adjustLocationMode && googleMapsApiKey && mapStatus === "loading" ? (
                    <p className="tasko-booking-location-alert is-info">Loading the interactive map for live location adjustment...</p>
                  ) : null}
                  {adjustLocationMode && mapStatus === "unavailable" ? (
                    <p className="tasko-booking-location-alert is-info">
                      {mapError || "Add GOOGLE_MAPS_BROWSER_API_KEY to enable draggable map editing."}
                    </p>
                  ) : null}
                  {adjustLocationMode && mapStatus === "error" ? <p className="tasko-booking-location-alert is-danger">{mapError}</p> : null}
                  {locationError ? <p className="tasko-booking-location-alert is-danger">{locationError}</p> : null}
                  {locationMessage ? <p className={`tasko-booking-location-alert is-${locationMessageTone}`}>{locationMessage}</p> : null}
                  {adjustLocationMode ? (
                    <div className="tasko-booking-adjust-panel">
                      <div className="tasko-booking-adjust-fields">
                        <label className="tasko-booking-adjust-field">
                          <span>Latitude</span>
                          <input
                            type="number"
                            step="0.000001"
                            value={adjustLatitude}
                            onChange={(event) => setAdjustLatitude(event.target.value)}
                          />
                        </label>
                        <label className="tasko-booking-adjust-field">
                          <span>Longitude</span>
                          <input
                            type="number"
                            step="0.000001"
                            value={adjustLongitude}
                            onChange={(event) => setAdjustLongitude(event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="tasko-booking-adjust-nudges">
                        <button type="button" className="tasko-secondary-button" onClick={() => handleNudgeLocation(LOCATION_NUDGE_STEP, 0)}>
                          North
                        </button>
                        <button type="button" className="tasko-secondary-button" onClick={() => handleNudgeLocation(-LOCATION_NUDGE_STEP, 0)}>
                          South
                        </button>
                        <button type="button" className="tasko-secondary-button" onClick={() => handleNudgeLocation(0, -LOCATION_NUDGE_STEP)}>
                          West
                        </button>
                        <button type="button" className="tasko-secondary-button" onClick={() => handleNudgeLocation(0, LOCATION_NUDGE_STEP)}>
                          East
                        </button>
                        <button type="button" className="tasko-booking-submit" onClick={() => void handleApplyAdjustedLocation()}>
                          Apply Adjusted Location
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="tasko-booking-location-map">
                  {showEmbeddedMap ? (
                    <iframe
                      key={embeddedMapUrl}
                      title="Selected booking location map"
                      src={embeddedMapUrl}
                      className="tasko-booking-location-map-frame"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : null}
                  <div
                    ref={mapContainerRef}
                    className={`tasko-booking-location-map-canvas ${mapStatus === "ready" ? "is-ready" : ""} ${
                      !showInteractiveMap ? "is-hidden" : ""
                    }`}
                    role="img"
                    aria-label="Interactive booking location map"
                  />
                  {showInteractiveMap && mapStatus !== "ready" ? (
                    <div className="tasko-booking-location-map-placeholder">
                      <strong>
                        {mapStatus === "error" ? "Map could not be loaded" : "Interactive map is getting ready"}
                      </strong>
                      <span>
                        {mapStatus === "error"
                          ? "Check the Google Maps browser key configuration and reload the page."
                          : "The booking form stays usable while the draggable map initializes."}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
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
