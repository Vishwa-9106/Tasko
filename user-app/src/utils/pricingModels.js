export const PRICING_MODELS = [
  "package",
  "per_unit",
  "fixed",
  "time_based",
  "inspection",
  "meal_based"
];

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

export function formatRupee(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.trunc(parsed)) : null;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.trim().toLowerCase() === "true") return true;
    if (value.trim().toLowerCase() === "false") return false;
  }
  return fallback;
}

function categoryModel(categoryName) {
  const normalized = normalizeText(categoryName);
  if (normalized === "cleaning") return "package";
  if (normalized === "washing") return "per_unit";
  if (normalized === "technical installation services") return "fixed";
  if (normalized === "barber makeup services") return "fixed";
  if (normalized === "caring") return "time_based";
  if (normalized === "cooking") return "meal_based";
  if (normalized === "maintenance") return "inspection";
  if (normalized === "mechanic") return "inspection";
  if (normalized === "plumbing") return "inspection";
  if (normalized === "ac repair") return "inspection";
  return "fixed";
}

function roundToNearestFifty(value) {
  return Math.max(50, Math.round(value / 50) * 50);
}

function emptyConfig() {
  return {
    packages: [],
    addons: [],
    unitPrice: null,
    unitLabel: "",
    minUnits: 1,
    fixedPrice: null,
    serviceDescription: "",
    hourlyRate: null,
    dayRate: null,
    availableShifts: [],
    visitCharge: null,
    requiresApproval: false,
    mealOptions: []
  };
}

function packageConfig(basePrice, label) {
  const basicPrice = roundToNearestFifty(basePrice);
  const plusPrice = roundToNearestFifty(basePrice * 1.45);
  const premiumPrice = roundToNearestFifty(basePrice * 1.9);

  return {
    ...emptyConfig(),
    packages: [
      {
        id: "starter",
        name: "Starter",
        price: basicPrice,
        description: `Core ${label.toLowerCase()} coverage for standard spaces.`,
        recommended: false,
        features: ["Surface dusting", "Floor cleaning", "Basic sanitisation"]
      },
      {
        id: "plus",
        name: "Plus",
        price: plusPrice,
        description: `Expanded ${label.toLowerCase()} scope with more detailed work.`,
        recommended: true,
        features: ["Everything in Starter", "Bathroom detailing", "Appliance exterior wipe"]
      },
      {
        id: "premium",
        name: "Premium",
        price: premiumPrice,
        description: `Deep ${label.toLowerCase()} coverage for larger or harder jobs.`,
        recommended: false,
        features: ["Everything in Plus", "Stain treatment", "Cabinet exterior cleaning"]
      }
    ],
    addons: [
      { id: "balcony-cleaning", name: "Balcony Cleaning", price: 249 },
      { id: "sofa-cleaning", name: "Sofa Cleaning", price: 199 }
    ]
  };
}

function perUnitConfig(unitPrice, unitLabel, minUnits) {
  return {
    ...emptyConfig(),
    unitPrice,
    unitLabel,
    minUnits
  };
}

function fixedConfig(fixedPrice, serviceDescription) {
  return {
    ...emptyConfig(),
    fixedPrice,
    serviceDescription
  };
}

function timeBasedConfig(hourlyRate, dayRate) {
  return {
    ...emptyConfig(),
    hourlyRate,
    dayRate,
    availableShifts: [
      { id: "2-hours", name: "2 Hours", hours: 2, label: "Quick support slot" },
      { id: "4-hours", name: "4 Hours", hours: 4, label: "Half shift" },
      { id: "8-hours", name: "8 Hours", hours: 8, label: "Full Day (9AM-5PM)" },
      { id: "night-care", name: "Night Care", hours: 10, label: "Night Care (9PM-7AM)" }
    ]
  };
}

function inspectionConfig(visitCharge) {
  return {
    ...emptyConfig(),
    visitCharge,
    requiresApproval: true
  };
}

function mealBasedConfig(mealOptions) {
  return {
    ...emptyConfig(),
    mealOptions
  };
}

export function normalizePricingModel(value, categoryName = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (PRICING_MODELS.includes(normalized)) {
    return normalized;
  }
  return categoryModel(categoryName);
}

