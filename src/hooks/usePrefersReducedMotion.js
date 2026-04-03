import { useState, useEffect } from "react";

const getInitialValue = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  return mql ? mql.matches : false;
};

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialValue);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const handler = (e) => setPrefersReducedMotion(e.matches);
    
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      // Fallback for older browsers/environments
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, []);

  return prefersReducedMotion;
}
