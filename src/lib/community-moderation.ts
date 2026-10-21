import type {
  CommunityReport,
  CommunityWarning,
  ModerationAccess,
  ModerationCapability,
  ModerationDecision,
  ModerationHistory,
  ModerationPage,
  CommunitySecurity,
  PlatformDirectoryReview,
  SecuritySettings,
  ReportKind,
  ReportCategory,
} from "@/types/community-moderation";
export const moderationCapabilities: ModerationCapability[] = [
  "reports",
  "warnings",
  "members",
  "security",
  "history",
];
export const reportKindLabels: Record<ReportKind, string> = {
  message: "Mensagem",
  member: "Membro",
  event: "Evento",
  notice: "Aviso",
  directory: "Comunidade pública",
};
export function moderationActionLabel(action: string) {
  return (
    (
      {
        warn: "Advertência registrada",
        kick: "Membro expulso",
        ban: "Membro banido",
        warning_revoked: "Advertência revogada",
        report_resolved: "Análise concluída",
        report_dismissed: "Denúncia sem procedência",
        directory_suspend: "Comunidade suspensa do diretório",
        directory_restore: "Suspensão revertida",
        directory_remove_feature: "Destaque removido",
        security_updated: "Segurança atualizada",
        delegation_updated: "Delegação atualizada",
        report_submitted: "Denúncia registrada",
      } as Record<string, string>
    )[action] ?? "Decisão registrada"
  );
}
export const reportCategories: { value: ReportCategory; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Assédio ou ofensa" },
  { value: "unsafe", label: "Conteúdo perigoso" },
  { value: "privacy", label: "Privacidade" },
  { value: "other", label: "Outro motivo" },
];
function invalid(): never {
  throw Error("moderation_invalid_response");
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
  return v as Record<string, unknown>;
}
function text(v: unknown, max = 3000) {
  return typeof v === "string" && v.length <= max ? v : invalid();
}
function nullable(v: unknown, max = 3000) {
  return v === null ? null : text(v, max);
}
function bool(v: unknown) {
  return typeof v === "boolean" ? v : invalid();
}
function integer(v: unknown, min = 1, max = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max ? Number(v) : invalid();
}
function date(v: unknown) {
  const s = text(v, 100);
  return Number.isFinite(Date.parse(s)) ? s : invalid();
}
export function moderationId(v: unknown) {
  const s = text(v, 36);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : invalid();
}
function optionalId(v: unknown) {
  return v === null ? null : moderationId(v);
}
function caps(v: unknown): ModerationCapability[] {
  if (!Array.isArray(v) || v.length > 5 || v.some((x) => !moderationCapabilities.includes(x)))
    return invalid();
  return [...new Set(v)];
}
export function parseModerationAccess(v: unknown): ModerationAccess {
  const p = object(v);
  return {
    platform: bool(p["platform"]),
    owner: bool(p["owner"]),
    capabilities: caps(p["capabilities"]),
  };
}
function decisions(v: unknown): ModerationDecision[] {
  if (!Array.isArray(v) || v.length > 50) return invalid();
  return v.map((x) => {
    const d = object(x);
    return {
      action: text(d["action"], 80),
      reason: nullable(d["reason"], 1000),
      actor_id: optionalId(d["actor_id"]),
      created_at: date(d["created_at"]),
    };
  });
}
export function parseReport(v: unknown): CommunityReport {
  const p = object(v);
  if (
    !["message", "member", "event", "notice", "directory"].includes(String(p["kind"])) ||
    !reportCategories.some((c) => c.value === p["category"]) ||
    !["pending", "resolved", "dismissed"].includes(String(p["status"]))
  )
    return invalid();
  return {
    id: moderationId(p["id"]),
    server_id: moderationId(p["server_id"]),
    kind: p["kind"] as ReportKind,
    target_id: moderationId(p["target_id"]),
    category: p["category"] as ReportCategory,
    status: p["status"] as CommunityReport["status"],
    revision: integer(p["revision"]),
    description: nullable(p["description"], 2000),
    evidence: nullable(p["evidence"], 1000),
    evidence_until: date(p["evidence_until"]),
    reviewed_by: optionalId(p["reviewed_by"]),
    created_at: date(p["created_at"]),
    decisions: decisions(p["decisions"]),
  };
}
export function parseWarning(v: unknown): CommunityWarning {
  const p = object(v);
  if (!["active", "revoked"].includes(String(p["status"]))) return invalid();
  return {
    id: moderationId(p["id"]),
    target_user_id: optionalId(p["target_user_id"]),
    actor_id: optionalId(p["actor_id"]),
    reason: nullable(p["reason"], 1000),
    status: p["status"] as CommunityWarning["status"],
    revision: integer(p["revision"]),
    created_at: date(p["created_at"]),
    decisions: decisions(p["decisions"]),
  };
}
export function parseHistory(v: unknown): ModerationHistory {
  const p = object(v);
  return {
    ...decisions([p])[0]!,
    id: moderationId(p["id"]),
    entity_id: moderationId(p["entity_id"]),
  };
}
export function parseModerationPage<T>(v: unknown, parse: (v: unknown) => T): ModerationPage<T> {
  const p = object(v);
  if (!Array.isArray(p["items"]) || p["items"].length > 30) return invalid();
  return { items: p["items"].map(parse), has_more: bool(p["has_more"]) };
}
export function validateSecurity(v: unknown): SecuritySettings {
  const p = object(v);
  if (!Array.isArray(p["blocked_domains"]) || p["blocked_domains"].length > 50) return invalid();
  const domains = p["blocked_domains"].map((x) => text(x, 253).trim().toLowerCase());
  if (domains.some((s) => !/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(s)))
    return invalid();
  return {
    revision: integer(p["revision"], 0),
    enabled: bool(p["enabled"]),
    burst_limit: integer(p["burst_limit"], 3, 30),
    repeat_limit: integer(p["repeat_limit"], 2, 10),
    mentions_limit: integer(p["mentions_limit"], 1, 30),
    blocked_domains: [...new Set(domains)],
  };
}
export function parseCommunitySecurity(v: unknown): CommunitySecurity {
  const p = object(v);
  if (!Array.isArray(p["grants"])) return invalid();
  return {
    settings: validateSecurity(p["settings"]),
    grants: p["grants"].map((x) => {
      const g = object(x);
      return {
        role_id: moderationId(g["role_id"]),
        name: text(g["name"], 100),
        capabilities: caps(g["capabilities"]),
      };
    }),
  };
}
export function parsePlatformDirectory(v: unknown): PlatformDirectoryReview | null {
  if (v === null) return null;
  const p = object(v);
  if (!["listed", "unlisted", "suspended"].includes(String(p["status"]))) return invalid();
  const s = p["presentation"] === null ? null : object(p["presentation"]);
  return {
    server_id: moderationId(p["server_id"]),
    revision: integer(p["revision"]),
    status: p["status"] as PlatformDirectoryReview["status"],
    featured: bool(p["featured"]),
    presentation: s
      ? { name: text(s["name"], 100), description: text(s["description"], 3000) }
      : null,
  };
}
export function moderationError(error: unknown) {
  const raw = String(
    error && typeof error === "object" && "message" in error ? error.message : error,
  );
  if (/community_spam_rate/.test(raw))
    return "Muitas mensagens em sequência. Aguarde 10 segundos. Seu texto foi mantido.";
  if (/community_spam_repeat/.test(raw))
    return "Conteúdo repetido bloqueado pela comunidade. Revise o texto ou aguarde um minuto.";
  if (/community_spam_mentions/.test(raw))
    return "Esta mensagem excede o limite de menções da comunidade. Reduza as marcações.";
  if (/community_spam_link/.test(raw))
    return "Um domínio da mensagem está bloqueado pelas regras desta comunidade. Revise os links.";
  if (/40001|moderation_conflict/.test(raw))
    return "Os dados mudaram em outra sessão. Atualize antes de continuar.";
  if (/independent_review/.test(raw))
    return "Esta decisão precisa de outra pessoa autorizada. Você está envolvido nesta ação.";
  if (/owner_required/.test(raw)) return "Somente o proprietário pode delegar estas permissões.";
  if (/protected_target/.test(raw))
    return "Este membro está protegido pela propriedade, hierarquia ou delegação.";
  if (/report_cooldown/.test(raw))
    return "Uma denúncia deste conteúdo já foi analisada recentemente. Aguarde 24 horas.";
  if (/42501|not_authorized|target_unavailable/.test(raw))
    return "Você não tem acesso a esta operação ou o conteúdo não está mais disponível.";
  if (/Muitos envios/.test(raw))
    return "Muitas ações em sequência. Aguarde antes de tentar novamente.";
  if (/invalid|23514/.test(raw)) return "Confira os campos e os limites antes de continuar.";
  return "Não foi possível concluir. Confira a conexão e a migration local.";
}
