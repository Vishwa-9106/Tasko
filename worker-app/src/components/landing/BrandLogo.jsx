import taskoLogo from "./tasko-logo.png";

export default function BrandLogo({ compact = false }) {
  return (
    <div className={`tasko-brand ${compact ? "is-compact" : ""}`}>
      <img className="tasko-badge" src={taskoLogo} alt="Tasko logo" />
      <span className="tasko-wordmark">Tasko</span>
    </div>
  );
}
