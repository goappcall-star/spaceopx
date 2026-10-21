import type {
  CommunityExperienceConfig,
  CommunityModule,
  CommunityExperience,
} from "../types/community-experience";
export const COMMUNITY_MODULES: CommunityModule[] = [
  "notices",
  "voice",
  "channels",
  "interests",
  "events",
];
export const MODULE_LABELS: Record<CommunityModule, string> = {
  notices: "Avisos fixados",
  voice: "Salas de voz",
  channels: "Canais em destaque",
  interests: "Nossos interesses",
  events: "Eventos",
};
export const DEFAULT_EXPERIENCE: CommunityExperienceConfig = {
  home_enabled: true,
  intro: "",
  banner_url: null,
  notices: [],
  featured_channels: [],
  modules: [...COMMUNITY_MODULES],
  welcome_enabled: true,
  welcome_text: "Bem-vindo à comunidade!",
  rules_enabled: true,
  rules_required: false,
  interests_enabled: true,
  channels_enabled: true,
  roles_enabled: false,
  role_ids: [],
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safe = (s: string) =>
  !Array.from(s).some((c) => {
    const n = c.codePointAt(0)!;
    return (n < 32 && ![9, 10, 13].includes(n)) || n === 127;
  });
export function validateExperience(value: CommunityExperienceConfig): CommunityExperienceConfig {
  const v = structuredClone(value);
  const bools = [
    "home_enabled",
    "welcome_enabled",
    "rules_enabled",
    "rules_required",
    "interests_enabled",
    "channels_enabled",
    "roles_enabled",
  ] as const;
  if (bools.some((k) => typeof v[k] !== "boolean") || (v.rules_required && !v.rules_enabled))
    throw Error("Confira as etapas e o aceite das regras.");
  for (const key of ["intro", "welcome_text"] as const)
    if (typeof v[key] !== "string" || Array.from(v[key]).length > 2000 || !safe(v[key]))
      throw Error("Use textos de até 2.000 caracteres.");
  if (v.banner_url !== null) {
    const u = new URL(v.banner_url);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      v.banner_url.length > 8192 ||
      !safe(v.banner_url) ||
      /\s/.test(v.banner_url)
    )
      throw Error("Use uma imagem HTTPS sem credenciais.");
  }
  for (const k of ["featured_channels", "role_ids"] as const)
    if (
      !Array.isArray(v[k]) ||
      v[k].length > 10 ||
      new Set(v[k]).size !== v[k].length ||
      v[k].some((id) => !uuid.test(id))
    )
      throw Error("Escolha até 10 canais ou cargos válidos.");
  if (
    !Array.isArray(v.modules) ||
    v.modules.length !== 5 ||
    new Set(v.modules).size !== 5 ||
    v.modules.some((m) => !COMMUNITY_MODULES.includes(m))
  )
    throw Error("Ordem dos módulos inválida.");
  if (
    !Array.isArray(v.notices) ||
    v.notices.length > 5 ||
    new Set(v.notices.map((n) => n.id)).size !== v.notices.length ||
    v.notices.some(
      (n) =>
        !uuid.test(n.id) ||
        !n.title.trim() ||
        Array.from(n.title).length > 100 ||
        !n.body.trim() ||
        Array.from(n.body).length > 2000 ||
        !safe(n.title + n.body),
    )
  )
    throw Error("Preencha até cinco avisos, com título de 100 e texto de 2.000 caracteres.");
  return v;
}
export function selectableCommunityRole(role: {
  name: string;
  is_owner?: boolean;
  permissions: Record<string, boolean | undefined>;
}) {
  return (
    !role.is_owner &&
    !["OWNER", "ADMIN", "MEMBER"].includes(role.name) &&
    Object.entries(role.permissions).every(
      ([key, value]) =>
        value !== true ||
        ["view_channel", "read_messages", "send_messages", "connect", "speak"].includes(key),
    )
  );
}
export function parseExperience(value: unknown, serverId: string): CommunityExperience | null {
  if (value === null) return null;
  const v = value as CommunityExperience;
  if (
    !v ||
    v.server_id !== serverId ||
    !Number.isInteger(v.revision) ||
    v.revision < 1 ||
    !Number.isInteger(v.rules_revision) ||
    v.rules_revision < 1 ||
    typeof v.can_manage !== "boolean" ||
    typeof v.screened !== "boolean" ||
    !Array.isArray(v.rules) ||
    !Array.isArray(v.interests) ||
    v.interests.some((i) => typeof i !== "string") ||
    !Object.hasOwn(v, "progress")
  )
    throw Error("community_invalid_response");
  validateExperience(v.experience);
  if (
    v.progress &&
    (!Array.isArray(v.progress.interests) ||
      !Array.isArray(v.progress.selected_roles) ||
      v.progress.interests.some((i) => typeof i !== "string") ||
      v.progress.selected_roles.some((i) => !uuid.test(i)))
  )
    throw Error("community_invalid_response");
  return v;
}
export function onboardingNeeded(data: CommunityExperience) {
  return (
    data.progress?.completed_revision !== data.revision ||
    (data.experience.rules_required && data.progress?.accepted_revision !== data.rules_revision)
  );
}
