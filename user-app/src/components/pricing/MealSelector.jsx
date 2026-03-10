import { formatRupee } from "../../utils/pricingModels";

export default function MealSelector({ options, selectedMealId, onSelect }) {
  return (
    <section className="tasko-pricing-block">
      <div className="tasko-section-head">
        <p>Meal Selection</p>
        <h2>Choose a meal or plan</h2>
      </div>
      <div className="tasko-meal-grid">
        {options.map((option) => {
          const selected = option.id === selectedMealId;
          return (
            <button
              key={option.id}
              type="button"
              className={`tasko-meal-card ${selected ? "is-selected" : ""}`}
              onClick={() => onSelect?.(option.id)}
            >
              <div>
                <strong>{option.name}</strong>
                <p>{option.description || "Prepared by Tasko professionals."}</p>
              </div>
              <span>{formatRupee(option.price)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
