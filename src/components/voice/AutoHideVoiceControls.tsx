import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AutoHideVoiceControls({
  children,
  controls,
}: {
  children: ReactNode;
  controls: ReactNode;
}) {
  const [visible, setVisible] = useState(true);
  const footer = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(0);
  function reveal() {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (
        window.matchMedia("(hover: none), (pointer: coarse)").matches ||
        footer.current?.contains(document.activeElement) ||
        footer.current?.querySelector('[aria-expanded="true"]')
      )
        return;
      setVisible(false);
    }, 2500);
  }
  useEffect(() => {
    reveal();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return (
    <div
      tabIndex={0}
      aria-label="Área da chamada"
      onFocusCapture={reveal}
      className="bg-hero-glow relative flex flex-1 flex-col overflow-hidden"
      onPointerMove={() => {
        const now = performance.now();
        if (now - last.current > 200) {
          last.current = now;
          reveal();
        }
      }}
      onPointerDown={reveal}
      onKeyDownCapture={reveal}
    >
      {children}
      <div
        ref={footer}
        inert={!visible}
        onFocusCapture={reveal}
        onBlurCapture={reveal}
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 px-4 pb-4 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
          visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        )}
      >
        {controls}
      </div>
    </div>
  );
}