export function getSuggestedPricingSetup(categoryName, subcategoryName) {
  const normalizedName = normalizeText(subcategoryName);
  const pricingModel = categoryModel(categoryName);

  if (pricingModel === "package") {
    const basePrice =
      normalizedName.includes("deep") ? 1499 :
      normalizedName.includes("office") ? 2499 :
      normalizedName.includes("bathroom") ? 699 :
      normalizedName.includes("kitchen") ? 899 :
      999;
    return { pricingModel, pricingConfig: packageConfig(basePrice, subcategoryName || "Cleaning") };
  }

  if (pricingModel === "per_unit") {
    if (normalizedName.includes("dish")) return { pricingModel, pricingConfig: perUnitConfig(5, "dish", 20) };
    if (normalizedName.includes("clothes")) return { pricingModel, pricingConfig: perUnitConfig(149, "set", 1) };
    if (normalizedName.includes("bike")) return { pricingModel, pricingConfig: perUnitConfig(199, "bike", 1) };
    if (normalizedName.includes("car")) return { pricingModel, pricingConfig: perUnitConfig(299, "car", 1) };
    return { pricingModel, pricingConfig: perUnitConfig(199, "item", 1) };
  }

  if (pricingModel === "fixed") {
    const fixedPrice =
      normalizedName.includes("fan") ? 199 :
      normalizedName.includes("light") ? 149 :
      normalizedName.includes("tv") ? 399 :
      normalizedName.includes("cctv") ? 499 :
      normalizedName.includes("washing machine") ? 399 :
      normalizedName.includes("inverter") ? 499 :
      normalizedName.includes("hair") ? 199 :
      normalizedName.includes("beard") ? 149 :
      normalizedName.includes("facial") ? 399 :
      normalizedName.includes("bridal") ? 3999 :
      normalizedName.includes("party") ? 1299 :
      299;
    return {
      pricingModel,
      pricingConfig: fixedConfig(fixedPrice, `Flat-rate ${String(subcategoryName || "").toLowerCase()} visit.`)
    };
  }

  if (pricingModel === "time_based") {
    const hourlyRate =
      normalizedName.includes("patient") ? 249 :
      normalizedName.includes("elder") ? 225 :
      199;
    const dayRate =
      normalizedName.includes("patient") ? 1699 :
      normalizedName.includes("elder") ? 1499 :
      1299;
    return { pricingModel, pricingConfig: timeBasedConfig(hourlyRate, dayRate) };
  }

  if (pricingModel === "inspection") {
    const visitCharge =
      normalizedName.includes("engine") ? 299 :
      normalizedName.includes("battery") ? 249 :
      normalizedName.includes("tank") ? 299 :
      normalizedName.includes("ac") ? 299 :
      199;
    return { pricingModel, pricingConfig: inspectionConfig(visitCharge) };
  }

  if (normalizedName.includes("event")) {
    return {
      pricingModel,
      pricingConfig: mealBasedConfig([
        { id: "small-event", name: "Small Gathering", price: 2500, description: "Up to 15 guests." },
        { id: "medium-event", name: "Celebration Menu", price: 4500, description: "16 to 30 guests." },
        { id: "large-event", name: "Full Event Service", price: 8000, description: "31 to 50 guests." }
      ])
    };
  }

  if (normalizedName.includes("non veg")) {
    return {
      pricingModel,
      pricingConfig: mealBasedConfig([
        { id: "breakfast", name: "Breakfast", price: 180, description: "Fresh morning prep." },
        { id: "lunch", name: "Lunch", price: 260, description: "Standard home lunch service." },
        { id: "dinner", name: "Dinner", price: 260, description: "Evening meal preparation." },
        { id: "monthly", name: "Monthly Cook", price: 7000, description: "Recurring daily cooking plan." }
      ])
    };
  }

  return {
    pricingModel,
    pricingConfig: mealBasedConfig([
      { id: "breakfast", name: "Breakfast", price: 150, description: "Light morning meal." },
      { id: "lunch", name: "Lunch", price: 200, description: "Regular lunch preparation." },
      { id: "dinner", name: "Dinner", price: 200, description: "Regular dinner preparation." },
      { id: "monthly", name: "Monthly Cook", price: 6000, description: "Recurring home cook plan." }
    ])
  };
}

function normalizeArrayItems(value, fallback, mapper) {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  return source.map(mapper).filter(Boolean);
}

