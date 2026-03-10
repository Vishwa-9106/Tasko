import { formatRupee } from "../../utils/pricingModels";

export default function TimeSelector({
  shifts,
  selectedShiftId,
  selectedHours,
  hourlyRate,
  dayRate,
  onShiftChange,
  onHoursChange
}) {
  return (
    <section className="tasko-pricing-block">
      <div className="tasko-section-head">
        <p>Time Selection</p>
        <h2>Choose a shift</h2>
      </div>
      <div className="tasko-shift-grid">
        {shifts.map((shift) => {
          const selected = shift.id === selectedShiftId;
          const shiftPrice = dayRate !== null && shift.hours >= 8 ? dayRate : (hourlyRate || 0) * shift.hours;
          return (
            <button
              key={shift.id}
              type="button"
              className={`tasko-shift-card ${selected ? "is-selected" : ""}`}
              onClick={() => {
                onShiftChange?.(shift.id);
                onHoursChange?.(shift.hours);
              }}
            >
              <div>
                <strong>{shift.name}</strong>
                <p>{shift.label}</p>
              </div>
              <span>{formatRupee(shiftPrice)}</span>
            </button>
          );
        })}
      </div>
      <label className="tasko-pricing-inline-field">
        <span>Or enter hours</span>
        <input
          type="number"
          min="1"
          value={selectedHours || ""}
          onChange={(event) => onHoursChange?.(Math.max(1, Number(event.target.value) || 1))}
        />
      </label>
    </section>
  );
}
