import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { CommunityEventList } from "./CommunityEventList";
import { CommunityReportButton } from "./CommunityReportButton";
import { CommunityEventEditor } from "./CommunityEventEditor";
import { useCommunityEvents, useCommunityEventInbox } from "@/hooks/use-community-events";
import { communityEventsService } from "@/services/community-events";
import { eventCoverImagesService } from "@/services/event-cover-images";
import { communityEventError } from "@/lib/community-events";
import type { CommunityEvent, EventMode } from "@/types/community-events";
import type { Channel } from "@/types";
export function CommunityEvents({
  serverId,
  userId,
  channels,
  onChannel,
}: {
  serverId: string;
  userId: string;
  channels: Channel[];
  onChannel: (id: string) => void;
}) {
  const [mode, setMode] = useState<EventMode>("upcoming"),
    [cursors, setCursors] = useState<{ starts_at: string; id: string }[]>([]),
    [editing, setEditing] = useState<{ event: CommunityEvent | null } | null>(null),
    [cancelling, setCancelling] = useState<CommunityEvent | null>(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState<string | null>(null);
  const query = useCommunityEvents(serverId, userId, mode, cursors.at(-1)),
    inbox = useCommunityEventInbox(userId),
    client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["community-events", userId, serverId] });
    void client.invalidateQueries({ queryKey: ["community-event-inbox", userId] });
  };
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      refresh();
    } catch (e) {
      const message = communityEventError(e);
      setActionError(message);
      void query.refetch();
      throw Error(message);
    } finally {
      setBusy(false);
    }
  }
  const changed =
    !!editing?.event &&
    query.data?.items.find((e) => e.id === editing.event?.id)?.revision !== editing.event.revision;
  const notifications = (inbox.data ?? []).filter((n) => n.server_id === serverId);
  return (
    <>
      <CommunityEventList
        reportEvent={(id) => (
          <CommunityReportButton serverId={serverId} kind="event" targetId={id} />
        )}
        page={query.data}
        mode={mode}
        busy={busy}
        loading={query.isFetching}
        error={query.isError ? communityEventError(query.error) : actionError}
        hasPrevious={!!cursors.length}
        channels={channels}
        onMode={(m) => {
          setMode(m);
          setCursors([]);
          setActionError(null);
        }}
        onNext={() => {
          const last = query.data?.items.at(-1);
          if (last) setCursors((v) => [...v, { id: last.id, starts_at: last.starts_at }]);
        }}
        onBack={() => setCursors((v) => v.slice(0, -1))}
        onRefresh={() => {
          setActionError(null);
          void query.refetch();
        }}
        onNew={() => setEditing({ event: null })}
        onEdit={(event) => setEditing({ event })}
        onCancel={setCancelling}
        onRespond={(event, response, notify) =>
          void run(() => communityEventsService.respond(event, response, notify)).catch(() => {})
        }
        onChannel={onChannel}
      />
      {notifications.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <h4 className="text-xs font-semibold">Seus avisos de eventos</h4>
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-primary/5 p-2 text-xs"
            >
              <span className="min-w-0 break-words">
                {n.kind === "reminder"
                  ? "Em breve"
                  : n.kind === "cancelled"
                    ? "Cancelado"
                    : "Atualizado"}
                : {n.title}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void communityEventsService
                    .read([n.id])
                    .then(() => void inbox.refetch())
                    .catch((e) => toast.error(communityEventError(e)))
                }
              >
                Marcar lido
              </Button>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <CommunityEventEditor
          initial={editing.event}
          channels={channels}
          conflict={changed || query.isError || query.isPaused || !query.data?.can_manage}
          onClose={() => setEditing(null)}
          onUpload={(file) => eventCoverImagesService.upload(userId, file)}
          onSave={async (id, payload, revision) => {
            await run(() => communityEventsService.save(serverId, id, payload, revision));
            toast.success("Evento salvo.");
          }}
        />
      )}
      <AlertDialog
        open={!!cancelling}
        onOpenChange={(open) => {
          if (!open && !busy) setCancelling(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Cancelar este evento?</AlertDialogTitle>
          <AlertDialogDescription>
            O histórico e as confirmações serão preservados. Participantes que ativaram avisos
            poderão receber o cancelamento pelo servidor.
          </AlertDialogDescription>
          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy || query.isError || !query.data?.can_manage}
              onClick={() => {
                if (cancelling)
                  void run(() => communityEventsService.cancel(cancelling))
                    .then(() => {
                      setCancelling(null);
                      toast.success("Evento cancelado.");
                    })
                    .catch(() => {});
              }}
            >
              Confirmar cancelamento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
