import { useEffect, useRef, useState } from "react";
import { ServerRail } from "@/components/app/ServerRail";
import {
  ServerAccessDialogView,
  type ServerAccessMode,
} from "@/components/app/ServerAccessDialogView";
import { DEFAULT_SERVER_PREFERENCES } from "@/hooks/use-server-preferences";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { Server } from "@/types";
const stamp = "2026-10-22T00:00:00Z";
function fixture(id: string, name: string): Server {
  return {
    id,
    owner_id: "preview-owner",
    name,
    description: "Servidor fictício da prévia local.",
    icon_url: null,
    banner_url: null,
    visibility: "private",
    created_at: stamp,
    updated_at: stamp,
    interactions: {
      allow_messages: true,
      allow_reactions: true,
      allow_mentions: true,
      allow_member_invites: false,
      allow_member_dms: true,
    },
  };
}
export function ServerAccessPreview() {
  const [servers, setServers] = useState(() => [
      fixture("squad", "Meu squad"),
      fixture("study", "Sala de estudos"),
      fixture("friends", "Amigos"),
    ]),
    [active, setActive] = useState<string | null>("squad"),
    [open, setOpen] = useState(false),
    [mode, setMode] = useState<ServerAccessMode>("create"),
    [message, setMessage] = useState("");
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const show = (next: ServerAccessMode) => {
    setMode(next);
    setOpen(true);
  };
  return (
    <TooltipProvider delayDuration={150}>
      <section className="p-4 md:p-6">
        <h2 className="text-xl font-semibold">Criar ou entrar em servidor</h2>
        <p className="mt-2 mb-4 text-xs leading-relaxed text-muted-foreground">
          PRÉVIA LOCAL · lista, convites e ações fictícios. Usa a barra e o modal reais. Ícones
          ficam na memória; nenhum upload, servidor ou ingresso real é executado.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setServers(
                Array.from({ length: 20 }, (_, i) => fixture(`extra-${i}`, `Servidor ${i + 1}`)),
              )
            }
          >
            Lista com 20 servidores
          </Button>
          <Button variant="outline" onClick={() => setServers([])}>
            Lista vazia
          </Button>
          <Button variant="outline" onClick={() => show("join")}>
            Testar entrada por convite
          </Button>
        </div>
        {message && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-border p-3 text-sm text-primary"
          >
            {message}
          </p>
        )}
        <div className="flex h-[580px] max-h-[70dvh] overflow-hidden rounded-2xl border border-border">
          <ServerRail
            servers={servers}
            activeServerId={active}
            onSelect={setActive}
            onHome={() => setActive(null)}
            onAdd={() => show("create")}
            socialActive={false}
            onSelectSocial={() => setMessage("A Central Social permanece inalterada.")}
            getPreferences={() => DEFAULT_SERVER_PREFERENCES}
            onUpdatePreferences={() => {}}
            onServerAction={() => setMessage("Menu real; ação somente ilustrativa nesta prévia.")}
          />
          <div className="flex min-w-0 flex-1 items-center justify-center bg-background p-6">
            <div className="max-w-md space-y-4">
              <span className="text-xs uppercase tracking-widest text-primary">
                Seu próximo ponto de encontro
              </span>
              <h3 className="text-2xl font-semibold">Seu squad começa aqui.</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                O novo botão fica logo depois do último servidor, dentro da mesma área de rolagem.
                Adicione um servidor fictício para ver a posição acompanhar a lista.
              </p>
              <Button onClick={() => show("create")}>Criar ou entrar em servidor</Button>
              <p className="text-xs text-muted-foreground">
                Convite de demonstração: <code>lobbyx-demo</code>. Use outro código para ver o erro.
              </p>
            </div>
          </div>
        </div>
        {open && (
          <ServerAccessDialogView
            open
            initialMode={mode}
            onOpenChange={setOpen}
            onCreate={async (draft) => {
              const id = crypto.randomUUID();
              let icon: string | null = null;
              if (draft.iconFile) {
                icon = URL.createObjectURL(draft.iconFile);
                urls.current.push(icon);
              }
              setServers((v) => [
                ...v,
                {
                  ...fixture(id, draft.name),
                  description: draft.description,
                  visibility: draft.visibility,
                  icon_url: icon,
                },
              ]);
              setActive(id);
              setMessage(
                `Servidor fictício “${draft.name}” criado apenas nesta prévia. Categoria: ${draft.theme}.`,
              );
            }}
            onJoin={async (code) => {
              if (code !== "lobbyx-demo")
                throw Error("Convite fictício inválido. Use lobbyx-demo nesta prévia.");
              setServers((v) =>
                v.some((s) => s.id === "demo")
                  ? v
                  : [...v, fixture("demo", "Órbita · convite fictício")],
              );
              setActive("demo");
              setMessage("Entrada concluída somente na lista fictícia.");
            }}
            onPreview={async (code) =>
              code === "lobbyx-demo"
                ? {
                    server_id: "demo",
                    server_name: "Órbita · convite fictício",
                    server_description: "Um espaço fictício para testar o novo fluxo.",
                    server_icon_url: null,
                    server_banner_url: null,
                    member_count: 0,
                    already_member: servers.some((s) => s.id === "demo"),
                    valid: true,
                    reason: "",
                  }
                : null
            }
          />
        )}
      </section>
    </TooltipProvider>
  );
}
