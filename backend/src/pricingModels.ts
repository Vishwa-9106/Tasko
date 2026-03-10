export type PricingModel =
  | "package"
  | "per_unit"
  | "fixed"
  | "time_based"
  | "inspection"
  | "meal_based";

export type PackageOption = {
  id: string;
  name: string;
  price: number;
  description: string;
  recommended: boolean;
  features: string[];
};

export type AddonOption = {
  id: string;
  name: string;
  price: number;
};

export type TimeShiftOption = {
  id: string;
  name: string;
  hours: number;
  label: string;
};

export type MealOption = {
  id: string;
  name: string;
  price: number;
  description: string;
};

export type PricingConfiguration = {
  packages: PackageOption[];
  addons: AddonOption[];
  unitPrice: number | null;
  unitLabel: string;
  minUnits: number;
  fixedPrice: number | null;
  serviceDescription: string;
  hourlyRate: number | null;
  dayRate: number | null;
  availableShifts: TimeShiftOption[];
  visitCharge: number | null;
  requiresApproval: boolean;
  mealOptions: MealOption[];
};

export type PricingSelection = {
  selectedPackage?: string;
  selectedUnits?: number;
  selectedHours?: number;
  selectedShift?: string;
  selectedMeal?: string;
  selectedAddons?: string[];
};

export type CalculatedPricingSelection = {
  pricingModel: PricingModel;
  selectedPackage: PackageOption | null;
  selectedUnits: number | null;
  selectedHours: number | null;
  selectedShift: TimeShiftOption | null;
  selectedMeal: MealOption | null;
  selectedAddons: AddonOption[];
  visitCharge: number | null;
  finalPrice: number;
  paymentStatus: string;
  approvalStatus: string;
  workerEstimate: number | null;
  userApproval: boolean;
  adminFlag: boolean;
};

type SuggestedPricingDefinition = {
  pricingModel: PricingModel;
  pricingConfig: PricingConfiguration;
};

const pricingModelValues = new Set<PricingModel>([
  "package",
  "per_unit",
  "fixed",
  "time_based",
  "inspection",
  "meal_based"
]);

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function readNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

function readPositiveInteger(value: unknown): number | null {
  const parsed = readNonNegativeNumber(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }

  return Math.max(1, Math.trunc(parsed));
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "option";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  return null;
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
}

