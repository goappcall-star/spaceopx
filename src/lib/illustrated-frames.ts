export const ILLUSTRATED_FRAME_IDS = [
  "shadow-rise",
  "celestial-energy",
  "void-eye",
  "thunderstorm",
  "crimson-moon",
  "aurora",
  "cosmic",
  "royal",
  "sakura",
] as const;
export type IllustratedFrameId = (typeof ILLUSTRATED_FRAME_IDS)[number];
export function isIllustratedFrame(value: unknown): value is IllustratedFrameId {
  return ILLUSTRATED_FRAME_IDS.some((id) => id === value);
}
export const FRAME_PALETTES: Record<IllustratedFrameId, [string, string]> = {
  "shadow-rise": ["#b047ff", "#622baf"],
  "celestial-energy": ["#ffd45c", "#4fe4ff"],
  "void-eye": ["#c344ff", "#40eaff"],
  thunderstorm: ["#ffcc35", "#fff3a6"],
  "crimson-moon": ["#ff284b", "#650d26"],
  aurora: ["#50ffe0", "#4eaeff"],
  cosmic: ["#8aa5ff", "#ffe39f"],
  royal: ["#ffc45b", "#fff3ce"],
  sakura: ["#ffaddb", "#fff2fa"],
};
