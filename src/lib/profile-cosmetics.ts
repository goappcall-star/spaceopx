import type { CSSProperties } from "react";

export const PROFILE_COSMETICS = [
  {
    id: "none",
    name: "Nenhum",
    description: "Seu perfil sem decoração.",
    color: "transparent",
    secondary: "transparent",
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Luzes ciano e violeta sobre a sua identidade.",
    color: "#22d3ee",
    secondary: "#a78bfa",
  },
  {
    id: "cosmic",
    name: "Voo noturno",
    description: "Um céu de estrelas em azul profundo.",
    color: "#818cf8",
    secondary: "#38bdf8",
  },
  {
    id: "royal",
    name: "Imperial",
    description: "Detalhes dourados com acabamento elegante.",
    color: "#fbbf24",
    secondary: "#f97316",
  },
  {
    id: "ember",
    name: "Chama",
    description: "Energia laranja com contornos incandescentes.",
    color: "#fb923c",
    secondary: "#ef4444",
  },
  {
    id: "sakura",
    name: "Flor de cerejeira",
    description: "Rosa suave e detalhes lilás.",
    color: "#f9a8d4",
    secondary: "#c084fc",
  },
] as const;
export type ProfileCosmeticId = (typeof PROFILE_COSMETICS)[number]["id"];
export function normalizeProfileCosmetic(value: unknown): ProfileCosmeticId {
  return PROFILE_COSMETICS.find((item) => item.id === value)?.id ?? "none";
}
export function profileCosmetic(value: unknown) {
  return PROFILE_COSMETICS.find((item) => item.id === normalizeProfileCosmetic(value))!;
}

export function nameplateStyle(value: unknown): CSSProperties {
  const item = profileCosmetic(value);
  if (item.id === "none") return {};
  const stars =
    item.id === "cosmic" || item.id === "aurora"
      ? `radial-gradient(circle at 75% 20%, #ffffffbb 1px, transparent 2px), radial-gradient(circle at 90% 65%, ${item.color} 1px, transparent 2px), radial-gradient(circle at 60% 75%, #ffffff88 1px, transparent 2px), `
      : "";
  return {
    backgroundImage: `${stars}radial-gradient(circle at 88% 20%, ${item.color}55, transparent 32%), radial-gradient(circle at 70% 90%, ${item.secondary}40, transparent 55%), linear-gradient(110deg, transparent 15%, ${item.color}18)`,
    boxShadow: `inset -2px 0 ${item.color}80`,
  };
}
