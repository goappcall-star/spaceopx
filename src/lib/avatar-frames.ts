export const AVATAR_FRAMES = [
  { id: "default", name: "Padrão", description: "Sua foto, sem decoração." },
  { id: "neon", name: "Neon X", description: "Verde elétrico e detalhes violeta." },
  { id: "orbit", name: "Órbita", description: "Anéis ciano e estrelas em órbita." },
  { id: "royal", name: "Coroa", description: "Acabamento dourado e uma coroa." },
] as const;
export type AvatarFrameId = (typeof AVATAR_FRAMES)[number]["id"];
export function normalizeAvatarFrame(value: unknown): AvatarFrameId {
  return AVATAR_FRAMES.find((frame) => frame.id === value)?.id ?? "default";
}
