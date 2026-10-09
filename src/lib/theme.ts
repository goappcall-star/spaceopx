export type ThemeMode = "light" | "dark" | "system";
export const THEME_KEY = "lobbyx:theme";
export function normalizeTheme(value: unknown): ThemeMode {
  return value === "light" || value === "system" ? value : "dark";
}
export function resolvedTheme(mode: ThemeMode, systemDark: boolean) {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}
// Run before the app paints, including the desktop's static shell.
export const THEME_BOOTSTRAP = `(()=>{try{const m=localStorage.getItem('${THEME_KEY}');const dark=m==='system'?matchMedia('(prefers-color-scheme: dark)').matches:m!=='light';document.documentElement.classList.toggle('dark',dark);document.documentElement.classList.toggle('light',!dark);document.documentElement.style.colorScheme=dark?'dark':'light'}catch{}})();`;
