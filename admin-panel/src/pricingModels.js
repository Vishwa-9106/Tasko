export const pricingModelOptions = [
  { value: "package", label: "Package" },
  { value: "per_unit", label: "Per Unit" },
  { value: "fixed", label: "Fixed" },
  { value: "time_based", label: "Time Based" },
  { value: "inspection", label: "Inspection" },
  { value: "meal_based", label: "Meal Based" }
];

function readString(value) {
  return String(value || "").trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.trunc(parsed)) : null;
}

export function createDefaultPricingConfig(pricingModel = "fixed") {
  if (pricingModel === "package") {
    return {
      packages: [
        {
          id: "starter",
          name: "Starter",
          price: "",
          description: "",
          recommended: true,
          featuresText: "Surface dusting\nFloor cleaning\nBasic sanitisation"
        }
      ],
      addons: [{ id: "addon-1", name: "", price: "" }],
      unitPrice: "",
      unitLabel: "",
      minUnits: "1",
      fixedPrice: "",
      serviceDescription: "",
      hourlyRate: "",
      dayRate: "",
      availableShifts: [],
      visitCharge: "",
      requiresApproval: true,
      mealOptions: []
    };
  }

  if (pricingModel === "per_unit") {
    return {
      packages: [],
      addons: [],
      unitPrice: "",
      unitLabel: "",
      minUnits: "1",
      fixedPrice: "",
      serviceDescription: "",
      hourlyRate: "",
      dayRate: "",
      availableShifts: [],
      visitCharge: "",
      requiresApproval: true,
      mealOptions: []
    };
  }

  if (pricingModel === "time_based") {
    return {
      packages: [],
      addons: [],
      unitPrice: "",
      unitLabel: "",
      minUnits: "1",
      fixedPrice: "",
      serviceDescription: "",
      hourlyRate: "",
      dayRate: "",
      availableShifts: [
        { id: "2-hours", name: "2 Hours", hours: "2", label: "Quick support slot" },
        { id: "4-hours", name: "4 Hours", hours: "4", label: "Half shift" },
        { id: "8-hours", name: "8 Hours", hours: "8", label: "Full Day (9AM-5PM)" },
        { id: "night-care", name: "Night Care", hours: "10", label: "Night Care (9PM-7AM)" }
      ],
      visitCharge: "",
      requiresApproval: true,
      mealOptions: []
    };
  }

  if (pricingModel === "inspection") {
    return {
      packages: [],
      addons: [],
      unitPrice: "",
      unitLabel: "",
      minUnits: "1",
      fixedPrice: "",
      serviceDescription: "",
      hourlyRate: "",
      dayRate: "",
      availableShifts: [],
      visitCharge: "",
      requiresApproval: true,
      mealOptions: []
    };
  }

  if (pricingModel === "meal_based") {
    return {
      packages: [],
      addons: [],
      unitPrice: "",
      unitLabel: "",
      minUnits: "1",
      fixedPrice: "",
      serviceDescription: "",
      hourlyRate: "",
      dayRate: "",
      availableShifts: [],
      visitCharge: "",
      requiresApproval: true,
      mealOptions: [{ id: "meal-1", name: "Breakfast", price: "", description: "" }]
    };
  }

  return {
    packages: [],
    addons: [],
    unitPrice: "",
    unitLabel: "",
    minUnits: "1",
    fixedPrice: "",
    serviceDescription: "",
    hourlyRate: "",
    dayRate: "",
    availableShifts: [],
    visitCharge: "",
    requiresApproval: true,
    mealOptions: []
  };
}

export function createEmptySubcategoryDraft() {
  return {
    name: "",
    pricingModel: "fixed",
    pricingConfig: createDefaultPricingConfig("fixed")
  };
}

export function normalizeSubcategory(record) {
  return {
    id: readString(record?.id),
    categoryId: readString(record?.categoryId || record?.category_id),
    name: readString(record?.name),
    pricingModel: readString(record?.pricingModel) || "fixed",
    pricingConfig: record?.pricingConfig || createDefaultPricingConfig(readString(record?.pricingModel) || "fixed"),
    startingPrice: toNumber(record?.startingPrice),
    paymentFlow: readString(record?.paymentFlow),
    createdAt: record?.createdAt || "",
    updatedAt: record?.updatedAt || ""
  };
}

