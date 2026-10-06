import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalPresence } from "./use-global-presence";
import { canNotifyMention } from "@/lib/chat-mentions";
export function useMentionNotifications(userId: string | undefined) {
  const { myStatus } = useGlobalPresence();
  const status = useRef(myStatus);
  status.current = myStatus;
  const navigate = useNavigate();
  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    const seen = new Set<string>();
    const channel = supabase
      .channel(`mentions:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "server_mention_notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        ({ new: row }) => {
          if (disposed || seen.has(row["id"]) || !canNotifyMention(status.current)) return;
          seen.add(row["id"]);
          if (seen.size > 200) seen.delete(seen.values().next().value!);
          const title = `${row["author_name"]} mencionou você em #${row["channel_name"]}`;
          const open = () => {
            void navigate({
              to: "/app",
              search: { server: row["server_id"], channel: row["channel_id"] },
            });
          };
          toast.info(title, {
            description: row["content"],
            action: { label: "Abrir", onClick: open },
          });
          // Never request OS permissions automatically. In-app delivery always works.
          if (
            document.hidden &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            try {
              const notification = new Notification(title, {
                body: row["content"],
                tag: row["id"],
              });
              notification.onclick = () => {
                window.focus();
                open();
                notification.close();
              };
            } catch {
              /* toast remains available */
            }
          }
        },
      )
      .subscribe();
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, navigate]);
}
