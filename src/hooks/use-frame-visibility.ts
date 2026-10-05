import { useEffect, useRef, useState } from "react";

// One observer for every full-size frame. No animation timers or per-frame RAF loops.
let observer: IntersectionObserver | undefined;
const listeners = new Map<Element, (visible: boolean) => void>();
export function useFrameVisibility(enabled: boolean) {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
    });
    listeners.set(node, setVisible);
    observer.observe(node);
    return () => {
      observer?.unobserve(node);
      listeners.delete(node);
      if (!listeners.size) {
        observer?.disconnect();
        observer = undefined;
      }
    };
  }, [enabled]);
  return { ref, visible };
}
