export default function NavLink({ href, children, className = "", onClick }) {
  const handleClick = (event) => {
    if (!href?.startsWith("#")) {
      if (onClick) onClick();
      return;
    }

    event.preventDefault();
    const target = document.querySelector(href);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (onClick) onClick();
  };

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
