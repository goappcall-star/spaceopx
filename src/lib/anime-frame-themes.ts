/** Original LobbyX designs: identifiers and artwork never reference a franchise. */
export const ANIME_FRAME_THEMES = [
  {
    id: "crimson-flow",
    name: "Respiração Carmesim",
    description: "Ondas, espuma e cortes carmesim deslizam pelo contorno.",
    color: "#38bdf8",
    secondary: "#fb7185",
  },
  {
    id: "shadow-rise",
    name: "Ascensão Sombria",
    description: "Sombras abstratas e partículas violeta sobem pelas laterais.",
    color: "#818cf8",
    secondary: "#a855f7",
  },
  {
    id: "celestial-energy",
    name: "Energia Celestial",
    description: "Aura dourada em expansão com pequenas faíscas de energia.",
    color: "#fde047",
    secondary: "#60a5fa",
  },
  {
    id: "void-eye",
    name: "Olho do Vazio",
    description: "Anéis espaciais e partículas magenta nos cantos do perfil.",
    color: "#a78bfa",
    secondary: "#e879f9",
  },
  {
    id: "thunderstorm",
    name: "Tempestade do Trovão",
    description: "Raios finos dourados alternam entre as bordas.",
    color: "#facc15",
    secondary: "#fef9c3",
  },
  {
    id: "crimson-moon",
    name: "Lua Carmesim",
    description: "Arcos rubros, névoa escura e partículas em ascensão.",
    color: "#f43f5e",
    secondary: "#7c3aed",
  },
  {
    id: "neon-impact",
    name: "Impacto Neon",
    description: "Pulsos ciano, linhas de velocidade e fragmentos magenta.",
    color: "#22d3ee",
    secondary: "#e879f9",
  },
  {
    id: "spirit-flame",
    name: "Chama Espiritual",
    description: "Chamas abstratas azuis e brasas violeta flutuam pelas bordas.",
    color: "#38bdf8",
    secondary: "#a78bfa",
  },
] as const;
export type AnimeFrameId = (typeof ANIME_FRAME_THEMES)[number]["id"];
export function isAnimeFrame(value: unknown): value is AnimeFrameId {
  return ANIME_FRAME_THEMES.some((theme) => theme.id === value);
}