export function normalizeSubcategoryDraft(record) {
  const pricingModel = readString(record?.pricingModel) || "fixed";
  const config = record?.pricingConfig || {};
  const fallback = createDefaultPricingConfig(pricingModel);

  return {
    name: readString(record?.name),
    pricingModel,
    pricingConfig: {
      ...fallback,
      packages: Array.isArray(config?.packages)
        ? config.packages.map((entry, index) => ({
            id: readString(entry?.id) || `package-${index + 1}`,
            name: readString(entry?.name),
            price: entry?.price === 0 ? "0" : readString(entry?.price),
            description: readString(entry?.description),
            recommended: Boolean(entry?.recommended),
            featuresText: Array.isArray(entry?.features) ? entry.features.join("\n") : ""
          }))
        : fallback.packages,
      addons: Array.isArray(config?.addons)
        ? config.addons.map((entry, index) => ({
            id: readString(entry?.id) || `addon-${index + 1}`,
            name: readString(entry?.name),
            price: entry?.price === 0 ? "0" : readString(entry?.price)
          }))
        : fallback.addons,
      unitPrice: config?.unitPrice === 0 ? "0" : readString(config?.unitPrice),
      unitLabel: readString(config?.unitLabel),
      minUnits: config?.minUnits ? String(config.minUnits) : fallback.minUnits,
      fixedPrice: config?.fixedPrice === 0 ? "0" : readString(config?.fixedPrice),
      serviceDescription: readString(config?.serviceDescription),
      hourlyRate: config?.hourlyRate === 0 ? "0" : readString(config?.hourlyRate),
      dayRate: config?.dayRate === 0 ? "0" : readString(config?.dayRate),
      availableShifts: Array.isArray(config?.availableShifts)
        ? config.availableShifts.map((entry, index) => ({
            id: readString(entry?.id) || `shift-${index + 1}`,
            name: readString(entry?.name),
            hours: entry?.hours ? String(entry.hours) : "",
            label: readString(entry?.label)
          }))
        : fallback.availableShifts,
      visitCharge: config?.visitCharge === 0 ? "0" : readString(config?.visitCharge),
      requiresApproval: config?.requiresApproval ?? fallback.requiresApproval,
      mealOptions: Array.isArray(config?.mealOptions)
        ? config.mealOptions.map((entry, index) => ({
            id: readString(entry?.id) || `meal-${index + 1}`,
            name: readString(entry?.name),
            price: entry?.price === 0 ? "0" : readString(entry?.price),
            description: readString(entry?.description)
          }))
        : fallback.mealOptions
    }
  };
}

export function calculateStartingPrice(pricingModel, pricingConfig) {
  if (pricingModel === "package") {
    return pricingConfig.packages.reduce((current, entry) => {
      const price = toNumber(entry?.price);
      return price !== null && (current === null || price < current) ? price : current;
    }, null);
  }
  if (pricingModel === "per_unit") {
    const unitPrice = toNumber(pricingConfig.unitPrice);
    const minUnits = toPositiveInteger(pricingConfig.minUnits) || 1;
    return unitPrice === null ? null : unitPrice * minUnits;
  }
  if (pricingModel === "fixed") {
    return toNumber(pricingConfig.fixedPrice);
  }
  if (pricingModel === "time_based") {
    const hourlyRate = toNumber(pricingConfig.hourlyRate);
    const shiftPrice = (Array.isArray(pricingConfig.availableShifts) ? pricingConfig.availableShifts : []).reduce((current, shift) => {
      const hours = toPositiveInteger(shift?.hours);
      if (hours === null || hourlyRate === null) return current;
      const price = hourlyRate * hours;
      return current === null || price < current ? price : current;
    }, null);
    return shiftPrice ?? hourlyRate;
  }
  if (pricingModel === "inspection") {
    return toNumber(pricingConfig.visitCharge);
  }
  if (pricingModel === "meal_based") {
    return pricingConfig.mealOptions.reduce((current, entry) => {
      const price = toNumber(entry?.price);
      return price !== null && (current === null || price < current) ? price : current;
    }, null);
  }
  return null;
}

