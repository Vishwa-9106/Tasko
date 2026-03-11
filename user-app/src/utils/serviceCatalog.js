import { serviceCategories } from "../pages/homeData";
import {
  buildStartingPriceLabel,
  calculateStartingPrice,
  formatRupee,
  getSuggestedPricingSetup,
  normalizePricingConfig,
  normalizePricingModel,
  normalizeText,
  paymentFlowForModel,
  toSlug
} from "./pricingModels";

export { formatRupee, normalizeText };

export function toCategoryKey(value) {
  return normalizeText(value);
}

export function guessServiceCategoryIcon(categoryName) {
  const normalized = toCategoryKey(categoryName);
  const matched = serviceCategories.find((category) => toCategoryKey(category.name) === normalized);
  if (matched?.icon) {
    return matched.icon;
  }

  if (
    normalized.includes("clean") ||
    normalized.includes("sanit") ||
    normalized.includes("maid") ||
    normalized.includes("housekeep")
  ) {
    return "cleaning";
  }

  if (
    normalized.includes("wash") ||
    normalized.includes("laundry") ||
    normalized.includes("sofa") ||
    normalized.includes("carpet")
  ) {
    return "washing";
  }

  if (
    normalized.includes("repair") ||
    normalized.includes("electric") ||
    normalized.includes("ac") ||
    normalized.includes("cctv") ||
    normalized.includes("install")
  ) {
    return "technical";
  }

  if (
    normalized.includes("maint") ||
    normalized.includes("paint") ||
    normalized.includes("carpent") ||
    normalized.includes("handyman")
  ) {
    return "maintenance";
  }

  if (
    normalized.includes("mechanic") ||
    normalized.includes("bike") ||
    normalized.includes("car ") ||
    normalized.endsWith(" car") ||
    normalized.includes("battery") ||
    normalized.includes("vehicle")
  ) {
    return "mechanic";
  }

  if (
    normalized.includes("plumb") ||
    normalized.includes("pipe") ||
    normalized.includes("tap") ||
    normalized.includes("drain")
  ) {
    return "plumbing";
  }

  if (
    normalized.includes("care") ||
    normalized.includes("nurs") ||
    normalized.includes("baby") ||
    normalized.includes("elder") ||
    normalized.includes("patient")
  ) {
    return "caring";
  }

  if (
    normalized.includes("beauty") ||
    normalized.includes("salon") ||
    normalized.includes("makeup") ||
    normalized.includes("barber") ||
    normalized.includes("groom")
  ) {
    return "beauty";
  }

  if (
    normalized.includes("cook") ||
    normalized.includes("chef") ||
    normalized.includes("meal") ||
    normalized.includes("kitchen")
  ) {
    return "cooking";
  }

  return "cleaning";
}

export function buildServicePath(entry) {
  const categorySlug = String(entry?.categorySlug || entry?.categoryId || entry?.categoryName || "").trim();
  const serviceSlug = String(entry?.serviceSlug || entry?.subcategoryId || entry?.subCategoryName || "").trim();
  return `/services/${encodeURIComponent(categorySlug)}/${encodeURIComponent(serviceSlug)}`;
}

function normalizeSubcategory(category, subcategory) {
  const name =
    typeof subcategory === "string"
      ? String(subcategory).trim()
      : String(subcategory?.name || "").trim();

  if (!name) {
    return null;
  }

  const categoryName = String(category?.name || "").trim();
  const categoryId = String(category?.id || categoryName || "").trim();
  const categorySlug = String(category?.categorySlug || categoryId || toSlug(categoryName)).trim() || toSlug(categoryName);
  const suggested = getSuggestedPricingSetup(categoryName, name);
  const pricingModel = normalizePricingModel(subcategory?.pricingModel, categoryName) || suggested.pricingModel;
  const pricingConfig = normalizePricingConfig(pricingModel, subcategory?.pricingConfig, categoryName, name);
  const startingPrice = calculateStartingPrice(pricingModel, pricingConfig);

  return {
    id: String(subcategory?.id || `${categoryId}-${toSlug(name)}`).trim(),
    categoryId,
    categoryName,
    categorySlug,
    serviceSlug: String(subcategory?.serviceSlug || subcategory?.slug || toSlug(name)).trim() || toSlug(name),
    name,
    description:
      String(subcategory?.description || pricingConfig.serviceDescription || "").trim() ||
      `${name} by Tasko professionals.`,
    pricingModel,
    pricingConfig,
    startingPrice,
    paymentFlow: String(subcategory?.paymentFlow || paymentFlowForModel(pricingModel)).trim(),
    startingPriceLabel:
      String(subcategory?.startingPriceLabel || "").trim() ||
      buildStartingPriceLabel(pricingModel, pricingConfig),
    createdAt: subcategory?.createdAt || "",
    updatedAt: subcategory?.updatedAt || ""
  };
}

export function buildFallbackServiceCatalog() {
  return serviceCategories.map((category) => ({
    id: String(category?.id || category?.name || "").trim(),
    name: String(category?.name || "").trim(),
    categorySlug: String(category?.id || toSlug(category?.name)).trim() || toSlug(category?.name),
    subcategories: Array.isArray(category?.subcategories)
      ? category.subcategories
          .map((name) =>
            normalizeSubcategory(
              {
                id: category?.id || category?.name || "",
                name: category?.name || "",
                categorySlug: category?.id || toSlug(category?.name)
              },
              { name }
            )
          )
          .filter(Boolean)
      : []
  }));
}

export function normalizeServiceCatalog(data) {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const normalized = categories
    .map((category) => {
      const categoryName = String(category?.name || "").trim();
      const categoryId = String(category?.id || categoryName || "").trim();
      if (!categoryName || !categoryId) {
        return null;
      }

      return {
        id: categoryId,
        name: categoryName,
        categorySlug: String(category?.categorySlug || categoryId || toSlug(categoryName)).trim() || toSlug(categoryName),
        subcategories: (Array.isArray(category?.subcategories) ? category.subcategories : [])
          .map((subcategory) =>
            normalizeSubcategory(
              {
                id: categoryId,
                name: categoryName,
                categorySlug: category?.categorySlug || categoryId || toSlug(categoryName)
              },
              subcategory
            )
          )
          .filter(Boolean)
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : buildFallbackServiceCatalog();
}

export function flattenServiceCatalog(categories) {
  return (Array.isArray(categories) ? categories : []).flatMap((category) =>
    (Array.isArray(category?.subcategories) ? category.subcategories : []).map((subcategory) => ({
      categoryId: category.id || subcategory.categoryId || "",
      categoryName: category.name || subcategory.categoryName || "",
      categorySlug: category.categorySlug || subcategory.categorySlug || toSlug(category.name || subcategory.categoryName || ""),
      subcategoryId: subcategory.id || "",
      serviceSlug: subcategory.serviceSlug || toSlug(subcategory.name || ""),
      subCategoryName: subcategory.name || "",
      description: subcategory.description || "",
      pricingModel: subcategory.pricingModel,
      pricingConfig: subcategory.pricingConfig,
      startingPrice: subcategory.startingPrice,
      paymentFlow: subcategory.paymentFlow || paymentFlowForModel(subcategory.pricingModel),
      startingPriceLabel:
        subcategory.startingPriceLabel || buildStartingPriceLabel(subcategory.pricingModel, subcategory.pricingConfig),
      createdAt: subcategory.createdAt || "",
      updatedAt: subcategory.updatedAt || ""
    }))
  );
}
