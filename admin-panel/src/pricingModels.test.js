import { describe, expect, it } from "vitest";
import {
  buildSubcategoryPricingSummary,
  createDefaultPricingConfig,
  normalizeSubcategoryDraft,
  validateSubcategoryDraft
} from "./pricingModels";

describe("admin pricing model helpers", () => {
  it("creates sensible defaults for package pricing", () => {
    const config = createDefaultPricingConfig("package");

    expect(config.packages).toHaveLength(1);
    expect(config.addons).toHaveLength(1);
    expect(config.packages[0]?.recommended).toBe(true);
  });

  it("normalizes draft values into editable string fields", () => {
    const draft = normalizeSubcategoryDraft({
      name: "Deep Cleaning",
      pricingModel: "fixed",
      pricingConfig: {
        fixedPrice: 499,
        serviceDescription: "Flat-rate service"
      }
    });

    expect(draft).toEqual(
      expect.objectContaining({
        name: "Deep Cleaning",
        pricingModel: "fixed",
        pricingConfig: expect.objectContaining({
          fixedPrice: "499",
          serviceDescription: "Flat-rate service"
        })
      })
    );
  });

  it("rejects invalid fixed-price drafts and summarizes valid ones", () => {
    const invalid = validateSubcategoryDraft({
      name: "TV Repair",
      pricingModel: "fixed",
      pricingConfig: {
        ...createDefaultPricingConfig("fixed"),
        fixedPrice: "not-a-number"
      }
    });
    const valid = validateSubcategoryDraft({
      name: "TV Repair",
      pricingModel: "fixed",
      pricingConfig: {
        ...createDefaultPricingConfig("fixed"),
        fixedPrice: "799",
        serviceDescription: "Television service visit"
      }
    });

    expect(invalid.error).toBe("Fixed pricing requires a fixed price.");
    expect(valid.error).toBe("");
    expect(
      buildSubcategoryPricingSummary({
        pricingModel: "fixed",
        pricingConfig: valid.payload.pricingConfig
      })
    ).toContain("Fixed");
  });
});