export function buildSubcategoryPricingSummary(record) {
  const pricingModel = readString(record?.pricingModel);
  const startingPrice = record?.startingPrice ?? calculateStartingPrice(pricingModel, record?.pricingConfig || {});
  const formattedPrice = startingPrice === null ? "Set in config" : money(startingPrice);

  if (pricingModel === "package") return `Package model • ${formattedPrice}`;
  if (pricingModel === "per_unit") return `Per unit • ${formattedPrice}`;
  if (pricingModel === "fixed") return `Fixed • ${formattedPrice}`;
  if (pricingModel === "time_based") return `Time based • ${formattedPrice}`;
  if (pricingModel === "inspection") return `Inspection • ${formattedPrice}`;
  if (pricingModel === "meal_based") return `Meal based • ${formattedPrice}`;
  return formattedPrice;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export function validateSubcategoryDraft(draft) {
  const name = readString(draft?.name).replace(/\s+/g, " ");
  const pricingModel = readString(draft?.pricingModel);
  const config = draft?.pricingConfig || {};

  if (!name) {
    return { error: "Subcategory name is required.", payload: null };
  }

  if (!pricingModelOptions.some((option) => option.value === pricingModel)) {
    return { error: "Pricing model is required.", payload: null };
  }

  const payload = {
    name,
    pricingModel,
    pricingConfig: {
      packages: Array.isArray(config.packages)
        ? config.packages
            .map((entry, index) => {
              const packageName = readString(entry?.name);
              const packagePrice = toNumber(entry?.price);
              if (!packageName || packagePrice === null) return null;
              return {
                id: readString(entry?.id) || `package-${index + 1}`,
                name: packageName,
                price: packagePrice,
                description: readString(entry?.description),
                recommended: Boolean(entry?.recommended),
                features: readString(entry?.featuresText)
                  .split(/\r?\n/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              };
            })
            .filter(Boolean)
        : [],
      addons: Array.isArray(config.addons)
        ? config.addons
            .map((entry, index) => {
              const addonName = readString(entry?.name);
              const addonPrice = toNumber(entry?.price);
              if (!addonName || addonPrice === null) return null;
              return {
                id: readString(entry?.id) || `addon-${index + 1}`,
                name: addonName,
                price: addonPrice
              };
            })
            .filter(Boolean)
        : [],
      unitPrice: toNumber(config.unitPrice),
      unitLabel: readString(config.unitLabel),
      minUnits: toPositiveInteger(config.minUnits) || 1,
      fixedPrice: toNumber(config.fixedPrice),
      serviceDescription: readString(config.serviceDescription),
      hourlyRate: toNumber(config.hourlyRate),
      dayRate: toNumber(config.dayRate),
      availableShifts: Array.isArray(config.availableShifts)
        ? config.availableShifts
            .map((entry, index) => {
              const shiftName = readString(entry?.name);
              const shiftHours = toPositiveInteger(entry?.hours);
              if (!shiftName || shiftHours === null) return null;
              return {
                id: readString(entry?.id) || `shift-${index + 1}`,
                name: shiftName,
                hours: shiftHours,
                label: readString(entry?.label)
              };
            })
            .filter(Boolean)
        : [],
      visitCharge: toNumber(config.visitCharge),
      requiresApproval: Boolean(config.requiresApproval),
      mealOptions: Array.isArray(config.mealOptions)
        ? config.mealOptions
            .map((entry, index) => {
              const mealName = readString(entry?.name);
              const mealPrice = toNumber(entry?.price);
              if (!mealName || mealPrice === null) return null;
              return {
                id: readString(entry?.id) || `meal-${index + 1}`,
                name: mealName,
                price: mealPrice,
                description: readString(entry?.description)
              };
            })
            .filter(Boolean)
        : []
    }
  };

  if (pricingModel === "package" && payload.pricingConfig.packages.length === 0) {
    return { error: "Add at least one package.", payload: null };
  }

  if (pricingModel === "per_unit" && (!payload.pricingConfig.unitPrice || !payload.pricingConfig.unitLabel)) {
    return { error: "Per unit pricing requires unit price and unit label.", payload: null };
  }

  if (pricingModel === "fixed" && payload.pricingConfig.fixedPrice === null) {
    return { error: "Fixed pricing requires a fixed price.", payload: null };
  }

  if (pricingModel === "time_based" && (!payload.pricingConfig.hourlyRate || payload.pricingConfig.availableShifts.length === 0)) {
    return { error: "Time based pricing requires hourly rate and at least one shift.", payload: null };
  }

  if (pricingModel === "inspection" && payload.pricingConfig.visitCharge === null) {
    return { error: "Inspection pricing requires a visit charge.", payload: null };
  }

  if (pricingModel === "meal_based" && payload.pricingConfig.mealOptions.length === 0) {
    return { error: "Add at least one meal option.", payload: null };
  }

  return { error: "", payload };
}
