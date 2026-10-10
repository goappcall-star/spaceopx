import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isPerformanceAdmin } from "@/services/performance/access";
import { setMonitorEnabled, clearMetrics } from "@/services/performance/monitor";
import { PerformanceMonitorPanel } from "@/components/performance/PerformanceMonitorPanel";

export const Route = createFileRoute("/_authenticated/performance-monitor")({
  beforeLoad: async () => {
    if (!(await isPerformanceAdmin())) throw redirect({ to: "/app" });
  },
  component: MonitorPage,
});
function MonitorPage() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(true);
  useEffect(() => {
    let disposed = false,
      busy = false;
    const timer = setInterval(async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const allowed = await isPerformanceAdmin();
        if (!disposed && !allowed) {
          setAuthorized(false);
          setMonitorEnabled(false);
          clearMetrics();
        }
      } finally {
        busy = false;
      }
    }, 60000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);
  return authorized ? (
    <PerformanceMonitorPanel
      onBack={() => {
        void navigate({ to: "/app" });
      }}
    />
  ) : (
    <p className="p-8">
      Acesso administrativo indisponível ou revogado. <a href="/app">Voltar</a>
    </p>
  );
}
