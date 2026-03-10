import { formatRupee } from "../../utils/pricingModels";

export default function PackageCard({ pkg, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`tasko-package-card ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect?.(pkg.id)}
    >
      <div className="tasko-package-card-head">
        <div>
          <p>{pkg.recommended ? "Most Popular" : "Package"}</p>
          <h3>{pkg.name}</h3>
        </div>
        <strong>{formatRupee(pkg.price)}</strong>
      </div>
      <p>{pkg.description || "Standard service scope included."}</p>
      {pkg.features?.length ? (
        <ul className="tasko-package-features">
          {pkg.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}
      <span className="tasko-package-cta">{selected ? "Selected" : "Select Package"}</span>
    </button>
  );
}
