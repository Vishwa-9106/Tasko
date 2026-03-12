import { describe, expect, it } from "vitest";
import {
  buildFallbackServiceCatalog,
  buildServicePath,
  flattenServiceCatalog,
  guessServiceCategoryIcon,
  normalizeServiceCatalog
} from "./serviceCatalog";

describe("service catalog utilities", () => {
  it("builds fallback catalog data when categories are missing", () => {
    const fallbackCatalog = buildFallbackServiceCatalog();

    expect(fallbackCatalog.length).toBeGreaterThan(0);
    expect(fallbackCatalog[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        subcategories: expect.any(Array)
      })
    );
  });

  it("normalizes incoming categories and flattens subcategories", () => {
    const normalized = normalizeServiceCatalog({
      categories: [
        {
          id: "cleaning",
          name: "Cleaning",
          subcategories: [{ id: "deep-clean", name: "Deep Cleaning" }]
        }
      ]
    });
    const flattened = flattenServiceCatalog(normalized);

    expect(flattened).toEqual([
      expect.objectContaining({
        categoryId: "cleaning",
        subcategoryId: "deep-clean",
        subCategoryName: "Deep Cleaning"
      })
    ]);
  });

  it("guesses icons and builds encoded service paths", () => {
    expect(guessServiceCategoryIcon("Pipe leakage fix")).toBe("plumbing");
    expect(
      buildServicePath({
        categorySlug: "technical & installation",
        serviceSlug: "AC Repair"
      })
    ).toBe("/services/technical%20%26%20installation/AC%20Repair");
  });
});
