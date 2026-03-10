import AddonCheckboxList from "./AddonCheckboxList";
import InspectionBookingCard from "./InspectionBookingCard";
import MealSelector from "./MealSelector";
import PackageCard from "./PackageCard";
import QuantityStepper from "./QuantityStepper";
import TimeSelector from "./TimeSelector";
import { formatRupee } from "../../utils/pricingModels";

export default function PricingConfigurator({
  pricingModel,
  pricingConfig,
  selection,
  onSelectionChange
}) {
  if (!pricingModel || !pricingConfig) {
    return null;
  }

  if (pricingModel === "package") {
    return (
      <>
        <section className="tasko-pricing-block">
          <div className="tasko-section-head">
            <p>Packages</p>
            <h2>Choose a package</h2>
          </div>
          <div className="tasko-package-grid">
            {pricingConfig.packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                selected={selection.selectedPackage === pkg.id}
                onSelect={(value) => onSelectionChange?.({ selectedPackage: value })}
              />
            ))}
          </div>
        </section>
        <AddonCheckboxList
          addons={pricingConfig.addons}
          selectedAddonIds={selection.selectedAddons}
          onToggle={(addonId) =>
            onSelectionChange?.({
              selectedAddons: selection.selectedAddons.includes(addonId)
                ? selection.selectedAddons.filter((currentId) => currentId !== addonId)
                : [...selection.selectedAddons, addonId]
            })
          }
        />
      </>
    );
  }

  if (pricingModel === "per_unit") {
    return (
      <QuantityStepper
        label={pricingConfig.unitLabel || "unit"}
        helper={`${formatRupee(pricingConfig.unitPrice || 0)} per ${pricingConfig.unitLabel || "unit"}`}
        unitPrice={pricingConfig.unitPrice || 0}
        min={pricingConfig.minUnits || 1}
        value={selection.selectedUnits}
        onChange={(value) => onSelectionChange?.({ selectedUnits: value })}
      />
    );
  }

  if (pricingModel === "fixed") {
    return (
      <section className="tasko-pricing-block">
        <div className="tasko-section-head">
          <p>Flat Price</p>
          <h2>{formatRupee(pricingConfig.fixedPrice || 0)}</h2>
        </div>
        <p className="tasko-pricing-copy">
          {pricingConfig.serviceDescription || "Fixed-price service with clear scope."}
        </p>
      </section>
    );
  }

  if (pricingModel === "time_based") {
    return (
      <TimeSelector
        shifts={pricingConfig.availableShifts}
        selectedShiftId={selection.selectedShift}
        selectedHours={selection.selectedHours}
        hourlyRate={pricingConfig.hourlyRate}
        dayRate={pricingConfig.dayRate}
        onShiftChange={(value) => onSelectionChange?.({ selectedShift: value })}
        onHoursChange={(value) => onSelectionChange?.({ selectedHours: value })}
      />
    );
  }

  if (pricingModel === "inspection") {
    return (
      <InspectionBookingCard
        visitCharge={pricingConfig.visitCharge}
        requiresApproval={pricingConfig.requiresApproval}
      />
    );
  }

  return (
    <MealSelector
      options={pricingConfig.mealOptions}
      selectedMealId={selection.selectedMeal}
      onSelect={(value) => onSelectionChange?.({ selectedMeal: value })}
    />
  );
}
