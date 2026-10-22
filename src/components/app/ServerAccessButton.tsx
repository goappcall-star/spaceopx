import { UsersRound, Link2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function ServerAccessButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label="Criar ou entrar em servidor"
          className="group relative mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-300/40 bg-lime-300/5 text-lime-300 transition-colors hover:border-lime-300 hover:bg-lime-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
        >
          <UsersRound className="h-5 w-5" />
          <span className="absolute right-1 bottom-1 rounded-md bg-surface p-0.5 text-primary">
            <Link2 className="h-3 w-3" />
          </span>
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
