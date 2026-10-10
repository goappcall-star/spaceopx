import { useEffect, useRef, type RefObject } from "react";
export function useReadVisible(
  container: RefObject<HTMLDivElement | null>,
  scope: string,
  lastId: string | undefined,
  loading: boolean,
  read: (messageId: string) => Promise<void>,
) {
  const latest = useRef(read);
  latest.current = read;
  useEffect(() => {
    if (loading || !lastId) return;
    const element = container.current;
    if (!element) return;
    let completed = false,
      disposed = false,
      pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (
        completed ||
        disposed ||
        pending ||
        document.hidden ||
        !document.hasFocus() ||
        element.scrollHeight - element.scrollTop - element.clientHeight > 4
      )
        return;
      pending = true;
      void latest
        .current(lastId)
        .then(() => {
          completed = true;
        })
        .catch(() => {})
        .finally(() => {
          pending = false;
        });
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(check, 150);
    };
    element.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("focus", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      disposed = true;
      clearTimeout(timer);
      element.removeEventListener("scroll", schedule);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [scope, lastId, loading, container]);
}
