import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCommunityEventInbox } from "./use-community-events";
import { useGlobalPresence } from "./use-global-presence";
import { canNotifyMention } from "@/lib/chat-mentions";
export function useCommunityEventNotifications(userId: string | undefined) {
  const query = useCommunityEventInbox(userId),
    navigate = useNavigate(),
    { myStatus } = useGlobalPresence();
  const seen = useRef({ userId, ids: new Set<string>() });
  useEffect(() => {
    if (seen.current.userId !== userId) seen.current = { userId, ids: new Set() };
    if (!userId || query.isError || !canNotifyMention(myStatus)) return;
    let shown = 0;
    for (const item of query.data ?? []) {
      if (seen.current.ids.has(item.id)) continue;
      seen.current.ids.add(item.id);
      if (seen.current.ids.size > 200)
        seen.current.ids.delete(seen.current.ids.values().next().value!);
      if (shown++ >= 3) continue;
      const title =
        item.kind === "reminder"
          ? "Seu evento começa em breve"
          : item.kind === "cancelled"
            ? "Um evento foi cancelado"
            : "Um evento foi atualizado";
      const open = () => {
        void navigate({ to: "/app", search: { server: item.server_id } });
      };
      toast.info(title, {
        description: item.title,
        action: { label: "Abrir comunidade", onClick: open },
      });
      if (
        document.hidden &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(title, { body: item.title, tag: item.id });
          n.onclick = () => {
            window.focus();
            open();
            n.close();
          };
        } catch {
          /* In-app inbox remains available. */
        }
      }
    }
  }, [query.data, query.isError, userId, myStatus, navigate]);
}
