import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Shield, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAdminMutation, useServerRoles } from "@/hooks/use-server-admin";
import { PERMISSION_CATALOG, PERMISSION_GROUPS } from "@/services/permissions";
import { serverAdminService } from "@/services/server-admin";
import { roleLabel } from "@/services/roles";
import type { Role, RolePermissions, Server } from "@/types";

const COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#f87171", "#8b95a5"];

export function SettingsRoles({ server, readOnly }: { server: Server; readOnly: boolean }) {
  const { data: roles } = useServerRoles(server.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(() => [...(roles ?? [])].sort((a, b) => b.position - a.position), [roles]);
  const selected = sorted.find((r) => r.id === selectedId) ?? sorted[0] ?? null;
  const invalidate = [["roles", server.id], ["members", server.id], ["audit-logs", server.id]];

  const createRole = useAdminMutation(
    () =>
      serverAdminService.createRole(server.id, {
        name: "Novo cargo",
        color: "#8b95a5",
        permissions: { read_messages: true, send_messages: true },
        position: (sorted[0]?.position ?? 10) - 1 > 0 ? (sorted[0]?.position ?? 10) - 1 : 5,
      }),
    { success: "Cargo criado.", invalidate },
  );

  const updateRole = useAdminMutation(
    (vars: { id: string; patch: Parameters<typeof serverAdminService.updateRole>[1] }) =>
      serverAdminService.updateRole(vars.id, vars.patch),
    { success: "Cargo atualizado.", invalidate },
  );

  const deleteRole = useAdminMutation((id: string) => serverAdminService.deleteRole(id), {
    success: "Cargo excluído.",
    invalidate,
  });

  const swap = useAdminMutation(
    (vars: { a: Role; b: Role }) => serverAdminService.swapRolePositions(vars.a, vars.b),
    { success: "Ordem atualizada.", invalidate },
  );

  function togglePermission(role: Role, key: string, value: boolean) {
    const permissions: RolePermissions = { ...role.permissions, [key]: value };
    updateRole.mutate({ id: role.id, patch: { permissions } });
  }

  const locked = readOnly || selected?.name === "OWNER";

  return (
    <div className="grid gap-5 md:grid-cols-[220px_1fr]">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cargos</h3>
          {!readOnly && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Criar cargo"
              disabled={createRole.isPending}
              onClick={() => createRole.mutate(undefined as never)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <ul className="space-y-1">
          {sorted.map((role, index) => (
            <li key={role.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedId(role.id)}
                className={cn(
                  "hover:bg-surface-hover flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  selected?.id === role.id && "bg-surface-elevated",
                )}
              >
                <Shield className="h-3.5 w-3.5 shrink-0" style={{ color: role.color }} />
                <span className="truncate">{roleLabel(role.name)}</span>
              </button>
              {!readOnly && (
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="Mover para cima"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={index === 0 || swap.isPending}
                    onClick={() => {
                      const other = sorted[index - 1];
                      if (other) swap.mutate({ a: role, b: other });
                    }}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Mover para baixo"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={index === sorted.length - 1 || swap.isPending}
                    onClick={() => {
                      const other = sorted[index + 1];
                      if (other) swap.mutate({ a: role, b: other });
                    }}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                key={selected.id}
                defaultValue={selected.name}
                disabled={locked}
                maxLength={32}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== selected.name)
                    updateRole.mutate({ id: selected.id, patch: { name: value } });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Cor ${color}`}
                    disabled={locked}
                    onClick={() => updateRole.mutate({ id: selected.id, patch: { color } })}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform",
                      selected.color === color
                        ? "border-foreground scale-110"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group} className="space-y-2">
                <p className="text-caption">{group}</p>
                <ul className="border-border divide-border bg-surface divide-y rounded-xl border">
                  {PERMISSION_CATALOG.filter((p) => p.group === group).map((perm) => (
                    <li key={perm.key} className="flex items-center justify-between gap-4 p-3">
                      <div className="min-w-0">
                        <Label className="text-sm">{perm.label}</Label>
                        <p className="text-muted-foreground text-xs">{perm.description}</p>
                      </div>
                      <Switch
                        checked={Boolean(selected.permissions[perm.key])}
                        disabled={locked}
                        onCheckedChange={(checked) =>
                          togglePermission(selected, perm.key, checked)
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {!locked && selected.name !== "MEMBER" && (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={deleteRole.isPending}
              onClick={() => {
                deleteRole.mutate(selected.id);
                setSelectedId(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Excluir cargo
            </Button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Nenhum cargo encontrado.</p>
      )}
    </div>
  );
}
