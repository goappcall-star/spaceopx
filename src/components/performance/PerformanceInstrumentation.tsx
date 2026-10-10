import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { isPerformanceAdmin } from "@/services/performance/access";
import {
  clearMetrics,
  measureOperation,
  metrics,
  setMonitorEnabled,
} from "@/services/performance/monitor";

export function PerformanceInstrumentation() {
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => {
    // No automatic collection across logins. Permission is rechecked while collecting.
    setMonitorEnabled(false);
    clearMetrics();
    let busy = false,
      disposed = false;
    const check = async () => {
      if (
        !metrics.enabled ||
        busy ||
        document.hidden ||
        router.state.location.pathname === "/performance-monitor"
      )
        return;
      busy = true;
      try {
        const authorized = await isPerformanceAdmin();
        if (!disposed && !authorized) {
          setMonitorEnabled(false);
          clearMetrics();
        }
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => {
      void check();
    }, 60000);
    return () => {
      disposed = true;
      clearInterval(timer);
      setMonitorEnabled(false);
      clearMetrics();
    };
  }, [user?.id, router]);
  useEffect(() => {
    let finish: ((failed?: boolean) => void) | undefined;
    const before = router.subscribe("onBeforeLoad", (event) => {
      // A superseded navigation is discarded; a quick second click is not an application failure.
      finish = undefined;
      const path = event.toLocation.pathname;
      const metric = path.startsWith("/settings") ? "ui.settings" : "ui.navigation";
      finish = measureOperation(metric);
    });
    const after = router.subscribe("onResolved", () => {
      finish?.();
      finish = undefined;
    });
    return () => {
      before();
      after();
    };
  }, [router]);
  return null;
}
