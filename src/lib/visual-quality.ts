export type VisualQuality = "normal" | "optimized" | "maximum";
export const VISUAL_QUALITY_KEY = "lobbyx:visual-quality";
export function resolveVisualQuality(saved: unknown, reduced: boolean): VisualQuality {
  return saved === "normal" || saved === "optimized" || saved === "maximum"
    ? saved
    : reduced
      ? "optimized"
      : "normal";
}
export const VISUAL_QUALITY_BOOTSTRAP = `(()=>{try{document.documentElement.dataset.visualQuality=(function(s,r){return s==="normal"||s==="optimized"||s==="maximum"?s:r?"optimized":"normal"})(localStorage.getItem('lobbyx:visual-quality'),matchMedia('(prefers-reduced-motion: reduce)').matches)}catch{}})()`;
