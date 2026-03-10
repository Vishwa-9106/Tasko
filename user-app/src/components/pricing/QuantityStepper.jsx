import { formatRupee } from "../../utils/pricingModels";

export default function QuantityStepper({ label, helper, unitPrice, value, min = 1, onChange }) {
  const safeValue = Math.max(min, Number(value) || min);

  return (
    <section className="tasko-pricing-block">
      <div className="tasko-section-head">
        <p>Quantity</p>
        <h2>{label}</h2>
      </div>
      <p className="tasko-pricing-copy">
        {helper || `${formatRupee(unitPrice)} per ${label?.toLowerCase() || "unit"}`}
      </p>
      <div className="tasko-quantity-stepper">
        <button type="button" onClick={() => onChange?.(Math.max(min, safeValue - 1))}>
          -
        </button>
        <strong>{safeValue}</strong>
        <button type="button" onClick={() => onChange?.(safeValue + 1)}>
          +
        </button>
      </div>
    </section>
  );
}
