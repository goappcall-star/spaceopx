import { Plus } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function ServerAccessButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label="Criar ou entrar em servidor"
          className="border-border text-primary hover:border-primary/60 hover:bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-dashed transition-all duration-200 hover:rounded-xl"
        >
          <Plus className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12} className="max-w-52 space-y-1 rounded-xl p-3">
        <strong className="block">Seu próximo ponto de encontro</strong>
        <span className="block text-[11px] leading-relaxed text-muted-foreground">
          Crie um servidor ou entre com um convite.
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
