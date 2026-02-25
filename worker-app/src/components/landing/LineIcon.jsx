export default function LineIcon({ name, className = "", strokeWidth = 1.75 }) {
  const shared = {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true",
    className,
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  switch (name) {
    case "rupee":
      return (
        <svg {...shared}>
          <path d="M7 5h10M7 9h10M9 5c2.7 0 4.5 1.6 4.5 4S11.7 13 9 13h-.5L15 19" />
        </svg>
      );
    case "users":
      return (
        <svg {...shared}>
          <path d="M7 17c0-2.1 1.9-3.8 4.2-3.8s4.2 1.7 4.2 3.8" />
          <circle cx="11.2" cy="8.2" r="2.7" />
          <path d="M16.5 13.5c1.9.2 3.5 1.6 3.5 3.5M15.4 6.6a2.5 2.5 0 1 1 0 5" />
        </svg>
      );
    case "clock":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8.2V12l2.6 1.7" />
        </svg>
      );
    case "user-plus":
      return (
        <svg {...shared}>
          <circle cx="10" cy="8" r="3" />
          <path d="M4.8 18c0-2.5 2.2-4.5 5.2-4.5 1.3 0 2.5.4 3.4 1.1M17.5 6v5M15 8.5h5" />
        </svg>
      );
    case "checklist":
      return (
        <svg {...shared}>
          <path d="M8 7h9M8 12h9M8 17h9M4 7.2l1.4 1.4L7.4 6.6M4 12.2l1.4 1.4 2-2M4 17.2l1.4 1.4 2-2" />
        </svg>
      );
    case "clipboard-check":
      return (
        <svg {...shared}>
          <rect x="6" y="5" width="12" height="15" rx="2" />
          <path d="M9 5.5A2.2 2.2 0 0 1 11 4h2a2.2 2.2 0 0 1 2 1.5M9.2 13.2l1.8 1.8 3.6-3.6" />
        </svg>
      );
    case "badge-check":
      return (
        <svg {...shared}>
          <path d="M12 3.8 14 5l2.3.2 1.2 2 2 .8v2.3l1.1 1.9-1.1 1.9v2.3l-2 .8-1.2 2L14 19 12 20.2 10 19l-2.3-.2-1.2-2-2-.8V13.7L3.4 12l1.1-1.9V7.8l2-.8 1.2-2L10 5Z" />
          <path d="m9.2 12.2 1.8 1.8 3.8-3.8" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...shared}>
          <path d="M12 3.5v3.2M12 17.3v3.2M4.5 12h3.2M16.3 12h3.2M7.1 7.1l2.3 2.3M14.6 14.6l2.3 2.3M7.1 16.9l2.3-2.3M14.6 9.4l2.3-2.3" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...shared}>
          <path d="M14.8 4.5a4.5 4.5 0 0 0 4.7 4.7l-8.6 8.6a2.2 2.2 0 0 1-3.1-3.1l8.6-8.6a4.5 4.5 0 0 0-1.6-1.6Z" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...shared}>
          <path d="m13.2 3.2-8 9.6h5.6L9.7 20.8l9-11h-5.6l.1-6.6Z" />
        </svg>
      );
    case "wind":
      return (
        <svg {...shared}>
          <path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M2 12h14a2.5 2.5 0 1 1-2.5 2.5M6 16h8" />
        </svg>
      );
    case "chef":
      return (
        <svg {...shared}>
          <path d="M7 11c-1.5-.3-2.5-1.4-2.5-2.9A3 3 0 0 1 7.7 5a3.1 3.1 0 0 1 5.8 0A3 3 0 0 1 16.8 8c0 1.5-1 2.6-2.4 2.9" />
          <path d="M8 11v7h8v-7M8 18h8" />
        </svg>
      );
    case "baby":
      return (
        <svg {...shared}>
          <circle cx="12" cy="9" r="3.2" />
          <path d="M8 18a4 4 0 0 1 8 0M10.2 6.6c0-1 .8-1.8 1.8-1.8h1.2" />
        </svg>
      );
    case "elder":
      return (
        <svg {...shared}>
          <path d="M6 17.5c0-2.4 2.1-4.3 4.7-4.3S15.4 15 15.4 17.5" />
          <circle cx="10.7" cy="8.1" r="2.7" />
          <path d="M17.4 18.5V9.7a1.9 1.9 0 1 1 3.8 0v8.8M17.4 14h3.8" />
        </svg>
      );
    case "paint":
      return (
        <svg {...shared}>
          <path d="M14 5.2 8.2 11a2.3 2.3 0 0 0 0 3.3l1.5 1.5a2.3 2.3 0 0 0 3.3 0l5.8-5.8a2.3 2.3 0 0 0 0-3.3l-1.5-1.5a2.3 2.3 0 0 0-3.3 0ZM6 18h6" />
        </svg>
      );
    case "car":
      return (
        <svg {...shared}>
          <path d="M4 14h16l-1.5-5h-13L4 14ZM6.6 17.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM17.4 17.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM3 14v4M21 14v4" />
        </svg>
      );
    case "truck":
      return (
        <svg {...shared}>
          <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7zM7 19.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM18 19.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
        </svg>
      );
    case "calendar-clock":
      return (
        <svg {...shared}>
          <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
          <path d="M8 3.8v3.4M16 3.8v3.4M4.5 9.5h15M12 12.4v2.3l1.8 1.2" />
        </svg>
      );
    case "pin":
      return (
        <svg {...shared}>
          <path d="M12 20s-5.8-4.8-5.8-9A5.8 5.8 0 1 1 17.8 11c0 4.2-5.8 9-5.8 9Z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...shared}>
          <path d="M4.5 8.5h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
          <path d="M4.5 8.5V7A2 2 0 0 1 6.5 5h10M15.5 13h4" />
        </svg>
      );
    case "gift":
      return (
        <svg {...shared}>
          <rect x="4.5" y="9" width="15" height="10.5" rx="1.8" />
          <path d="M12 9v10.5M4.5 12.8h15M9.5 9c-1.3 0-2.2-.8-2.2-1.9S8 5.2 9.2 5.2c1.4 0 2.8 1.2 2.8 3.8M14.5 9c1.3 0 2.2-.8 2.2-1.9s-.7-1.9-1.9-1.9c-1.4 0-2.8 1.2-2.8 3.8" />
        </svg>
      );
    case "growth":
      return (
        <svg {...shared}>
          <path d="M4.5 17.5h15M6 15l4.2-4.2 3.2 3.2 4.5-4.5M16 9.5h1.9v1.9" />
        </svg>
      );
    case "shield-check":
      return (
        <svg {...shared}>
          <path d="M12 4.2 18 6v5.7c0 4-2.4 6.8-6 8.1-3.6-1.3-6-4.1-6-8.1V6l6-1.8Z" />
          <path d="m9.2 11.8 1.9 1.9 3.7-3.7" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...shared}>
          <rect x="6" y="5" width="12" height="15" rx="2" />
          <path d="M9 5.5A2.2 2.2 0 0 1 11 4h2a2.2 2.2 0 0 1 2 1.5M9 10h6M9 14h6" />
        </svg>
      );
    case "user-shield":
      return (
        <svg {...shared}>
          <circle cx="9.2" cy="8.3" r="2.8" />
          <path d="M4.8 18.2c0-2.5 2-4.4 4.4-4.4.8 0 1.5.2 2.1.5M16.8 12.5l2.6.8v2.5c0 1.7-1 2.9-2.6 3.5-1.6-.6-2.6-1.8-2.6-3.5v-2.5l2.6-.8Z" />
        </svg>
      );
    case "check-circle":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.8 12.2 2.2 2.2 4.3-4.3" />
        </svg>
      );
    case "medal":
      return (
        <svg {...shared}>
          <circle cx="12" cy="9.7" r="3.6" />
          <path d="m9.9 13.1-1.4 6 3.5-2 3.5 2-1.4-6" />
        </svg>
      );
    default:
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
