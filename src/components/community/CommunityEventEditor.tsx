import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  eventLocalInput,
  eventTimeChoices,
  formatEventTime,
  validateEventPayload,
} from "@/lib/community-events";
import type { CommunityEvent, CommunityEventPayload } from "@/types/community-events";
import type { Channel } from "@/types";
export function CommunityEventEditor({
  initial,
  channels,
  conflict,
  onSave,
  onClose,
}: {
  initial: CommunityEvent | null;
  channels: Channel[];
  conflict: boolean;
  onSave: (id: string, payload: CommunityEventPayload, revision: number) => Promise<void>;
  onClose: () => void;
}) {
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [title, setTitle] = useState(initial?.title ?? ""),
    [description, setDescription] = useState(initial?.description ?? ""),
    [cover, setCover] = useState(initial?.cover_url ?? ""),
    [channel, setChannel] = useState(initial?.channel_id ?? "");
  const [zone, setZone] = useState(
      initial?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [start, setStart] = useState(
      initial ? eventLocalInput(initial.starts_at, initial.timezone) : "",
    ),
    [end, setEnd] = useState(
      initial?.ends_at ? eventLocalInput(initial.ends_at, initial.timezone) : "",
    );
  const [startChoice, setStartChoice] = useState(initial?.starts_at ?? ""),
    [endChoice, setEndChoice] = useState(initial?.ends_at ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  let starts: string[] = [],
    ends: string[] = [],
    timeError = "";
  try {
    if (start) {
      starts = eventTimeChoices(start, zone);
      if (
        initial &&
        zone === initial.timezone &&
        startChoice === initial.starts_at &&
        start === eventLocalInput(initial.starts_at, zone)
      ) {
        const exact = new Date(initial.starts_at).toISOString();
        starts = starts.map((t) => (t.slice(0, 16) === exact.slice(0, 16) ? exact : t));
      }
    }
    if (end) {
      ends = eventTimeChoices(end, zone);
      if (
        initial?.ends_at &&
        zone === initial.timezone &&
        endChoice === initial.ends_at &&
        end === eventLocalInput(initial.ends_at, zone)
      ) {
        const exact = new Date(initial.ends_at).toISOString();
        ends = ends.map((t) => (t.slice(0, 16) === exact.slice(0, 16) ? exact : t));
      }
    }
    if ((start && !starts.length) || (end && !ends.length))
      timeError = "Este horário não existe no fuso escolhido. Ajuste a data ou hora.";
  } catch {
    timeError = "Confira data, horário e nome do fuso IANA.";
  }
  const pick = (choices: string[], chosen: string) =>
    choices.length === 1
      ? choices[0]!
      : (choices.find((t) => Date.parse(t) === Date.parse(chosen)) ?? "");
  const instant = pick(starts, startChoice),
    finish = end ? pick(ends, endChoice) : null;
  async function save() {
    if (busy || conflict) return;
    setError("");
    setBusy(true);
    try {
      if (!instant || (end && !finish))
        throw Error("Escolha um horário válido e, se houver ambiguidade, sua ocorrência.");
      await onSave(
        id,
        validateEventPayload({
          title,
          description,
          cover_url: cover || null,
          channel_id: channel,
          starts_at: instant,
          ends_at: finish,
          timezone: zone,
        }),
        initial?.revision ?? 0,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>{initial ? "Editar evento" : "Reúna sua comunidade"}</DialogTitle>
        <DialogDescription>
          O evento fica visível apenas a membros com acesso ao canal associado.
        </DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset className="space-y-4" disabled={busy}>
            <div className="space-y-2">
              <Label htmlFor="event-title">Título</Label>
              <Input
                id="event-title"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Qual é o próximo encontro do squad?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description">Descrição</Label>
              <textarea
                id="event-description"
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-cover">Capa opcional (HTTPS)</Label>
              <Input
                id="event-cover"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-channel">Canal do encontro</Label>
              <select
                id="event-channel"
                required
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">Escolha um canal</option>
                {channels
                  .filter((c) => ["text", "voice", "announcement"].includes(c.type))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.type === "voice" ? "Voz" : "Texto"} · {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-zone">Fuso horário (IANA)</Label>
              <Input
                id="event-zone"
                required
                value={zone}
                onChange={(e) => {
                  setZone(e.target.value);
                  setStartChoice("");
                  setEndChoice("");
                }}
                list="event-zones"
              />
              <datalist id="event-zones">
                <option value="America/Sao_Paulo" />
                <option value="UTC" />
                <option value="America/New_York" />
                <option value="Europe/Lisbon" />
              </datalist>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-start">Início</Label>
                <Input
                  type="datetime-local"
                  id="event-start"
                  required
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setStartChoice("");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end">Fim opcional</Label>
                <Input
                  type="datetime-local"
                  id="event-end"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setEndChoice("");
                  }}
                />
              </div>
            </div>
            {starts.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="event-start-occurrence">Horário repetido: escolha o início</Label>
                <select
                  id="event-start-occurrence"
                  required
                  value={instant}
                  onChange={(e) => setStartChoice(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                >
                  <option value="">Selecione a ocorrência</option>
                  {starts.map((t) => (
                    <option key={t} value={t}>
                      {new Date(t).toISOString()} · UTC
                    </option>
                  ))}
                </select>
              </div>
            )}
            {ends.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="event-end-occurrence">Horário repetido: escolha o fim</Label>
                <select
                  id="event-end-occurrence"
                  required
                  value={finish ?? ""}
                  onChange={(e) => setEndChoice(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                >
                  <option value="">Selecione a ocorrência</option>
                  {ends.map((t) => (
                    <option key={t} value={t}>
                      {t} · UTC
                    </option>
                  ))}
                </select>
              </div>
            )}
            {timeError && (
              <p role="alert" className="text-sm text-destructive">
                {timeError}
              </p>
            )}
            {instant && (
              <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                Início confirmado: {formatEventTime(instant, zone)}
              </p>
            )}
          </fieldset>
          {conflict && (
            <p role="alert" className="text-sm text-destructive">
              A lista mudou ou não pôde ser revalidada. Feche e reabra o evento antes de salvar.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar edição
            </Button>
            <Button disabled={busy || conflict || !instant || !!timeError}>
              {busy ? "Salvando…" : initial ? "Salvar alterações" : "Criar evento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
