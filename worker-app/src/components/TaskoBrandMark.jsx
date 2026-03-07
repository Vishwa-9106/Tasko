import taskoLogo from "./landing/tasko-logo.png";

export default function TaskoBrandMark({ className = "" }) {
  return <img className={className} src={taskoLogo} alt="Tasko logo" />;
}
