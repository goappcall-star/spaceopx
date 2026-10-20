import { useEffect, useRef, useState } from "react";

/** Native window controls stay in Electron; only the title and drag area are HTML. */
export function DesktopTitleBar() {
  const [enabled, setEnabled] = useState(false);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!window.lobbyxDesktop?.titleBar) return;
    document.documentElement.dataset["desktopTitlebar"] = "true";
    setEnabled(true);
    return () => {
      delete document.documentElement.dataset["desktopTitlebar"];
      delete document.documentElement.dataset["desktopFullscreen"];
    };
  }, []);

  useEffect(() => {
    const api = window.lobbyxDesktop?.titleBar;
    if (!enabled || !api || !bar.current) return;
    const root = document.documentElement;
    let alive = true;
    let frame = 0;
    let previous = "";
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const hex = (css: string) => {
      if (!ctx) return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return (
        "#" +
        [...ctx.getImageData(0, 0, 1, 1).data]
          .slice(0, 3)
          .map((channel) => channel.toString(16).padStart(2, "0"))
          .join("")
      );
    };
    const sync = () => {
      if (!bar.current) return;
      const style = getComputedStyle(bar.current);
      const background = hex(style.backgroundColor);
      const foreground = hex(style.color);
      const key = background + ":" + foreground;
      if (background && foreground && key !== previous) {
        previous = key;
        void api.appearance({ background, foreground }).catch(() => {});
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    const fullscreen = (state: { fullscreen: boolean }) => {
      if (alive) root.dataset["desktopFullscreen"] = String(state.fullscreen);
    };
    const unsubscribe = api.subscribe(fullscreen);
    void api
      .state()
      .then(fullscreen)
      .catch(() => {});
    const observer = new MutationObserver(schedule);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
    schedule();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribe();
    };
  }, [enabled]);

  return enabled ? (
    <header ref={bar} className="desktop-titlebar">
      <img src="/lobbyx-logo.png" alt="" aria-hidden="true" draggable={false} />
      LobbyX
    </header>
  ) : null;
}
