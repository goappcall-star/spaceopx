import { useVisualQuality, setVisualQuality } from "@/hooks/use-visual-quality";
import type { VisualQuality } from "@/lib/visual-quality";
export function PerformanceSettings() {
  const quality = useVisualQuality();
  return (
    <div className="space-y-3 border-t border-border pt-5">
      <h3 className="font-semibold">Desempenho</h3>
      <label className="flex items-center justify-between gap-4 text-sm">
        Modo Desempenho
        <input
          type="checkbox"
          checked={quality !== "normal"}
          onChange={(e) => setVisualQuality(e.target.checked ? "optimized" : "normal")}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Reduz efeitos visuais e animações para melhorar o desempenho em computadores mais fracos.
      </p>
      <label htmlFor="visual-quality" className="text-sm">
        Nível visual
      </label>
      <select
        id="visual-quality"
        value={quality}
        onChange={(e) => setVisualQuality(e.target.value as VisualQuality)}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
      >
        <option value="normal">Normal</option>
        <option value="optimized">Otimizado</option>
        <option value="maximum">Desempenho Máximo</option>
      </select>
      <p className="text-xs text-muted-foreground">
        Otimizado congela molduras e reduz blur e brilhos. Máximo também elimina transições e
        animações da interface. Áudio e transmissão mantêm a qualidade.
      </p>
      <p className="text-xs text-muted-foreground">
        Salvo somente neste dispositivo/navegador. Sem escolha anterior, a redução de movimento do
        sistema ativa Otimizado. As preferências de personalização são preservadas.
      </p>
    </div>
  );
}
