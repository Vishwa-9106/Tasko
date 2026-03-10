import { formatRupee } from "../../utils/pricingModels";

export default function AddonCheckboxList({ addons, selectedAddonIds, onToggle }) {
  if (!addons?.length) {
    return null;
  }

  return (
    <section className="tasko-pricing-block">
      <div className="tasko-section-head">
        <p>Add-ons</p>
        <h2>Optional extras</h2>
      </div>
      <div className="tasko-addon-list">
        {addons.map((addon) => {
          const checked = selectedAddonIds.includes(addon.id);
          return (
            <label key={addon.id} className={`tasko-addon-item ${checked ? "is-selected" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle?.(addon.id)}
              />
              <div>
                <strong>{addon.name}</strong>
                <p>+{formatRupee(addon.price)}</p>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
