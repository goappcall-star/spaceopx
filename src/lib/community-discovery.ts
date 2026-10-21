import type {
  CommunityPresentation,
  DiscoveryPayload,
  PublicCommunity,
  DiscoveryPage,
  DiscoverySettings,
  JoinRequest,
  DiscoveryFilters,
} from "@/types/community-discovery";
const categories = ["gaming", "technology", "creative", "education", "social", "other"];
export const emptyDiscoveryFilters: DiscoveryFilters = {
  search: "",
  category: "",
  language: "",
  interest: "",
  featured: false,
};
function controls(s: string, single = false) {
  return Array.from(s).some((c) => {
    const n = c.codePointAt(0)!;
    return n === 127 || (n < 32 && (single || ![9, 10, 13].includes(n)));
  });
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(): never {
  throw Error("directory_invalid_response");
}
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
}
function str(v: unknown, max: number, min = 0) {
  if (typeof v !== "string" || v.length > max || v.trim().length < min || controls(v))
    return fail();
  return v;
}
function arr(v: unknown, max: number) {
  if (!Array.isArray(v) || v.length > 10) return fail();
  return v.map((x) => str(x, max, 1));
}
function image(v: unknown) {
  if (v === null) return null;
  const s = str(v, 2048, 1);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return fail();
  }
  if (u.protocol !== "https:" || u.username || u.password || /\s/.test(s) || controls(s, true))
    return fail();
  return s;
}
function bool(v: unknown) {
  return typeof v === "boolean" ? v : fail();
}
function revision(v: unknown) {
  return Number.isSafeInteger(v) && Number(v) > 0 ? Number(v) : fail();
}
function date(v: unknown) {
  return typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : fail();
}
export function validateDiscoveryPayload(value: unknown): DiscoveryPayload {
  const p = obj(value);
  const category = str(p["category"], 20);
  const admission = p["admission"];
  if (!categories.includes(category) || !["direct", "approval"].includes(String(admission)))
    return fail();
  const language = str(p["language"], 35);
  if (!/^([a-z]{2,3}(-[a-z0-9]{2,8})*)?$/.test(language)) return fail();
  return {
    name: str(p["name"], 100, 2).trim(),
    description: str(p["description"], 3000, 20).trim(),
    icon_url: image(p["icon_url"]),
    banner_url: image(p["banner_url"]),
    category,
    language,
    interests: arr(p["interests"], 40).map((x) => x.trim().toLowerCase()),
    public_rules: arr(p["public_rules"], 500),
    admission: admission as "direct" | "approval",
    consent: bool(p["consent"]),
  };
}
export function parsePublicCommunity(value: unknown): PublicCommunity {
  const p = obj(value);
  if (typeof p["server_id"] !== "string" || !uuid.test(p["server_id"])) return fail();
  const payload = validateDiscoveryPayload({ ...p, consent: true });
  // Only allowlisted public fields are returned; never forward unknown server metadata.
  return {
    server_id: p["server_id"],
    name: payload.name,
    description: payload.description,
    icon_url: payload.icon_url,
    banner_url: payload.banner_url,
    category: payload.category,
    language: payload.language,
    interests: payload.interests,
    public_rules: payload.public_rules,
    admission: payload.admission,
    published_at: p["published_at"] === null ? null : date(p["published_at"]),
    featured: bool(p["featured"]),
  };
}
export function parseDiscoveryPage(value: unknown): DiscoveryPage {
  const p = obj(value);
  if (!Array.isArray(p["items"]) || p["items"].length > 30) return fail();
  return { items: p["items"].map(parsePublicCommunity), has_more: bool(p["has_more"]) };
}
export function parsePresentation(value: unknown): CommunityPresentation | null {
  if (value === null) return null;
  const p = obj(value),
    r = p["my_request"] === null ? null : obj(p["my_request"]);
  if (r && !["pending", "approved", "rejected", "withdrawn"].includes(String(r["status"])))
    return fail();
  return {
    ...parsePublicCommunity(p),
    revision: revision(p["revision"]),
    my_membership: bool(p["my_membership"]),
    can_join: bool(p["can_join"]),
    my_request: r
      ? {
          status: r["status"] as NonNullable<CommunityPresentation["my_request"]>["status"],
          revision: revision(r["revision"]),
        }
      : null,
  };
}
export function parseDiscoverySettings(value: unknown): DiscoverySettings {
  const p = obj(value),
    d = p["listing"] === null ? null : obj(p["listing"]);
  if (d && !["listed", "unlisted", "suspended"].includes(String(d["status"]))) return fail();
  return {
    is_owner: bool(p["is_owner"]),
    listing: d
      ? {
          ...parsePublicCommunity(d),
          revision: revision(d["revision"]),
          status: d["status"] as "listed" | "unlisted" | "suspended",
        }
      : null,
  };
}
export function parseJoinRequests(value: unknown): { items: JoinRequest[]; has_more: boolean } {
  const p = obj(value);
  if (!Array.isArray(p["items"]) || p["items"].length > 30) return fail();
  return {
    items: p["items"].map((v) => {
      const r = obj(v);
      if (typeof r["user_id"] !== "string" || !uuid.test(r["user_id"])) return fail();
      return {
        user_id: r["user_id"],
        display_name: str(r["display_name"], 100),
        avatar_url: r["avatar_url"] === null ? null : str(r["avatar_url"], 8192),
        revision: revision(r["revision"]),
        created_at: date(r["created_at"]),
      };
    }),
    has_more: bool(p["has_more"]),
  };
}
export function discoveryError(error: unknown) {
  const s = String(
    error && typeof error === "object" && "message" in error ? error.message : error,
  );
  if (/40001|revision_conflict/.test(s))
    return "A configuração mudou. Atualize antes de continuar.";
  if (/owner_required/.test(s))
    return "Somente o proprietário pode publicar ou retirar a comunidade.";
  if (/suspended/.test(s))
    return "Esta comunidade está suspensa do diretório. O proprietário não pode remover a suspensão.";
  if (/request_cooldown/.test(s))
    return "Aguarde 24 horas após uma recusa ou retirada antes de solicitar novamente.";
  if (/eligibility/.test(s))
    return "Confirme a divulgação pública e adicione ao menos uma regra pública.";
  if (/unsafe_default_role/.test(s))
    return "O cargo padrão exige revisão administrativa antes de novos ingressos.";
  if (/Muitos envios/.test(s)) return "Muitas ações em sequência. Aguarde um pouco.";
  if (/42501|not_authorized|join_unavailable|inactive/.test(s))
    return "Esta operação não está disponível com suas permissões atuais.";
  if (/invalid/.test(s)) return "Confira os campos e atualize os dados antes de tentar novamente.";
  return "Não foi possível carregar a descoberta. Confira a conexão e a migration local.";
}
