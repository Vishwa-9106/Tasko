import { serviceCategories } from "../pages/homeData";

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function toCategoryKey(value) {
  return normalizeText(value);
}

function toPrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function formatRupee(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export function buildPriceSummary(record) {
  if (String(record?.priceSummary || "").trim()) {
    return String(record.priceSummary).trim();
  }

  const price = toPrice(record?.price);
  if (price === null) {
    return "Pricing on request";
  }

  const amount = formatRupee(price);
  const unitLabel = String(record?.unitLabel || "").trim();

  switch (String(record?.pricingType || "fixed").trim()) {
    case "per_unit":
      return `${amount} per ${unitLabel || "unit"}`;
    case "per_hour":
      return `${amount} per ${unitLabel || "hour"}`;
    case "starting_at":
      return `Starts at ${amount}`;
    case "fixed":
    default:
      return `${amount} fixed`;
  }
}

export function buildFallbackServiceCatalog() {
  return serviceCategories.map((category) => ({
    id: String(category?.id || category?.name || "").trim(),
    name: String(category?.name || "").trim(),
    subcategories: Array.isArray(category?.subcategories)
      ? category.subcategories.map((name) => ({
          id: "",
          categoryId: String(category?.id || category?.name || "").trim(),
          name: String(name || "").trim(),
          pricingType: "fixed",
          price: null,
          unitLabel: "",
          pricingNotes: "",
          priceSummary: "Pricing on request",
          isVariablePrice: false
        }))
      : []
  }));
}

export function normalizeServiceCatalog(data) {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const normalized = categories
    .map((category) => ({
      id: String(category?.id || category?.name || "").trim(),
      name: String(category?.name || "").trim(),
      subcategories: Array.isArray(category?.subcategories)
        ? category.subcategories
            .map((subcategory) => {
              const normalizedSubcategory = {
                id: String(subcategory?.id || "").trim(),
                categoryId:
                  String(subcategory?.categoryId || subcategory?.category_id || category?.id || "").trim(),
                name: String(subcategory?.name || "").trim(),
                pricingType: String(subcategory?.pricingType || "fixed").trim() || "fixed",
                price: toPrice(subcategory?.price),
                unitLabel: String(subcategory?.unitLabel || "").trim(),
                pricingNotes: String(subcategory?.pricingNotes || "").trim(),
                priceSummary: buildPriceSummary(subcategory),
                isVariablePrice: Boolean(subcategory?.isVariablePrice)
              };

              if (!normalizedSubcategory.name) {
                return null;
              }

              return normalizedSubcategory;
            })
            .filter(Boolean)
        : []
    }))
    .filter((category) => category.name);

  return normalized.length > 0 ? normalized : buildFallbackServiceCatalog();
}

export function flattenServiceCatalog(categories) {
  return categories.flatMap((category) =>
    (Array.isArray(category?.subcategories) ? category.subcategories : []).map((subcategory) => ({
      categoryId: category.id || subcategory.categoryId || "",
      categoryName: category.name || "",
      subcategoryId: subcategory.id || "",
      subCategoryName: subcategory.name || "",
      pricingType: subcategory.pricingType || "fixed",
      price: toPrice(subcategory.price),
      unitLabel: subcategory.unitLabel || "",
      pricingNotes: subcategory.pricingNotes || "",
      priceSummary: buildPriceSummary(subcategory),
      isVariablePrice: Boolean(subcategory.isVariablePrice)
    }))
  );
}