export function normalizePricingConfig(pricingModel, value, categoryName = "", subcategoryName = "") {
  const setup = getSuggestedPricingSetup(categoryName, subcategoryName);
  const seed = pricingModel === setup.pricingModel ? setup.pricingConfig : emptyConfig();
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const packages = normalizeArrayItems(source.packages, seed.packages, (entry, index) => {
    const name = String(entry?.name || seed.packages[index]?.name || "").trim();
    const price = toNumber(entry?.price ?? seed.packages[index]?.price);
    if (!name || price === null) return null;
    return {
      id: String(entry?.id || seed.packages[index]?.id || `${toSlug(name)}-${index + 1}`).trim(),
      name,
      price,
      description: String(entry?.description || seed.packages[index]?.description || "").trim(),
      recommended: toBoolean(entry?.recommended, seed.packages[index]?.recommended || false),
      features: Array.isArray(entry?.features)
        ? entry.features.map((item) => String(item || "").trim()).filter(Boolean)
        : seed.packages[index]?.features || []
    };
  });

  const addons = normalizeArrayItems(source.addons, seed.addons, (entry, index) => {
    const name = String(entry?.name || seed.addons[index]?.name || "").trim();
    const price = toNumber(entry?.price ?? seed.addons[index]?.price);
    if (!name || price === null) return null;
    return {
      id: String(entry?.id || seed.addons[index]?.id || `${toSlug(name)}-${index + 1}`).trim(),
      name,
      price
    };
  });

  const availableShifts = normalizeArrayItems(source.availableShifts, seed.availableShifts, (entry, index) => {
    const name = String(entry?.name || seed.availableShifts[index]?.name || "").trim();
    const hours = toPositiveInteger(entry?.hours ?? seed.availableShifts[index]?.hours);
    if (!name || hours === null) return null;
    return {
      id: String(entry?.id || seed.availableShifts[index]?.id || `${toSlug(name)}-${index + 1}`).trim(),
      name,
      hours,
      label: String(entry?.label || seed.availableShifts[index]?.label || `${hours} hours`).trim()
    };
  });

  const mealOptions = normalizeArrayItems(source.mealOptions, seed.mealOptions, (entry, index) => {
    const name = String(entry?.name || seed.mealOptions[index]?.name || "").trim();
    const price = toNumber(entry?.price ?? seed.mealOptions[index]?.price);
    if (!name || price === null) return null;
    return {
      id: String(entry?.id || seed.mealOptions[index]?.id || `${toSlug(name)}-${index + 1}`).trim(),
      name,
      price,
      description: String(entry?.description || seed.mealOptions[index]?.description || "").trim()
    };
  });

  return {
    packages,
    addons,
    unitPrice: toNumber(source.unitPrice ?? seed.unitPrice),
    unitLabel: String(source.unitLabel || seed.unitLabel || "").trim(),
    minUnits: toPositiveInteger(source.minUnits ?? seed.minUnits) || 1,
    fixedPrice: toNumber(source.fixedPrice ?? seed.fixedPrice),
    serviceDescription: String(source.serviceDescription || seed.serviceDescription || "").trim(),
    hourlyRate: toNumber(source.hourlyRate ?? seed.hourlyRate),
    dayRate: toNumber(source.dayRate ?? seed.dayRate),
    availableShifts,
    visitCharge: toNumber(source.visitCharge ?? seed.visitCharge),
    requiresApproval: toBoolean(source.requiresApproval, seed.requiresApproval),
    mealOptions
  };
}

export function calculateStartingPrice(pricingModel, pricingConfig) {
  if (pricingModel === "package") {
    return pricingConfig.packages.reduce((current, entry) => (current === null || entry.price < current ? entry.price : current), null);
  }
  if (pricingModel === "per_unit") {
    return pricingConfig.unitPrice === null ? null : pricingConfig.unitPrice * Math.max(1, pricingConfig.minUnits || 1);
  }
  if (pricingModel === "fixed") {
    return pricingConfig.fixedPrice;
  }
  if (pricingModel === "time_based") {
    const shiftPrices = pricingConfig.availableShifts.map((shift) =>
      pricingConfig.dayRate !== null && shift.hours >= 8
        ? pricingConfig.dayRate
        : (pricingConfig.hourlyRate || 0) * shift.hours
    );
    return shiftPrices.reduce((current, entry) => (current === null || entry < current ? entry : current), pricingConfig.hourlyRate);
  }
  if (pricingModel === "inspection") {
    return pricingConfig.visitCharge;
  }
  if (pricingModel === "meal_based") {
    return pricingConfig.mealOptions.reduce((current, entry) => (current === null || entry.price < current ? entry.price : current), null);
  }
  return null;
}

export function paymentFlowForModel(pricingModel) {
  return pricingModel === "inspection" ? "postpaid" : "prepaid";
}

export function buildStartingPriceLabel(pricingModel, pricingConfig) {
  const startingPrice = calculateStartingPrice(pricingModel, pricingConfig);
  if (startingPrice === null) {
    return "Pricing available on selection";
  }

  if (pricingModel === "inspection") {
    return `Visit charge ${formatRupee(startingPrice)}`;
  }

  if (pricingModel === "per_unit") {
    return `Starting from ${formatRupee(startingPrice)}`;
  }

  return `Starting from ${formatRupee(startingPrice)}`;
}

export function createInitialSelection(pricingModel, pricingConfig) {
  return {
    selectedPackage: pricingConfig.packages.find((entry) => entry.recommended)?.id || pricingConfig.packages[0]?.id || "",
    selectedUnits: Math.max(1, pricingConfig.minUnits || 1),
    selectedHours: pricingConfig.availableShifts[0]?.hours || 2,
    selectedShift: pricingConfig.availableShifts[0]?.id || "",
    selectedMeal: pricingConfig.mealOptions[0]?.id || "",
    selectedAddons: []
  };
}

