export const SERVER_THEMES = ["gaming", "technology", "study", "art", "other"] as const;
export type ServerTheme = (typeof SERVER_THEMES)[number];
export interface ServerSetupDraft {
  name: string;
  description: string;
  visibility: "public" | "private";
  theme: ServerTheme;
  iconFile: File | null;
}
export function validateServerSetup(draft: ServerSetupDraft) {
  const name = draft.name.trim(),
    description = draft.description.trim();
  if ([...name].length < 2 || [...name].length > 60)
    throw Error("Use um nome entre 2 e 60 caracteres.");
  if ([...description].length > 200) throw Error("Use uma descrição de até 200 caracteres.");
  if (
    Array.from(name + description).some((c) => {
      const n = c.codePointAt(0)!;
      return (n < 32 && ![9, 10, 13].includes(n)) || n === 127;
    })
  )
    throw Error("Remova os caracteres inválidos do texto.");
  if (!SERVER_THEMES.includes(draft.theme) || !["public", "private"].includes(draft.visibility))
    throw Error("Confira a categoria e a visibilidade.");
  return { ...draft, name, description };
}
export function validateServerIcon(file: Pick<File, "size" | "type">) {
  if (!file.size) return "A imagem está vazia.";
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type))
    return "Escolha PNG, JPG, WEBP ou GIF.";
  if (file.size > 4 * 1024 * 1024) return "Escolha uma imagem de até 4 MB.";
  return null;
}
export function extractServerInviteCode(value: string) {
  const raw = value.trim();
  if (/^[A-Za-z0-9_-]{1,128}$/.test(raw)) return raw.toLowerCase();
  try {
    const url = new URL(raw);
    if (!["https:", "http:", "lobbyx:"].includes(url.protocol) || url.username || url.password)
      throw Error();
    const path =
      url.protocol === "lobbyx:" && url.hostname === "invite"
        ? `/invite${url.pathname}`
        : url.pathname;
    const code = /^\/invite\/([A-Za-z0-9_-]{1,128})\/?$/.exec(path)?.[1];
    if (code) return code.toLowerCase();
  } catch {
    /* Return the same useful error for malformed URLs and codes. */
  }
  throw Error("Cole um código ou um link de convite válido do LobbyX.");
}
