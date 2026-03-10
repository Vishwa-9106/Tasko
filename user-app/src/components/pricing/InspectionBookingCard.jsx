import { formatRupee } from "../../utils/pricingModels";

export default function InspectionBookingCard({ visitCharge, requiresApproval }) {
  return (
    <section className="tasko-pricing-block tasko-inspection-card">
      <div className="tasko-section-head">
        <p>Inspection Booking</p>
        <h2>Visit charge and approval workflow</h2>
      </div>
      <p className="tasko-inspection-amount">{formatRupee(visitCharge || 0)}</p>
      <p>
        Worker visits first, inspects the issue, and submits a repair estimate in the app.
        {requiresApproval ? " Work starts only after your approval." : ""}
      </p>
    </section>
  );
}
