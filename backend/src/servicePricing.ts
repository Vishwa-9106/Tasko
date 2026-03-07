export type PricingType = "fixed" | "per_unit" | "per_hour" | "starting_at";

export type ServicePricing = {
  pricingType: PricingType;
  price: number | null;
  unitLabel: string;
  pricingNotes: string;
  priceSummary: string;
  isVariablePrice: boolean;
};

type SuggestedPricingSeed = {
  pricingType: PricingType;
  price: number;
  unitLabel?: string;
  pricingNotes?: string;
};

const pricingTypeValues = new Set<PricingType>(["fixed", "per_unit", "per_hour", "starting_at"]);

const suggestedPricingBySubcategoryName = new Map<string, SuggestedPricingSeed>(
  Object.entries({
    "house cleaning": { pricingType: "fixed", price: 999, pricingNotes: "Standard cleaning visit for a compact home." },
    "deep cleaning": { pricingType: "starting_at", price: 1499, pricingNotes: "Final price depends on property size and scope." },
    "bathroom cleaning": { pricingType: "per_unit", price: 249, unitLabel: "bathroom" },
    "kitchen cleaning": { pricingType: "fixed", price: 399 },
    "laundry service": { pricingType: "per_unit", price: 149, unitLabel: "set" },
    "curtain washing": { pricingType: "per_unit", price: 99, unitLabel: "curtain" },
    "sofa shampooing": { pricingType: "starting_at", price: 599, pricingNotes: "Larger sofa sets may cost extra." },
    "carpet washing": { pricingType: "starting_at", price: 399 },
    "appliance maintenance": { pricingType: "starting_at", price: 249, pricingNotes: "Inspection and diagnosis charge." },
    "home painting": { pricingType: "per_unit", price: 18, unitLabel: "sq ft", pricingNotes: "Paint and material cost extra." },
    carpentry: { pricingType: "starting_at", price: 299 },
    "general home checkup": { pricingType: "fixed", price: 399 },
    "bike service": { pricingType: "fixed", price: 399 },
    "car service": { pricingType: "fixed", price: 999 },
    "battery check": { pricingType: "fixed", price: 149 },
    "doorstep mechanic": { pricingType: "fixed", price: 299, pricingNotes: "Visit charge only. Parts extra." },
    "pipe leakage fix": { pricingType: "fixed", price: 249 },
    "tap installation": { pricingType: "fixed", price: 199 },
    "drain cleaning": { pricingType: "fixed", price: 299 },
    "bathroom fitting": { pricingType: "starting_at", price: 349, pricingNotes: "Fittings and parts charged separately." },
    "ac repair": { pricingType: "starting_at", price: 349, pricingNotes: "Inspection included. Parts charged separately." },
    electrician: { pricingType: "starting_at", price: 249 },
    "cctv installation": { pricingType: "per_unit", price: 499, unitLabel: "camera" },
    "washing machine setup": { pricingType: "fixed", price: 399 },
    "elder care": { pricingType: "per_unit", price: 699, unitLabel: "shift" },
    "patient care": { pricingType: "per_unit", price: 899, unitLabel: "shift" },
    "baby care": { pricingType: "per_unit", price: 799, unitLabel: "shift" },
    "companion assistance": { pricingType: "per_unit", price: 599, unitLabel: "shift" },
    "home salon": { pricingType: "starting_at", price: 499 },
    haircut: { pricingType: "fixed", price: 199 },
    "bridal makeup": { pricingType: "starting_at", price: 3999 },
    "grooming service": { pricingType: "fixed", price: 299 },
    "daily cook": { pricingType: "fixed", price: 299, pricingNotes: "Per visit for standard daily cooking." },
    "party cook": { pricingType: "starting_at", price: 1499, pricingNotes: "Depends on guest count and menu." },
    "north indian cook": { pricingType: "fixed", price: 349 },
    "south indian cook": { pricingType: "fixed", price: 349 },
    "dish washing": { pricingType: "fixed", price: 149 },
    "clothes washing": { pricingType: "per_unit", price: 149, unitLabel: "set" },
    "bike washing": { pricingType: "fixed", price: 199 },
    "car washing": { pricingType: "fixed", price: 299 },
    "sofa / carpet washing": { pricingType: "starting_at", price: 599 },
    "garden maintenance": { pricingType: "starting_at", price: 399 },
    "lawn cutting": { pricingType: "starting_at", price: 299 },
    "water tank cleaning": { pricingType: "starting_at", price: 499 },
    "general home maintenance": { pricingType: "starting_at", price: 399 },
    "minor repair work": { pricingType: "starting_at", price: 249 },
    "bike repair": { pricingType: "starting_at", price: 299 },
    "car repair": { pricingType: "starting_at", price: 699 },
    "puncture fix": { pricingType: "fixed", price: 149 },
    "engine check": { pricingType: "starting_at", price: 299 },
    "battery replacement": { pricingType: "starting_at", price: 199, pricingNotes: "Battery cost extra." },
    "drain block cleaning": { pricingType: "fixed", price: 299 },
    "bathroom fitting repair": { pricingType: "starting_at", price: 349 },
    "water motor repair": { pricingType: "starting_at", price: 399 },
    "fan installation": { pricingType: "fixed", price: 249 },
    "light installation": { pricingType: "fixed", price: 149 },
    "tv installation": { pricingType: "fixed", price: 399 },
    "inverter installation": { pricingType: "starting_at", price: 499 },
    babysitting: { pricingType: "per_unit", price: 699, unitLabel: "shift" },
    "full day care": { pricingType: "fixed", price: 1299 },
    "night care": { pricingType: "fixed", price: 899 },
    "hair cutting": { pricingType: "fixed", price: 199 },
    "beard styling": { pricingType: "fixed", price: 149 },
    facial: { pricingType: "starting_at", price: 399 },
    "party makeup": { pricingType: "starting_at", price: 1299 },
    "home cook (daily)": { pricingType: "fixed", price: 299 },
    "event cooking": { pricingType: "starting_at", price: 1499 },
    "veg cooking": { pricingType: "fixed", price: 349 },
    "non-veg cooking": { pricingType: "fixed", price: 399 },
    "temporary cook": { pricingType: "starting_at", price: 499 },
    "ac installation": { pricingType: "starting_at", price: 1499 },
    "ac gas refill": { pricingType: "starting_at", price: 2299 },
    "ac general service": { pricingType: "fixed", price: 599 },
    "ac not cooling issue": { pricingType: "starting_at", price: 349 },
    "ac water leakage fix": { pricingType: "fixed", price: 299 }
  })
);

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function readNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function normalizePricingType(value: unknown): PricingType | null {
  const normalized = readTrimmedString(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) {
    return null;
  }
  return pricingTypeValues.has(normalized as PricingType) ? (normalized as PricingType) : null;
}

