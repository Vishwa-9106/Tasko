import { describe, expect, it } from "vitest";
import {
  calculateBookingSelection,
  calculateStartingPrice,
  getSuggestedPricingDefinition,
  validatePricingModelPayload
} from "./pricingModels";

describe("backend pricing models", () => {
  it("builds suggested package pricing for cleaning categories", () => {
    const suggestion = getSuggestedPricingDefinition("Cleaning", "Deep Cleaning");

    expect(suggestion.pricingModel).toBe("package");
    expect(suggestion.pricingConfig.packages).toHaveLength(3);
    expect(suggestion.pricingConfig.packages[1]?.recommended).toBe(true);
  });

  it("rejects incomplete per-unit payloads when no suggested per-unit defaults apply", () => {
    const result = validatePricingModelPayload(
      {
        pricingModel: "per_unit",
        pricingConfig: {
          unitPrice: 120
        }
      },
      "Cleaning",
      "Curtain Washing"
    );

    expect(result.error).toContain("unitPrice, unitLabel and minUnits are required");
    expect(result.pricingConfig).toBeNull();
  });

  it("calculates package selections with recommended defaults and addons", () => {
    const suggestion = getSuggestedPricingDefinition("Cleaning", "House Cleaning");
    const calculation = calculateBookingSelection(suggestion.pricingModel, suggestion.pricingConfig, {
      selectedAddons: ["sofa-cleaning"]
    });

    expect(calculation.selectedPackage?.id).toBe("plus");
    expect(calculation.selectedAddons.map((entry) => entry.id)).toEqual(["sofa-cleaning"]);
    expect(calculation.finalPrice).toBe(
      (calculation.selectedPackage?.price || 0) + 199
    );
  });

  it("uses the smallest available time-based shift as the starting price", () => {
    const suggestion = getSuggestedPricingDefinition("Caring", "Patient Care");
    const startingPrice = calculateStartingPrice(suggestion.pricingModel, suggestion.pricingConfig);

    expect(startingPrice).toBe(498);
  });
});
