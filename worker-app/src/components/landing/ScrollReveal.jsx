import { useEffect, useRef, useState } from "react";

export default function ScrollReveal({
  as: Tag = "div",
  className = "",
  direction = "up",
  delay = 0,
  children,
  ...props
}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.22
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`scroll-reveal ${isVisible ? "is-visible" : ""} ${className}`.trim()}
      data-direction={direction}
      style={{ "--reveal-delay": `${delay}ms` }}
      {...props}
    >
      {children}
    </Tag>
  );
}
