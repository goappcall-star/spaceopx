import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { categoriesService } from "@/services/categories";
export function useServerCategories(serverId: string) {
  const client = useQueryClient();
  const result = useQuery({
    queryKey: ["categories", serverId],
    queryFn: () => categoriesService.list(serverId),
  });
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ["categories", serverId] });
      void client.invalidateQueries({ queryKey: ["channels", serverId] });
    };
    const channel = supabase
      .channel(`channel-structure:${serverId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "server_categories",
          filter: `server_id=eq.${serverId}`,
        },
        refresh,
      )
      // DELETE payloads only contain primary keys and cannot be server-filtered.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "server_categories" },
        refresh,
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "channels" }, refresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channels", filter: `server_id=eq.${serverId}` },
        refresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [serverId, client]);
  return result;
}