function defaultUnitLabelForType(pricingType: PricingType): string {
  if (pricingType === "per_hour") return "hour";
  if (pricingType === "per_unit") return "unit";
  return "";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

export function getSuggestedPricingForSubcategory(name: string): Omit<ServicePricing, "priceSummary" | "isVariablePrice"> | null {
  const suggested = suggestedPricingBySubcategoryName.get(readTrimmedString(name).toLowerCase());
  if (!suggested) {
    return null;
  }

  const pricingType = suggested.pricingType;
  return {
    pricingType,
    price: suggested.price,
    unitLabel: readTrimmedString(suggested.unitLabel) || defaultUnitLabelForType(pricingType),
    pricingNotes: readTrimmedString(suggested.pricingNotes)
  };
}

export function buildPriceSummary(input: {
  pricingType: PricingType;
  price: number | null;
  unitLabel?: string;
}): string {
  if (input.price === null || !Number.isFinite(input.price)) {
    return "Pricing on request";
  }

  const currency = formatCurrency(input.price);
  const unitLabel = readTrimmedString(input.unitLabel);

  switch (input.pricingType) {
    case "per_unit":
      return `${currency} per ${unitLabel || "unit"}`;
    case "per_hour":
      return `${currency} per ${unitLabel || "hour"}`;
    case "starting_at":
      return `Starts at ${currency}`;
    case "fixed":
    default:
      return `${currency} fixed`;
  }
}

export function isVariablePricing(pricingType: PricingType): boolean {
  return pricingType !== "fixed";
}

export function normalizeServicePricing(
  data: Record<string, unknown>,
  fallbackName = ""
): ServicePricing {
  const suggested = getSuggestedPricingForSubcategory(fallbackName);
  const pricingType =
    normalizePricingType(data.pricingType) ||
    normalizePricingType(data.pricing_type) ||
    normalizePricingType(data.priceType) ||
    suggested?.pricingType ||
    "fixed";
  const price =
    readNonNegativeNumber(data.price) ??
    readNonNegativeNumber(data.basePrice) ??
    readNonNegativeNumber(data.quotedPrice) ??
    suggested?.price ??
    null;
  const unitLabel =
    readTrimmedString(data.unitLabel) ||
    readTrimmedString(data.unit_label) ||
    readTrimmedString(data.pricingUnitLabel) ||
    suggested?.unitLabel ||
    defaultUnitLabelForType(pricingType);
  const pricingNotes =
    readTrimmedString(data.pricingNotes) ||
    readTrimmedString(data.pricing_notes) ||
    readTrimmedString(data.notes) ||
    suggested?.pricingNotes ||
    "";

  return {
    pricingType,
    price,
    unitLabel: pricingType === "fixed" || pricingType === "starting_at" ? unitLabel : unitLabel || defaultUnitLabelForType(pricingType),
    pricingNotes,
    priceSummary: buildPriceSummary({ pricingType, price, unitLabel }),
    isVariablePrice: isVariablePricing(pricingType)
  };
}

export function validateServicePricingPayload(data: Record<string, unknown>): {
  pricing: ServicePricing | null;
  error: string;
} {
  const pricingType = normalizePricingType(data.pricingType);
  const price = readNonNegativeNumber(data.price);
  const unitLabel = readTrimmedString(data.unitLabel);

  if (!pricingType) {
    return { pricing: null, error: "pricingType is required." };
  }

  if (price === null) {
    return { pricing: null, error: "price must be a non-negative number." };
  }

  if ((pricingType === "per_unit" || pricingType === "per_hour") && !unitLabel) {
    return { pricing: null, error: "unitLabel is required for per-unit or per-hour pricing." };
  }

  return {
    pricing: normalizeServicePricing(data),
    error: ""
  };
}