export function calculatePricingSelection(pricingModel, pricingConfig, selection) {
  const selectedAddons = pricingConfig.addons.filter((addon) => (selection?.selectedAddons || []).includes(addon.id));

  if (pricingModel === "package") {
    const selectedPackage =
      pricingConfig.packages.find((entry) => entry.id === selection?.selectedPackage) ||
      pricingConfig.packages.find((entry) => entry.recommended) ||
      pricingConfig.packages[0] ||
      null;
    const addonsTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
    return {
      selectedPackage,
      selectedUnits: null,
      selectedHours: null,
      selectedShift: null,
      selectedMeal: null,
      selectedAddons,
      basePrice: selectedPackage?.price || 0,
      addonsPrice: addonsTotal,
      visitCharge: null,
      finalPrice: (selectedPackage?.price || 0) + addonsTotal
    };
  }

  if (pricingModel === "per_unit") {
    const selectedUnits = Math.max(pricingConfig.minUnits || 1, toPositiveInteger(selection?.selectedUnits) || pricingConfig.minUnits || 1);
    return {
      selectedPackage: null,
      selectedUnits,
      selectedHours: null,
      selectedShift: null,
      selectedMeal: null,
      selectedAddons: [],
      basePrice: (pricingConfig.unitPrice || 0) * selectedUnits,
      addonsPrice: 0,
      visitCharge: null,
      finalPrice: (pricingConfig.unitPrice || 0) * selectedUnits
    };
  }

  if (pricingModel === "fixed") {
    return {
      selectedPackage: null,
      selectedUnits: null,
      selectedHours: null,
      selectedShift: null,
      selectedMeal: null,
      selectedAddons: [],
      basePrice: pricingConfig.fixedPrice || 0,
      addonsPrice: 0,
      visitCharge: null,
      finalPrice: pricingConfig.fixedPrice || 0
    };
  }

  if (pricingModel === "time_based") {
    const selectedShift =
      pricingConfig.availableShifts.find((entry) => entry.id === selection?.selectedShift) ||
      pricingConfig.availableShifts[0] ||
      null;
    const selectedHours = toPositiveInteger(selection?.selectedHours) || selectedShift?.hours || 1;
    const finalPrice =
      pricingConfig.dayRate !== null && selectedHours >= 8
        ? pricingConfig.dayRate
        : (pricingConfig.hourlyRate || 0) * selectedHours;
    return {
      selectedPackage: null,
      selectedUnits: null,
      selectedHours,
      selectedShift,
      selectedMeal: null,
      selectedAddons: [],
      basePrice: finalPrice,
      addonsPrice: 0,
      visitCharge: null,
      finalPrice
    };
  }

  if (pricingModel === "inspection") {
    return {
      selectedPackage: null,
      selectedUnits: null,
      selectedHours: null,
      selectedShift: null,
      selectedMeal: null,
      selectedAddons: [],
      basePrice: pricingConfig.visitCharge || 0,
      addonsPrice: 0,
      visitCharge: pricingConfig.visitCharge || 0,
      finalPrice: pricingConfig.visitCharge || 0
    };
  }

  const selectedMeal =
    pricingConfig.mealOptions.find((entry) => entry.id === selection?.selectedMeal) ||
    pricingConfig.mealOptions[0] ||
    null;
  return {
    selectedPackage: null,
    selectedUnits: null,
    selectedHours: null,
    selectedShift: null,
    selectedMeal,
    selectedAddons: [],
    basePrice: selectedMeal?.price || 0,
    addonsPrice: 0,
    visitCharge: null,
    finalPrice: selectedMeal?.price || 0
  };
}

export function buildSelectionSummary(pricingModel, calculation, pricingConfig) {
  if (pricingModel === "package") {
    const addonSummary = calculation.selectedAddons.length > 0
      ? `, Add-ons: ${calculation.selectedAddons.map((addon) => addon.name).join(", ")}`
      : "";
    return `Package: ${calculation.selectedPackage?.name || "None"}${addonSummary}`;
  }

  if (pricingModel === "per_unit") {
    return `${calculation.selectedUnits || pricingConfig.minUnits} ${pricingConfig.unitLabel || "units"}`;
  }

  if (pricingModel === "fixed") {
    return pricingConfig.serviceDescription || "Fixed-price service";
  }

  if (pricingModel === "time_based") {
    return `${calculation.selectedShift?.name || "Shift"} • ${calculation.selectedHours || 0} hours`;
  }

  if (pricingModel === "inspection") {
    return "Inspection booking with estimate approval before work starts";
  }

  return `Meal: ${calculation.selectedMeal?.name || "None"}`;
}
