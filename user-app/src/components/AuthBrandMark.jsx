import { useState } from "react";
import taskoLogo from "../pages/tasko-logo.png";

function TaskoMark({ className = "" }) {
  return <img className={className} src={taskoLogo} alt="Tasko logo" />;
}

export default function AuthBrandMark({ className = "" }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const sources = [taskoLogo, "/tasko-logo-mark.png", "/tasko-logo.png"];

  if (useFallback) {
    return <TaskoMark className={className} />;
  }

  return (
    <img
      className={`${className} auth-brand-mark-image`}
      src={sources[sourceIndex]}
      alt="Tasko logo"
      onError={() => {
        if (sourceIndex < sources.length - 1) {
          setSourceIndex(sourceIndex + 1);
          return;
        }
        setUseFallback(true);
      }}
    />
  );
}
