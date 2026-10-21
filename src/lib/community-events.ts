import type {
  CommunityEvent,
  CommunityEventPayload,
  CommunityEventPage,
  CommunityEventNotification,
} from "../types/community-events";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /(Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
const cleanText = (value: string) =>
  !Array.from(value).some((c) => {
    const n = c.codePointAt(0)!;
    return (n < 32 && ![9, 10, 13].includes(n)) || n === 127;
  });
export function eventLocalInput(instant: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
/** A wall clock can have zero, one or two instants. Never silently choose a DST occurrence. */
export function eventTimeChoices(local: string, zone: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw Error("Informe data e horário completos.");
  const baseline = Date.parse(local + ":00Z");
  if (!Number.isFinite(baseline) || new Date(baseline).toISOString().slice(0, 16) !== local)
    throw Error("Data inválida.");
  // Validate zone even for invalid wall clocks.
  new Intl.DateTimeFormat("en", { timeZone: zone }).format(0);
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const t = baseline + hours * 3600000;
    offsets.add(Date.parse(eventLocalInput(new Date(t).toISOString(), zone) + ":00Z") - t);
  }
  return [
    ...new Set(
      [...offsets]
        .map((offset) => baseline - offset)
        .filter((t) => eventLocalInput(new Date(t).toISOString(), zone) === local),
    ),
  ]
    .sort((a, b) => a - b)
    .map((t) => new Date(t).toISOString());
}
export function formatEventTime(instant: string, zone: string) {
  return (
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(instant)) +
    " · " +
    zone
  );
}
export function validateEventPayload(input: CommunityEventPayload): CommunityEventPayload {
  const v = { ...input, title: input.title.trim() };
  if (
    !v.title ||
    Array.from(v.title).length > 120 ||
    typeof v.description !== "string" ||
    Array.from(v.description).length > 4000 ||
    !cleanText(v.title + v.description)
  )
    throw Error("Use título de até 120 e descrição de até 4.000 caracteres.");
  if (!uuid.test(v.channel_id)) throw Error("Escolha um canal disponível.");
  if (
    !validDate(v.starts_at) ||
    (v.ends_at !== null &&
      (!validDate(v.ends_at) || Date.parse(v.ends_at) <= Date.parse(v.starts_at)))
  )
    throw Error("Confira o início e o fim do evento.");
  new Intl.DateTimeFormat("en", { timeZone: v.timezone }).format(0);
  if (v.cover_url !== null) {
    const u = new URL(v.cover_url);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      v.cover_url.length > 8192 ||
      /\s/.test(v.cover_url) ||
      !cleanText(v.cover_url)
    )
      throw Error("A capa precisa usar HTTPS sem credenciais.");
  }
  return v;
}
export function parseCommunityEvent(value: unknown, serverId: string): CommunityEvent {
  const v = value as CommunityEvent;
  if (
    !v ||
    !uuid.test(v.id) ||
    v.server_id !== serverId ||
    !uuid.test(v.server_id) ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 1 ||
    !["scheduled", "cancelled"].includes(v.status) ||
    !["none", "interested", "going"].includes(v.my_response) ||
    typeof v.my_notify !== "boolean" ||
    ![v.interested_count, v.going_count].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    !validDate(v.created_at) ||
    !validDate(v.updated_at)
  )
    throw Error("community_event_invalid_response");
  validateEventPayload({
    ...v,
    channel_id: v.channel_id ?? "00000000-0000-0000-0000-000000000000",
  });
  return v;
}
export function parseEventPage(value: unknown, serverId: string): CommunityEventPage {
  const v = value as CommunityEventPage;
  if (
    !v ||
    !Array.isArray(v.items) ||
    v.items.length > 30 ||
    typeof v.has_more !== "boolean" ||
    typeof v.can_manage !== "boolean"
  )
    throw Error("community_event_invalid_response");
  return {
    items: v.items.map((e) => parseCommunityEvent(e, serverId)),
    has_more: v.has_more,
    can_manage: v.can_manage,
  };
}
export function parseEventNotifications(value: unknown): CommunityEventNotification[] {
  if (!Array.isArray(value) || value.length > 20) throw Error("community_event_invalid_response");
  return value.map((v: CommunityEventNotification) => {
    if (
      !uuid.test(v.id) ||
      !uuid.test(v.event_id) ||
      !uuid.test(v.server_id) ||
      typeof v.title !== "string" ||
      !["updated", "cancelled", "reminder"].includes(v.kind) ||
      !validDate(v.created_at) ||
      !validDate(v.starts_at)
    )
      throw Error("community_event_invalid_response");
    return v;
  });
}
export function communityEventError(error: unknown) {
  const msg = String((error as { message?: unknown })?.message ?? error);
  if (/community_revision_conflict|40001/.test(msg))
    return "Este evento mudou em outra sessão. Atualize e revise antes de continuar.";
  if (/community_not_authorized|42501/.test(msg))
    return "Você não tem acesso a este evento ou não pode gerenciá-lo.";
  if (/community_event_cancelled|community_event_closed/.test(msg))
    return "O evento foi cancelado ou já terminou. Atualize a lista.";
  if (/community_event_past_start/.test(msg))
    return "O início de um novo evento ou o novo horário deve estar no futuro.";
  if (/community_invalid_channel/.test(msg))
    return "Escolha um canal de texto ou voz disponível neste servidor.";
  if (/community_event_invalid|22023|22007|22P02/.test(msg))
    return "Confira os dados, horários, fuso e capa do evento.";
  if (/Muitos envios/.test(msg)) return "Muitas alterações. Aguarde antes de tentar novamente.";
  if (/PGRST202|does not exist/.test(msg))
    return "O backend de eventos ainda não está disponível neste ambiente.";
  return "Não foi possível concluir. Confira a conexão e tente novamente.";
}
