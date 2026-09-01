import { Globe, Lock } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAdminMutation } from "@/hooks/use-server-admin";
import { serversService } from "@/services/servers";
import type { Server, ServerInteractions, ServerVisibility } from "@/types";

const INTERACTION_ITEMS: { key: keyof ServerInteractions; label: string; hint: string }[] = [
  {
    key: "allow_messages",
    label: "Mensagens de membros",
    hint: "Permite que membros escrevam nos canais de texto.",
  },
  { key: "allow_reactions", label: "Reações", hint: "Permite reagir às mensagens com emojis." },
  { key: "allow_mentions", label: "Menções", hint: "Permite mencionar membros e cargos." },
  {
    key: "allow_member_invites",
    label: "Convites por membros",
    hint: "Membros comuns podem gerar links de convite.",
  },
  {
    key: "allow_member_dms",
    label: "Mensagens privadas",
    hint: "Membros podem se chamar na DM a partir deste servidor.",
  },
];

export function SettingsAccess({ server, readOnly }: { server: Server; readOnly: boolean }) {
  const save = useAdminMutation(
    (patch: Partial<Server> & { interactions?: ServerInteractions }) =>
      serversService.update(server.id, patch),
    { success: "Configuração salva.", invalidate: [["servers"], ["audit-logs", server.id]] },
  );

  const options: { value: ServerVisibility; icon: typeof Globe; title: string; text: string }[] = [
    {
      value: "private",
      icon: Lock,
      title: "Privado",
      text: "Somente quem tem um link de convite pode entrar.",
    },
    {
      value: "public",
      icon: Globe,
      title: "Público",
      text: "O servidor pode aparecer em listagens públicas futuras.",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Visibilidade</h3>
          <p className="text-muted-foreground text-xs">
            Define como novas pessoas podem descobrir o servidor.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const active = server.visibility === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={readOnly || save.isPending}
                onClick={() => save.mutate({ visibility: option.value })}
                className={cn(
                  "border-border bg-surface rounded-xl border p-4 text-left transition-all",
                  active
                    ? "border-primary/60 glow-soft bg-surface-elevated"
                    : "hover:bg-surface-hover",
                  readOnly && "opacity-60",
                )}
              >
                <option.icon
                  className={cn("mb-2 h-5 w-5", active ? "text-primary" : "text-muted-foreground")}
                />
                <p className="text-sm font-semibold">{option.title}</p>
                <p className="text-muted-foreground text-xs">{option.text}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Interações</h3>
          <p className="text-muted-foreground text-xs">
            Controles gerais de participação da comunidade.
          </p>
        </div>
        <ul className="border-border divide-border bg-surface divide-y rounded-xl border">
          {INTERACTION_ITEMS.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-4 p-3.5">
              <div className="min-w-0">
                <Label className="text-sm">{item.label}</Label>
                <p className="text-muted-foreground text-xs">{item.hint}</p>
              </div>
              <Switch
                checked={server.interactions[item.key]}
                disabled={readOnly || save.isPending}
                onCheckedChange={(checked) =>
                  save.mutate({ interactions: { ...server.interactions, [item.key]: checked } })
                }
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
