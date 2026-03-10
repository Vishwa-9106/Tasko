import {
  buildSelectionSummary,
  formatRupee
} from "../../utils/pricingModels";

export default function OrderSummaryPanel({
  serviceName,
  pricingModel,
  pricingConfig,
  calculation,
  actionLabel,
  onAction
}) {
  return (
    <aside className="tasko-order-summary">
      <div className="tasko-section-head">
        <p>Order Summary</p>
        <h2>{serviceName || "Selected service"}</h2>
      </div>
      <p className="tasko-order-summary-copy">
        {buildSelectionSummary(pricingModel, calculation, pricingConfig)}
      </p>
      <div className="tasko-order-summary-grid">
        <p>
          <span>Base</span>
          <strong>{formatRupee(calculation.basePrice || 0)}</strong>
        </p>
        {calculation.addonsPrice ? (
          <p>
            <span>Add-ons</span>
            <strong>{formatRupee(calculation.addonsPrice)}</strong>
          </p>
        ) : null}
        {calculation.visitCharge ? (
          <p>
            <span>Visit Charge</span>
            <strong>{formatRupee(calculation.visitCharge)}</strong>
          </p>
        ) : null}
        <p className="is-total">
          <span>Total Price</span>
          <strong>{formatRupee(calculation.finalPrice || 0)}</strong>
        </p>
      </div>
      {onAction ? (
        <button type="button" className="tasko-order-summary-button" onClick={onAction}>
          {actionLabel || "Continue"}
        </button>
      ) : null}
    </aside>
  );
}
