import "./community-ui.css";
import { useState, type ReactNode } from "react";
import { CalendarDays, Clock, Users, Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEventTime } from "@/lib/community-events";
import type {
  CommunityEvent,
  CommunityEventPage,
  EventMode,
  EventResponse,
} from "@/types/community-events";
import type { Channel } from "@/types";
function EventCard({
  reportAction,
  event,
  channel,
  manage,
  busy,
  onRespond,
  onEdit,
  onCancel,
  onChannel,
}: {
  event: CommunityEvent;
  reportAction?: ReactNode;
  channel: Channel | undefined;
  manage: boolean;
  busy: boolean;
  onRespond: (event: CommunityEvent, response: EventResponse, notify: boolean) => void;
  onEdit: (event: CommunityEvent) => void;
  onCancel: (event: CommunityEvent) => void;
  onChannel: (id: string) => void;
}) {
  const [notify, setNotify] = useState(event.my_notify),
    [coverFailed, setCoverFailed] = useState(false);
  const closed =
    event.status === "cancelled" || Date.parse(event.ends_at ?? event.starts_at) <= Date.now();
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-background/60">
      {event.cover_url && !coverFailed && (
        <img
          src={event.cover_url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-28 w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      )}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="break-words font-semibold">{event.title}</h3>
          {reportAction}
          {event.status === "cancelled" && (
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
              Cancelado
            </span>
          )}
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {formatEventTime(event.starts_at, event.timezone)}
        </p>
        {event.ends_at && (
          <p className="text-xs text-muted-foreground">
            Até {formatEventTime(event.ends_at, event.timezone)}
          </p>
        )}
        {event.description && (
          <details className="text-sm">
            <summary className="cursor-pointer text-primary">Sobre o evento</summary>
            <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
              {event.description}
            </p>
          </details>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {event.interested_count} interessados · {event.going_count} confirmados
          </span>
          {channel ? (
            <button className="truncate text-primary" onClick={() => onChannel(channel.id)}>
              # {channel.name}
            </button>
          ) : (
            <span>Canal indisponível</span>
          )}
        </div>
        {!closed && (
          <>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={notify}
                disabled={busy}
                onChange={(e) => setNotify(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>Receber alterações e lembrete antes do evento</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={event.my_response === "interested" ? "default" : "outline"}
                disabled={busy}
                onClick={() => onRespond(event, "interested", notify)}
              >
                Tenho interesse
              </Button>
              <Button
                size="sm"
                variant={event.my_response === "going" ? "default" : "outline"}
                disabled={busy}
                onClick={() => onRespond(event, "going", notify)}
              >
                Vou participar
              </Button>
              {event.my_response !== "none" && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onRespond(event, "none", false)}
                  >
                    Retirar confirmação
                  </Button>
                  {notify !== event.my_notify && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onRespond(event, event.my_response, notify)}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      Salvar avisos
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        )}
        {manage && event.status !== "cancelled" && (
          <div className="flex gap-2 border-t border-border pt-3">
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onEdit(event)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={busy}
              onClick={() => onCancel(event)}
            >
              Cancelar evento
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
export function CommunityEventList({
  reportEvent,
  page,
  mode,
  busy,
  loading,
  error,
  hasPrevious,
  channels,
  onMode,
  onNext,
  onBack,
  onRefresh,
  onNew,
  onEdit,
  onCancel,
  onRespond,
  onChannel,
}: {
  page: CommunityEventPage | undefined;
  reportEvent?: ((id: string) => ReactNode) | undefined;
  mode: EventMode;
  busy: boolean;
  loading: boolean;
  error: string | null;
  hasPrevious: boolean;
  channels: Channel[];
  onMode: (mode: EventMode) => void;
  onNext: () => void;
  onBack: () => void;
  onRefresh: () => void;
  onNew: () => void;
  onEdit: (event: CommunityEvent) => void;
  onCancel: (event: CommunityEvent) => void;
  onRespond: (event: CommunityEvent, response: EventResponse, notify: boolean) => void;
  onChannel: (id: string) => void;
}) {
  return (
    <div className="community-ui space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["upcoming", "Próximos"],
            ["past", "Passados"],
            ["cancelled", "Cancelados"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={mode === key}
            disabled={busy}
            onClick={() => onMode(key)}
            className={
              "rounded-full border px-3 py-1.5 text-xs " +
              (mode === key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground")
            }
          >
            {label}
          </button>
        ))}
        {page?.can_manage && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={busy || loading || !!error}
            onClick={onNew}
          >
            <Plus className="h-3.5 w-3.5" />
            Criar evento
          </Button>
        )}
      </div>
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Tentar novamente
          </Button>
        </div>
      )}
      {loading && !page && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando eventos…
        </p>
      )}
      {page && page.items.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
          <CalendarDays className="mx-auto mb-3 h-7 w-7 text-primary" />
          <p className="text-sm">
            {mode === "upcoming"
              ? "O próximo encontro começa com uma ideia."
              : "Nenhum evento nesta lista."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {mode === "upcoming"
              ? "Ainda não há eventos disponíveis nos canais que você pode ver."
              : "A lista respeita seu acesso atual à comunidade."}
          </p>
        </div>
      )}
      {page?.items.map((event) => (
        <EventCard
          key={`${event.id}:${event.revision}:${event.my_response}:${event.my_notify}`}
          event={event}
          reportAction={reportEvent?.(event.id)}
          channel={channels.find((c) => c.id === event.channel_id)}
          manage={page.can_manage}
          busy={busy || !!error}
          onRespond={onRespond}
          onEdit={onEdit}
          onCancel={onCancel}
          onChannel={onChannel}
        />
      ))}
      <div className="flex justify-between gap-2">
        {hasPrevious ? (
          <Button variant="ghost" size="sm" disabled={busy || loading} onClick={onBack}>
            Página anterior
          </Button>
        ) : (
          <span />
        )}
        {page?.has_more && (
          <Button size="sm" variant="outline" disabled={busy || loading} onClick={onNext}>
            Próxima página
          </Button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Avisos dependem do processamento do servidor. Lembretes são previstos para os 15 minutos
        anteriores; entrega em segundo plano ainda não foi validada neste ambiente local.
      </p>
    </div>
  );
}
