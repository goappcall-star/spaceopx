import type { CommunityCategory, CommunityPayload, CommunitySettings } from "../types/community";

export const COMMUNITY_CATEGORIES: { value: CommunityCategory; label: string }[] = [
  { value: "gaming", label: "Jogos" },
  { value: "technology", label: "Tecnologia" },
  { value: "creative", label: "Criação e arte" },
  { value: "education", label: "Aprendizado" },
  { value: "social", label: "Convívio e conversas" },
  { value: "other", label: "Outros interesses" },
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalidControls(value: string, singleLine = false) {
  return Array.from(value).some((char) => {
    const code = char.codePointAt(0)!;
    return code === 127 || (code < 32 && (singleLine || ![9, 10, 13].includes(code)));
  });
}
export function validateCommunityPayload(payload: CommunityPayload): CommunityPayload {
  if (!Array.isArray(payload.rules) || payload.rules.length < 1 || payload.rules.length > 20) {
    throw new Error("Adicione de 1 a 20 regras.");
  }
  const ids = new Set<string>();
  const rules = payload.rules.map((rule) => {
    const text = rule.text.trim(),
      id = rule.id.toLowerCase();
    if (
      !uuid.test(id) ||
      ids.has(id) ||
      !text ||
      Array.from(text).length > 1000 ||
      invalidControls(text)
    ) {
      throw new Error(
        "Cada regra precisa de um texto de até 1.000 caracteres e uma identificação única.",
      );
    }
    ids.add(id);
    return { id, text };
  });
  if (!uuid.test(payload.welcome_channel_id)) throw new Error("Selecione um canal de boas-vindas.");
  if (!COMMUNITY_CATEGORIES.some((c) => c.value === payload.category_slug))
    throw new Error("Selecione uma categoria.");
  if (!Array.isArray(payload.interests) || payload.interests.length > 10)
    throw new Error("Use até 10 interesses.");
  const interests = [
    ...new Set(
      payload.interests.map((interest) => {
        const text = interest.trim().toLowerCase();
        if (
          Array.from(text).length < 2 ||
          Array.from(text).length > 30 ||
          invalidControls(text, true)
        ) {
          throw new Error("Cada interesse deve ter de 2 a 30 caracteres.");
        }
        return text;
      }),
    ),
  ];
  return {
    rules,
    welcome_channel_id: payload.welcome_channel_id.toLowerCase(),
    category_slug: payload.category_slug,
    interests,
  };
}

/** Backend responses are projected explicitly; no actor IDs enter the UI cache. */
export function parseCommunitySettings(value: unknown): CommunitySettings {
  if (!value || typeof value !== "object") throw new Error("community_invalid_response");
  const row = value as Record<string, unknown>;
  if (
    typeof row["server_id"] !== "string" ||
    !uuid.test(row["server_id"]) ||
    typeof row["enabled"] !== "boolean" ||
    !Number.isSafeInteger(row["revision"]) ||
    Number(row["revision"]) < 1 ||
    !Number.isSafeInteger(row["rules_revision"]) ||
    Number(row["rules_revision"]) < 1 ||
    (row["welcome_channel_id"] !== null &&
      (typeof row["welcome_channel_id"] !== "string" || !uuid.test(row["welcome_channel_id"])))
  ) {
    throw new Error("community_invalid_response");
  }
  const payload = validateCommunityPayload({
    rules: row["rules"] as CommunityPayload["rules"],
    welcome_channel_id:
      row["welcome_channel_id"] === null
        ? "00000000-0000-0000-0000-000000000000"
        : (row["welcome_channel_id"] as string),
    category_slug: row["category_slug"] as CommunityCategory,
    interests: row["interests"] as string[],
  });
  function timestamp(key: string, nullable: boolean) {
    const item = row[key];
    if (nullable && item === null) return null;
    if (typeof item !== "string" || !Number.isFinite(Date.parse(item)))
      throw new Error("community_invalid_response");
    return item;
  }
  return {
    ...payload,
    server_id: row["server_id"],
    enabled: row["enabled"],
    welcome_channel_id: row["welcome_channel_id"] as string | null,
    revision: Number(row["revision"]),
    rules_revision: Number(row["rules_revision"]),
    activated_at: timestamp("activated_at", true),
    disabled_at: timestamp("disabled_at", true),
    created_at: timestamp("created_at", false)!,
    updated_at: timestamp("updated_at", false)!,
  };
}
