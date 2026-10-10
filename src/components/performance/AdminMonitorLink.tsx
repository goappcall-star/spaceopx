import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { isPerformanceAdmin } from "@/services/performance/access";
export function AdminMonitorLink() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["performance-admin", user?.id],
    queryFn: isPerformanceAdmin,
    enabled: !!user,
    staleTime: 60000,
    retry: false,
  });
  return data === true ? (
    <Link to="/performance-monitor" className="inline-block text-sm text-primary underline">
      Abrir Performance Monitor
    </Link>
  ) : null;
}
