export default function BrandLogo({ compact = false }) {
  return (
    <div className={`tasko-brand ${compact ? "is-compact" : ""}`}>
      <span className="tasko-badge" aria-hidden="true">
        T
      </span>
      <span className="tasko-wordmark">Tasko</span>
    </div>
  );
}
