function iconProps(className = "") {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true"
  };
}

export function CategoryIcon({ name, className = "" }) {
  const props = iconProps(className);

  switch (name) {
    case "cleaning":
      return (
        <svg {...props}>
          <path d="M12 3v4M12 17v4M5 10h4M15 10h4M7.5 5.5l2.5 2.5M14 12l2.5 2.5M7.5 14.5l2.5-2.5M14 8l2.5-2.5" />
        </svg>
      );
    case "washing":
      return (
        <svg {...props}>
          <path d="M5 5h14v14H5zM8 9h8M8 13h8M8 17h5" />
        </svg>
      );
    case "maintenance":
      return (
        <svg {...props}>
          <path d="M13.5 4.5a4.5 4.5 0 0 0 5.6 5.6l-8.7 8.7a2 2 0 0 1-2.8-2.8l8.7-8.7a4.5 4.5 0 0 0-2.8-2.8Z" />
        </svg>
      );
    case "mechanic":
      return (
        <svg {...props}>
          <path d="M4 14h16l-1.5-5h-13L4 14ZM6.5 17a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM17.5 17a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM3 14v4M21 14v4" />
        </svg>
      );
    case "plumbing":
      return (
        <svg {...props}>
          <path d="M7 3v6a3 3 0 0 0 3 3h4m0 0V8m0 4a3 3 0 0 0 3-3V3m-5 9v9m-4 0h8" />
        </svg>
      );
    case "technical":
      return (
        <svg {...props}>
          <path d="m13 3-8 10h6l-1 8 9-11h-6l1-7Z" />
        </svg>
      );
    case "caring":
      return (
        <svg {...props}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.3A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
        </svg>
      );
    case "beauty":
      return (
        <svg {...props}>
          <path d="M5 6h14M7 6l1 14h8l1-14M10 10v6M14 10v6" />
        </svg>
      );
    case "cooking":
      return (
        <svg {...props}>
          <path d="M6 3v8M4 3v8M8 3v8M6 11v10M15 3v18M15 3c2 0 3 1.8 3 4s-1 4-3 4" />
        </svg>
      );
    case "vegetables":
      return (
        <svg {...props}>
          <path d="M7 13c0-4 2.8-7 7-7 0 4-2.8 7-7 7ZM7 13c-2 0-3 1.5-3 3.5V20h12v-3.5c0-2-1-3.5-3-3.5" />
        </svg>
      );
    case "fruits":
      return (
        <svg {...props}>
          <path d="M12 5c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7Zm0 0V3m0 0c1.2 0 2 .6 2.5 1.5" />
        </svg>
      );
    case "dairy":
      return (
        <svg {...props}>
          <path d="M10 3h4l2 4v11a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7l2-4Z" />
        </svg>
      );
    case "snacks":
      return (
        <svg {...props}>
          <path d="M7 3h10l-1 17H8L7 3Zm2 4h6" />
        </svg>
      );
    case "beverages":
      return (
        <svg {...props}>
          <path d="M8 4h8l-1 16H9L8 4Zm3 0V2m2 2V2" />
        </svg>
      );
    case "rice":
      return (
        <svg {...props}>
          <path d="M4 13h16c0 4-3.6 7-8 7s-8-3-8-7Zm2-3a6 6 0 0 1 12 0" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}

export function BellIcon({ className = "" }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M15 17H9a2 2 0 0 1-2-2v-4a5 5 0 0 1 10 0v4a2 2 0 0 1-2 2Zm-6 0h6m-4 3h2" />
    </svg>
  );
}

export function ProfileIcon({ className = "" }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function SearchIcon({ className = "" }) {
  return (
    <svg {...iconProps(className)}>
      <path d="m20 20-3.5-3.5M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
    </svg>
  );
}

