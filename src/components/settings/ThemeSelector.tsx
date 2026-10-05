import { useTheme } from "@/hooks/use-theme";
import { Label } from "@/components/ui/label";
import type { ThemeMode } from "@/lib/theme";
export function ThemeSelector() {
  const { mode, setMode } = useTheme();
  return (
    <div className="space-y-2">
      <Label htmlFor="theme-mode">Tema</Label>
      <select
        id="theme-mode"
        value={mode}
        onChange={(event) => setMode(event.target.value as ThemeMode)}
        className="border-input bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm focus-visible:outline-ring"
      >
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
        <option value="system">Sistema / Automático</option>
      </select>
      <p className="text-muted-foreground text-xs">
        Salvo neste dispositivo. Automático acompanha o tema do sistema.
      </p>
    </div>
  );
}
