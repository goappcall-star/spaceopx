import { CalendarDays, Clock3, Hash, Video, Globe2 } from "lucide-react";
import { CommunitySection, CommunityCover, CommunityNotice } from "./CommunityUI";
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
  const chosenChannel = channels.find((c) => c.id === channel);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="community-ui flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <header className="border-b border-border px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="community-icon">
              <CalendarDays aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="community-eyebrow">Encontros da comunidade</p>
              <DialogTitle>{initial ? "Editar evento" : "Crie um encontro memorável"}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="mt-3">
            Combine o próximo encontro. Somente membros com acesso ao canal poderão vê-lo.
          </DialogDescription>
        </header>
        <form
          className="flex min-h-0 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            <fieldset disabled={busy} className="community-editor-grid">
              <div className="min-w-0 space-y-4">
                <CommunitySection
                  title="O que vai acontecer?"
                  description="Dê um nome fácil de reconhecer e conte o que o squad pode esperar."
                >
                  <Label htmlFor="event-title">Título</Label>
                  <Input
                    id="event-title"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Uma noite de jogos com o squad"
                    className="mt-2 h-12 text-base font-semibold"
                  />
                  <Label htmlFor="event-description" className="mb-2 mt-4 block">
                    Descrição
                  </Label>
                  <textarea
                    id="event-description"
                    maxLength={4000}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="O plano, o jogo e o que cada pessoa precisa saber…"
                    className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm"
                  />
                </CommunitySection>
                <CommunitySection
                  title="Quando e onde"
                  description="Os horários abaixo usam o fuso selecionado."
                >
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-2">
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
                        className="w-full"
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="event-end">Fim opcional</Label>
                      <Input
                        type="datetime-local"
                        id="event-end"
                        value={end}
                        onChange={(e) => {
                          setEnd(e.target.value);
                          setEndChoice("");
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <Label htmlFor="event-channel" className="mb-2 mt-4 flex items-center gap-2">
                    <Hash aria-hidden="true" className="h-4 w-4 text-primary" />
                    Canal do encontro
                  </Label>
                  <select
                    id="event-channel"
                    required
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Escolha o ponto de encontro</option>
                    {channels
                      .filter((c) => ["text", "voice", "announcement"].includes(c.type))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.type === "voice" ? "Voz" : "Texto"} · {c.name}
                        </option>
                      ))}
                  </select>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe2 aria-hidden="true" className="h-3.5 w-3.5" />
                    {zone}
                  </p>
                  {starts.length > 1 && (
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="event-start-occurrence">
                        Horário repetido: escolha o início
                      </Label>
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
                    <div className="mt-4 space-y-2">
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
                  <details className="mt-3 border-t border-border">
                    <summary>Fuso horário e opções avançadas</summary>
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
                      className="mt-2"
                    />
                    <datalist id="event-zones">
                      <option value="America/Sao_Paulo" />
                      <option value="UTC" />
                      <option value="America/New_York" />
                      <option value="Europe/Lisbon" />
                    </datalist>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Horários inexistentes são recusados. Em horários repetidos, escolha a
                      ocorrência acima.
                    </p>
                  </details>
                </CommunitySection>
                <CommunitySection
                  title="Uma capa para o encontro"
                  description="Opcional. A imagem ajuda a reconhecer o evento na comunidade."
                >
                  <Label htmlFor="event-cover">Capa opcional (HTTPS)</Label>
                  <Input
                    id="event-cover"
                    value={cover}
                    onChange={(e) => setCover(e.target.value)}
                    placeholder="https://…"
                    className="mt-2"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Use um link de imagem HTTPS. O envio de arquivos ainda não está disponível para
                    capas de eventos.
                  </p>
                </CommunitySection>
              </div>
              <aside className="community-editor-preview space-y-3" aria-label="Prévia do evento">
                <p className="community-eyebrow">Assim aparece na comunidade</p>
                <CommunityCover
                  src={cover}
                  title={title.trim() || "O próximo encontro começa aqui"}
                  description={description || "A descrição do evento aparecerá aqui."}
                >
                  <div className="space-y-3 border-t border-border pt-3 text-xs">
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {instant && !timeError
                        ? formatEventTime(instant, zone)
                        : "Escolha a data e o horário"}
                    </p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      {chosenChannel?.type === "voice" ? (
                        <Video aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Hash aria-hidden="true" className="h-4 w-4" />
                      )}
                      {chosenChannel?.name ?? "Associe um canal"}
                    </p>
                    <span className="inline-flex rounded-md border border-border px-2 py-1 text-muted-foreground">
                      {initial ? "Prévia das alterações" : "Prévia · ainda não publicado"}
                    </span>
                  </div>
                </CommunityCover>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  A capa e a descrição não mudam quem tem acesso ao canal.
                </p>
              </aside>
            </fieldset>
            <div className="mt-4 space-y-2">
              {timeError && <CommunityNotice tone="error">{timeError}</CommunityNotice>}
              {conflict && (
                <CommunityNotice tone="error">
                  A lista mudou ou não pôde ser revalidada. Feche e reabra o evento antes de salvar.
                </CommunityNotice>
              )}
              {error && <CommunityNotice tone="error">{error}</CommunityNotice>}
            </div>
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar edição
            </Button>
            <Button disabled={busy || conflict || !instant || !!timeError}>
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
              {busy ? "Salvando…" : initial ? "Salvar alterações" : "Criar evento"}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