function buildEmptyPricingConfiguration(): PricingConfiguration {
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

function normalizePackageOption(
  value: Record<string, unknown>,
  index: number,
  fallback: PackageOption | null
): PackageOption | null {
  const name = readTrimmedString(value.name) || fallback?.name || "";
  const price = readNonNegativeNumber(value.price) ?? fallback?.price ?? null;
  if (!name || price === null) {
    return null;
  }

  const featuresSource =
    Array.isArray(value.features) ? value.features : Array.isArray(fallback?.features) ? fallback.features : [];
  const features = featuresSource
    .map((entry) => readTrimmedString(entry))
    .filter(Boolean);

  return {
    id: readTrimmedString(value.id) || fallback?.id || `${toSlug(name)}-${index + 1}`,
    name,
    price,
    description: readTrimmedString(value.description) || fallback?.description || "",
    recommended: readBoolean(value.recommended, fallback?.recommended ?? false),
    features
  };
}

function normalizeAddonOption(
  value: Record<string, unknown>,
  index: number,
  fallback: AddonOption | null
): AddonOption | null {
  const name = readTrimmedString(value.name) || fallback?.name || "";
  const price = readNonNegativeNumber(value.price) ?? fallback?.price ?? null;
  if (!name || price === null) {
    return null;
  }

  return {
    id: readTrimmedString(value.id) || fallback?.id || `${toSlug(name)}-${index + 1}`,
    name,
    price
  };
}

function normalizeTimeShiftOption(
  value: Record<string, unknown>,
  index: number,
  fallback: TimeShiftOption | null
): TimeShiftOption | null {
  const name = readTrimmedString(value.name) || fallback?.name || "";
  const hours = readPositiveInteger(value.hours) ?? fallback?.hours ?? null;
  if (!name || hours === null) {
    return null;
  }

  return {
    id: readTrimmedString(value.id) || fallback?.id || `${toSlug(name)}-${index + 1}`,
    name,
    hours,
    label: readTrimmedString(value.label) || fallback?.label || `${hours} hours`
  };
}

function normalizeMealOption(
  value: Record<string, unknown>,
  index: number,
  fallback: MealOption | null
): MealOption | null {
  const name = readTrimmedString(value.name) || fallback?.name || "";
  const price = readNonNegativeNumber(value.price) ?? fallback?.price ?? null;
  if (!name || price === null) {
    return null;
  }

  return {
    id: readTrimmedString(value.id) || fallback?.id || `${toSlug(name)}-${index + 1}`,
    name,
    price,
    description: readTrimmedString(value.description) || fallback?.description || ""
  };
}

function roundToNearestFifty(value: number): number {
  return Math.max(50, Math.round(value / 50) * 50);
}

function buildPackageConfig(basePrice: number, label: string): PricingConfiguration {
  const basicPrice = roundToNearestFifty(basePrice);
  const plusPrice = roundToNearestFifty(basePrice * 1.45);
  const premiumPrice = roundToNearestFifty(basePrice * 1.9);

  return {
    ...buildEmptyPricingConfiguration(),
    packages: [
      {
        id: "starter",
        name: "Starter",
        price: basicPrice,
        description: `Core ${label.toLowerCase()} coverage for visible surfaces and standard rooms.`,
        recommended: false,
        features: ["Surface dusting", "Floor cleaning", "Basic sanitisation"]
      },
      {
        id: "plus",
        name: "Plus",
        price: plusPrice,
        description: `Expanded ${label.toLowerCase()} scope with more detailed attention in key areas.`,
        recommended: true,
        features: ["Everything in Starter", "Bathroom detailing", "Appliance exterior wipe"]
      },
      {
        id: "premium",
        name: "Premium",
        price: premiumPrice,
        description: `Complete ${label.toLowerCase()} coverage for deeper turnaround and finishing.`,
        recommended: false,
        features: ["Everything in Plus", "Deep stain treatment", "Cabinet exterior cleaning"]
      }
    ],
    addons: [
      { id: "balcony-cleaning", name: "Balcony Cleaning", price: 249 },
      { id: "sofa-cleaning", name: "Sofa Cleaning", price: 199 }
    ]
  };
}

function buildPerUnitConfig(unitPrice: number, unitLabel: string, minUnits: number): PricingConfiguration {
  return {
    ...buildEmptyPricingConfiguration(),
    unitPrice,
    unitLabel,
    minUnits
  };
}

function buildFixedConfig(fixedPrice: number, serviceDescription: string): PricingConfiguration {
  return {
    ...buildEmptyPricingConfiguration(),
    fixedPrice,
    serviceDescription
  };
}

function buildTimeBasedConfig(hourlyRate: number, dayRate: number): PricingConfiguration {
  return {
    ...buildEmptyPricingConfiguration(),
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

function buildInspectionConfig(visitCharge: number): PricingConfiguration {
  return {
    ...buildEmptyPricingConfiguration(),
    visitCharge,
    requiresApproval: true
  };
}

function buildMealBasedConfig(mealOptions: MealOption[]): PricingConfiguration {
  return {
    ...buildEmptyPricingConfiguration(),
    mealOptions
  };
}

function categoryModel(categoryName: string): PricingModel {
  const normalized = readTrimmedString(categoryName).toLowerCase();

  if (normalized === "cleaning") return "package";
  if (normalized === "washing") return "per_unit";
  if (normalized === "technical & installation services") return "fixed";
  if (normalized === "barber & makeup services") return "fixed";
  if (normalized === "caring") return "time_based";
  if (normalized === "cooking") return "meal_based";
  if (normalized === "maintenance") return "inspection";
  if (normalized === "mechanic") return "inspection";
  if (normalized === "plumbing") return "inspection";
  if (normalized === "ac repair") return "inspection";

  return "fixed";
}

function buildCleaningSuggestion(subcategoryName: string): SuggestedPricingDefinition {
  const normalized = readTrimmedString(subcategoryName).toLowerCase();
  const basePrice =
    normalized.includes("deep") ? 1499 :
    normalized.includes("office") ? 2499 :
    normalized.includes("bathroom") ? 699 :
    normalized.includes("kitchen") ? 899 :
    999;

  return {
    pricingModel: "package",
    pricingConfig: buildPackageConfig(basePrice, readTrimmedString(subcategoryName) || "Cleaning")
  };
}

function buildPerUnitSuggestion(subcategoryName: string): SuggestedPricingDefinition {
  const normalized = readTrimmedString(subcategoryName).toLowerCase();

  if (normalized.includes("dish")) {
    return {
      pricingModel: "per_unit",
      pricingConfig: buildPerUnitConfig(5, "dish", 20)
    };
  }

  if (normalized.includes("clothes")) {
    return {
      pricingModel: "per_unit",
      pricingConfig: buildPerUnitConfig(149, "set", 1)
    };
  }

  if (normalized.includes("bike")) {
    return {
      pricingModel: "per_unit",
      pricingConfig: buildPerUnitConfig(199, "bike", 1)
    };
  }

  if (normalized.includes("car")) {
    return {
      pricingModel: "per_unit",
      pricingConfig: buildPerUnitConfig(299, "car", 1)
    };
  }

  if (normalized.includes("curtain")) {
    return {
      pricingModel: "per_unit",
      pricingConfig: buildPerUnitConfig(99, "curtain", 2)
    };
  }

  return {
    pricingModel: "per_unit",
    pricingConfig: buildPerUnitConfig(199, "item", 1)
  };
}

function buildFixedSuggestion(subcategoryName: string): SuggestedPricingDefinition {
  const normalized = readTrimmedString(subcategoryName).toLowerCase();
  const fixedPrice =
    normalized.includes("fan") ? 199 :
    normalized.includes("light") ? 149 :
    normalized.includes("tv") ? 399 :
    normalized.includes("cctv") ? 499 :
    normalized.includes("washing machine") ? 399 :
    normalized.includes("inverter") ? 499 :
    normalized.includes("hair") ? 199 :
    normalized.includes("beard") ? 149 :
    normalized.includes("facial") ? 399 :
    normalized.includes("bridal") ? 3999 :
    normalized.includes("party") ? 1299 :
    299;

  return {
    pricingModel: "fixed",
    pricingConfig: buildFixedConfig(
      fixedPrice,
      `Flat-rate ${readTrimmedString(subcategoryName).toLowerCase()} visit with standard scope included.`
    )
  };
}

function buildTimeBasedSuggestion(subcategoryName: string): SuggestedPricingDefinition {
  const normalized = readTrimmedString(subcategoryName).toLowerCase();
  const hourlyRate =
    normalized.includes("patient") ? 249 :
    normalized.includes("elder") ? 225 :
    normalized.includes("night") ? 199 :
    199;
  const dayRate =
    normalized.includes("patient") ? 1699 :
    normalized.includes("elder") ? 1499 :
    normalized.includes("night") ? 1499 :
    1299;

  return {
    pricingModel: "time_based",
    pricingConfig: buildTimeBasedConfig(hourlyRate, dayRate)
  };
}

function buildInspectionSuggestion(subcategoryName: string): SuggestedPricingDefinition {
  const normalized = readTrimmedString(subcategoryName).toLowerCase();
  const visitCharge =
    normalized.includes("engine") ? 299 :
    normalized.includes("battery") ? 249 :
    normalized.includes("tank") ? 299 :
    normalized.includes("ac") ? 299 :
    199;

  return {
    pricingModel: "inspection",
    pricingConfig: buildInspectionConfig(visitCharge)
  };
}

function buildMealSuggestion(subcategoryName: string): SuggestedPricingDefinition {
  const normalized = readTrimmedString(subcategoryName).toLowerCase();

  if (normalized.includes("event")) {
    return {
      pricingModel: "meal_based",
      pricingConfig: buildMealBasedConfig([
        { id: "small-event", name: "Small Gathering", price: 2500, description: "Up to 15 guests." },
        { id: "medium-event", name: "Celebration Menu", price: 4500, description: "16 to 30 guests." },
        { id: "large-event", name: "Full Event Service", price: 8000, description: "31 to 50 guests." }
      ])
    };
  }

  if (normalized.includes("non-veg")) {
    return {
      pricingModel: "meal_based",
      pricingConfig: buildMealBasedConfig([
        { id: "breakfast", name: "Breakfast", price: 180, description: "Fresh morning prep." },
        { id: "lunch", name: "Lunch", price: 260, description: "Standard home lunch service." },
        { id: "dinner", name: "Dinner", price: 260, description: "Evening meal preparation." },
        { id: "monthly", name: "Monthly Cook", price: 7000, description: "Recurring daily cooking plan." }
      ])
    };
  }

  return {
    pricingModel: "meal_based",
    pricingConfig: buildMealBasedConfig([
      { id: "breakfast", name: "Breakfast", price: 150, description: "Light morning meal." },
      { id: "lunch", name: "Lunch", price: 200, description: "Regular lunch preparation." },
      { id: "dinner", name: "Dinner", price: 200, description: "Regular dinner preparation." },
      { id: "monthly", name: "Monthly Cook", price: 6000, description: "Recurring home cook plan." }
    ])
  };
}

export function normalizePricingModel(value: unknown): PricingModel | null {
  const normalized = readTrimmedString(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) {
    return null;
  }

  return pricingModelValues.has(normalized as PricingModel) ? (normalized as PricingModel) : null;
}

export function getSuggestedPricingDefinition(
  categoryName: string,
  subcategoryName: string
): SuggestedPricingDefinition {
  const model = categoryModel(categoryName);

  switch (model) {
    case "package":
      return buildCleaningSuggestion(subcategoryName);
    case "per_unit":
      return buildPerUnitSuggestion(subcategoryName);
    case "fixed":
      return buildFixedSuggestion(subcategoryName);
    case "time_based":
      return buildTimeBasedSuggestion(subcategoryName);
    case "inspection":
      return buildInspectionSuggestion(subcategoryName);
    case "meal_based":
      return buildMealSuggestion(subcategoryName);
    default:
      return {
        pricingModel: "fixed",
        pricingConfig: buildFixedConfig(299, "Flat-rate service.")
      };
  }
}

export function normalizePricingConfiguration(
  data: Record<string, unknown>,
  pricingModel: PricingModel,
  subcategoryName: string,
  categoryName = ""
): PricingConfiguration {
  const suggested = getSuggestedPricingDefinition(categoryName, subcategoryName);
  const seed =
    suggested.pricingModel === pricingModel ? suggested.pricingConfig : buildEmptyPricingConfiguration();
  const source = readRecord(data.pricingConfig) || data;

  const packagesSource = readRecordArray(source.packages);
  const addonsSource = readRecordArray(source.addons);
  const shiftsSource = readRecordArray(source.availableShifts);
  const mealOptionsSource = readRecordArray(source.mealOptions);

  const packages = (packagesSource.length > 0 ? packagesSource : seed.packages.map((entry) => ({ ...entry })))
    .map((entry, index) => normalizePackageOption(entry, index, seed.packages[index] || null))
    .filter((entry): entry is PackageOption => Boolean(entry));

  const addons = (addonsSource.length > 0 ? addonsSource : seed.addons.map((entry) => ({ ...entry })))
    .map((entry, index) => normalizeAddonOption(entry, index, seed.addons[index] || null))
    .filter((entry): entry is AddonOption => Boolean(entry));

  const availableShifts = (
    shiftsSource.length > 0 ? shiftsSource : seed.availableShifts.map((entry) => ({ ...entry }))
  )
    .map((entry, index) => normalizeTimeShiftOption(entry, index, seed.availableShifts[index] || null))
    .filter((entry): entry is TimeShiftOption => Boolean(entry));

  const mealOptions = (
    mealOptionsSource.length > 0 ? mealOptionsSource : seed.mealOptions.map((entry) => ({ ...entry }))
  )
    .map((entry, index) => normalizeMealOption(entry, index, seed.mealOptions[index] || null))
    .filter((entry): entry is MealOption => Boolean(entry));

  return {
    packages,
    addons,
    unitPrice: readNonNegativeNumber(source.unitPrice) ?? seed.unitPrice,
    unitLabel: readTrimmedString(source.unitLabel) || seed.unitLabel,
    minUnits: readPositiveInteger(source.minUnits) ?? seed.minUnits,
    fixedPrice: readNonNegativeNumber(source.fixedPrice) ?? seed.fixedPrice,
    serviceDescription: readTrimmedString(source.serviceDescription) || seed.serviceDescription,
    hourlyRate: readNonNegativeNumber(source.hourlyRate) ?? seed.hourlyRate,
    dayRate: readNonNegativeNumber(source.dayRate) ?? seed.dayRate,
    availableShifts,
    visitCharge: readNonNegativeNumber(source.visitCharge) ?? seed.visitCharge,
    requiresApproval: readBoolean(source.requiresApproval, seed.requiresApproval),
    mealOptions
  };
}

export function validatePricingModelPayload(
  data: Record<string, unknown>,
  categoryName: string,
  subcategoryName: string
): { pricingModel: PricingModel | null; pricingConfig: PricingConfiguration | null; error: string } {
  const pricingModel =
    normalizePricingModel(data.pricingModel) ||
    normalizePricingModel(data.pricing_model) ||
    normalizePricingModel(data.model);

  if (!pricingModel) {
    return { pricingModel: null, pricingConfig: null, error: "pricingModel is required." };
  }

  const pricingConfig = normalizePricingConfiguration(data, pricingModel, subcategoryName, categoryName);

  if (pricingModel === "package" && pricingConfig.packages.length === 0) {
    return { pricingModel: null, pricingConfig: null, error: "At least one package is required." };
  }

  if (
    pricingModel === "per_unit" &&
    (pricingConfig.unitPrice === null || !pricingConfig.unitLabel || pricingConfig.minUnits <= 0)
  ) {
    return {
      pricingModel: null,
      pricingConfig: null,
      error: "unitPrice, unitLabel and minUnits are required for per-unit pricing."
    };
  }

  if (pricingModel === "fixed" && pricingConfig.fixedPrice === null) {
    return { pricingModel: null, pricingConfig: null, error: "fixedPrice is required for fixed pricing." };
  }

  if (
    pricingModel === "time_based" &&
    (pricingConfig.hourlyRate === null || pricingConfig.availableShifts.length === 0)
  ) {
    return {
      pricingModel: null,
      pricingConfig: null,
      error: "hourlyRate and availableShifts are required for time-based pricing."
    };
  }

  if (pricingModel === "inspection" && pricingConfig.visitCharge === null) {
    return { pricingModel: null, pricingConfig: null, error: "visitCharge is required for inspection pricing." };
  }

  if (pricingModel === "meal_based" && pricingConfig.mealOptions.length === 0) {
    return { pricingModel: null, pricingConfig: null, error: "At least one meal option is required." };
  }

  return { pricingModel, pricingConfig, error: "" };
}

export function calculateStartingPrice(pricingModel: PricingModel, pricingConfig: PricingConfiguration): number | null {
  switch (pricingModel) {
    case "package":
      return pricingConfig.packages.reduce<number | null>((current, entry) => {
        if (current === null || entry.price < current) {
          return entry.price;
        }
        return current;
      }, null);
    case "per_unit":
      if (pricingConfig.unitPrice === null) return null;
      return pricingConfig.unitPrice * Math.max(1, pricingConfig.minUnits);
    case "fixed":
      return pricingConfig.fixedPrice;
    case "time_based": {
      const shiftPrices = pricingConfig.availableShifts.map((shift) =>
        pricingConfig.dayRate !== null && shift.hours >= 8
          ? pricingConfig.dayRate
          : (pricingConfig.hourlyRate || 0) * shift.hours
      );
      const smallestShift = shiftPrices.reduce<number | null>((current, entry) => {
        if (current === null || entry < current) {
          return entry;
        }
        return current;
      }, null);
      return smallestShift ?? pricingConfig.hourlyRate;
    }
    case "inspection":
      return pricingConfig.visitCharge;
    case "meal_based":
      return pricingConfig.mealOptions.reduce<number | null>((current, entry) => {
        if (current === null || entry.price < current) {
          return entry.price;
        }
        return current;
      }, null);
    default:
      return null;
  }
}

export function isInspectionPricingModel(pricingModel: PricingModel): boolean {
  return pricingModel === "inspection";
}

export function calculateBookingSelection(
  pricingModel: PricingModel,
  pricingConfig: PricingConfiguration,
  selection: PricingSelection
): CalculatedPricingSelection {
  const selectedAddons = pricingConfig.addons.filter((addon) =>
    (selection.selectedAddons || []).some(
      (entry) => entry === addon.id || entry.toLowerCase() === addon.name.toLowerCase()
    )
  );

  switch (pricingModel) {
    case "package": {
      const selectedPackage =
        pricingConfig.packages.find(
          (entry) =>
            entry.id === selection.selectedPackage ||
            entry.name.toLowerCase() === readTrimmedString(selection.selectedPackage).toLowerCase()
        ) || pricingConfig.packages.find((entry) => entry.recommended) || pricingConfig.packages[0] || null;

      const finalPrice =
        (selectedPackage?.price || 0) + selectedAddons.reduce((sum, addon) => sum + addon.price, 0);

      return {
        pricingModel,
        selectedPackage,
        selectedUnits: null,
        selectedHours: null,
        selectedShift: null,
        selectedMeal: null,
        selectedAddons,
        visitCharge: null,
        finalPrice,
        paymentStatus: "paid",
        approvalStatus: "not_required",
        workerEstimate: null,
        userApproval: true,
        adminFlag: false
      };
    }
    case "per_unit": {
      const selectedUnits = Math.max(pricingConfig.minUnits, readPositiveInteger(selection.selectedUnits) || pricingConfig.minUnits);
      const finalPrice = (pricingConfig.unitPrice || 0) * selectedUnits;

      return {
        pricingModel,
        selectedPackage: null,
        selectedUnits,
        selectedHours: null,
        selectedShift: null,
        selectedMeal: null,
        selectedAddons: [],
        visitCharge: null,
        finalPrice,
        paymentStatus: "paid",
        approvalStatus: "not_required",
        workerEstimate: null,
        userApproval: true,
        adminFlag: false
      };
    }
    case "fixed": {
      return {
        pricingModel,
        selectedPackage: null,
        selectedUnits: null,
        selectedHours: null,
        selectedShift: null,
        selectedMeal: null,
        selectedAddons: [],
        visitCharge: null,
        finalPrice: pricingConfig.fixedPrice || 0,
        paymentStatus: "paid",
        approvalStatus: "not_required",
        workerEstimate: null,
        userApproval: true,
        adminFlag: false
      };
    }
    case "time_based": {
      const selectedShift =
        pricingConfig.availableShifts.find(
          (entry) =>
            entry.id === selection.selectedShift ||
            entry.name.toLowerCase() === readTrimmedString(selection.selectedShift).toLowerCase()
        ) || pricingConfig.availableShifts[0] || null;
      const selectedHours =
        readPositiveInteger(selection.selectedHours) || selectedShift?.hours || 1;
      const finalPrice =
        pricingConfig.dayRate !== null && selectedHours >= 8
          ? pricingConfig.dayRate
          : (pricingConfig.hourlyRate || 0) * selectedHours;

      return {
        pricingModel,
        selectedPackage: null,
        selectedUnits: null,
        selectedHours,
        selectedShift,
        selectedMeal: null,
        selectedAddons: [],
        visitCharge: null,
        finalPrice,
        paymentStatus: "paid",
        approvalStatus: "not_required",
        workerEstimate: null,
        userApproval: true,
        adminFlag: false
      };
    }
    case "inspection": {
      return {
        pricingModel,
        selectedPackage: null,
        selectedUnits: null,
        selectedHours: null,
        selectedShift: null,
        selectedMeal: null,
        selectedAddons: [],
        visitCharge: pricingConfig.visitCharge,
        finalPrice: pricingConfig.visitCharge || 0,
        paymentStatus: "visit_charge_paid",
        approvalStatus: pricingConfig.requiresApproval ? "awaiting_estimate" : "not_required",
        workerEstimate: null,
        userApproval: false,
        adminFlag: false
      };
    }
    case "meal_based":
    default: {
      const selectedMeal =
        pricingConfig.mealOptions.find(
          (entry) =>
            entry.id === selection.selectedMeal ||
            entry.name.toLowerCase() === readTrimmedString(selection.selectedMeal).toLowerCase()
        ) || pricingConfig.mealOptions[0] || null;

      return {
        pricingModel,
        selectedPackage: null,
        selectedUnits: null,
        selectedHours: null,
        selectedShift: null,
        selectedMeal,
        selectedAddons: [],
        visitCharge: null,
        finalPrice: selectedMeal?.price || 0,
        paymentStatus: "paid",
        approvalStatus: "not_required",
        workerEstimate: null,
        userApproval: true,
        adminFlag: false
      };
    }
  }
}
