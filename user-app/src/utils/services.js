import { formatRupee, normalizeText } from "./serviceCatalog";
import { API_BASE_URL } from "../config";

export function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStringArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
}

function resolveImageUrl(value) {
  const image = String(value || "").trim();
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) {
    return image;
  }
  if (image.startsWith("/")) {
    return `${API_BASE_URL}${image}`;
  }
  return image;
}

export function buildServicePath(service) {
  return `/services/${encodeURIComponent(service.categorySlug || toSlug(service.category))}/${encodeURIComponent(service.slug || toSlug(service.name))}`;
}

export function normalizeServicesResponse(payload) {
  const services = Array.isArray(payload?.services) ? payload.services : [];
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];

  return {
    categories: categories.map((entry) => String(entry || "").trim()).filter(Boolean),
    services: services
      .map((service) => {
        const name = String(service?.name || "").trim();
        const category = String(service?.category || "").trim();
        const slug = String(service?.slug || "").trim() || toSlug(name);
        const categorySlug = String(service?.categorySlug || "").trim() || toSlug(category);

        if (!name || !category) {
          return null;
        }

        return {
          id: String(service?.id || "").trim(),
          name,
          category,
          slug,
          categorySlug,
          description: String(service?.description || "").trim(),
          duration: String(service?.duration || "").trim(),
          image: resolveImageUrl(service?.image),
          pricingType: String(service?.pricingType || "tiered").trim() || "tiered",
          startingPrice: readNumber(service?.startingPrice, readNumber(service?.basePrice, 0)),
          basePrice: readNumber(service?.basePrice, 0),
          rating: readNumber(service?.rating, 4.5),
          reviewCount: Math.max(0, Math.trunc(readNumber(service?.reviewCount, 0))),
          status: String(service?.status || "active").trim() || "active"
        };
      })
      .filter(Boolean)
  };
}

export function normalizeServiceDetail(payload) {
  const service = payload?.service || {};
  const pricingOptions = Array.isArray(payload?.pricingOptions) ? payload.pricingOptions : [];
  const addons = Array.isArray(payload?.addons) ? payload.addons : [];
  const name = String(service?.name || "").trim();
  const category = String(service?.category || "").trim();

  if (!name || !category) {
    return null;
  }

  return {
    id: String(service?.id || "").trim(),
    name,
    category,
    slug: String(service?.slug || "").trim() || toSlug(name),
    categorySlug: String(service?.categorySlug || "").trim() || toSlug(category),
    description: String(service?.description || "").trim(),
    basePrice: readNumber(service?.basePrice, 0),
    pricingType: String(service?.pricingType || "tiered").trim() || "tiered",
    duration: String(service?.duration || "").trim(),
    image: resolveImageUrl(service?.image),
    includedServices: readStringArray(service?.includedServices),
    notIncludedServices: readStringArray(service?.notIncludedServices),
    rating: readNumber(service?.rating, 4.5),
    reviewCount: Math.max(0, Math.trunc(readNumber(service?.reviewCount, 0))),
    status: String(service?.status || "active").trim() || "active",
    pricingOptions: pricingOptions
      .map((option) => ({
        id: String(option?.id || "").trim(),
        serviceId: String(option?.serviceId || "").trim(),
        title: String(option?.title || "").trim(),
        description: String(option?.description || "").trim(),
        price: readNumber(option?.price, 0),
        order: Math.max(1, Math.trunc(readNumber(option?.order, 1)))
      }))
      .filter((option) => option.id && option.title)
      .sort((left, right) => left.order - right.order),
    addons: addons
      .map((addon) => ({
        id: String(addon?.id || "").trim(),
        serviceId: String(addon?.serviceId || "").trim(),
        title: String(addon?.title || "").trim(),
        description: String(addon?.description || "").trim(),
        price: readNumber(addon?.price, 0)
      }))
      .filter((addon) => addon.id && addon.title)
  };
}

export function calculateServiceTotal(pricingOption, addons = []) {
  const basePrice = readNumber(pricingOption?.price, 0);
  const addonsPrice = addons.reduce((sum, addon) => sum + readNumber(addon?.price, 0), 0);

  return {
    basePrice,
    addonsPrice,
    totalPrice: basePrice + addonsPrice
  };
}

export function matchesServiceFilter(service, category, search) {
  const selectedCategory = normalizeText(category);
  const selectedSearch = normalizeText(search);

  if (selectedCategory && normalizeText(service.category) !== selectedCategory) {
    return false;
  }

  if (!selectedSearch) {
    return true;
  }

  return normalizeText(`${service.name} ${service.category} ${service.description}`).includes(selectedSearch);
}

export function formatServicePrice(value) {
  return formatRupee(readNumber(value, 0));
}
