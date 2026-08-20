import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { STATUS_LABEL, StatusDot } from "@/components/app/StatusDot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { profilesService } from "@/services/profiles";
import type { UserStatus } from "@/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configurações do perfil — LobbyX" },
      {
        name: "description",
        content: "Atualize seu nome de exibição, avatar e status no LobbyX.",
      },
      { property: "og:title", content: "Configurações do perfil — LobbyX" },
      { property: "og:description", content: "Atualize seu perfil no LobbyX." },
    ],
  }),
  component: SettingsPage,
});

const STATUSES: UserStatus[] = ["online", "idle", "offline"];

function SettingsPage() {
  const { profile, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    display_name: "",
    avatar_url: "",
    status: "online" as UserStatus,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name,
        avatar_url: profile.avatar_url ?? "",
        status: profile.status,
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      profilesService.update(user!.id, {
        display_name: form.display_name,
        avatar_url: form.avatar_url,
        status: form.status,
      }),
    onSuccess: async () => {
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Perfil atualizado.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("username_is_permanent")
          ? "Seu username é permanente e não pode ser alterado."
          : "Não foi possível salvar o perfil.",
      );
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.display_name.trim()) {
      toast.error("Informe um nome de exibição.");
      return;
    }
    mutation.mutate();
  }

  return (
    <main className="bg-hero-glow min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/app">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o app
          </Link>
        </Button>

        <h1 className="text-2xl font-semibold">Perfil e configurações</h1>
        <Button asChild variant="secondary" size="sm" className="mt-3">
          <Link to="/settings/profile">Abrir perfil gamer</Link>
        </Button>
        <p className="text-muted-foreground mt-1 text-sm">
          Dados internos como identificador da conta não podem ser alterados.
        </p>

        <div className="panel mt-6 p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage src={form.avatar_url || undefined} alt="" />
                <AvatarFallback className="bg-secondary">
                  {form.display_name.slice(0, 2).toUpperCase() || "??"}
                </AvatarFallback>
              </Avatar>
              <StatusDot
                status={form.status}
                className="border-surface absolute right-0 bottom-0 h-4 w-4 border-2"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-medium">{profile?.display_name}</p>
              <p className="text-muted-foreground truncate font-mono text-sm">
                @{profile?.username}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Conta criada em{" "}
                {profile ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"} ·{" "}
                {STATUS_LABEL[profile?.status ?? "offline"]}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="display_name">Nome de exibição</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <div className="border-border bg-surface-elevated rounded-md border px-3 py-2">
                <p className="font-mono text-sm">@{profile?.username}</p>
              </div>
              <p className="text-muted-foreground text-xs">Seu username é permanente.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar_url">Avatar (URL)</Label>
              <Input
                id="avatar_url"
                value={form.avatar_url}
                onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((f) => ({ ...f, status: value as UserStatus }))}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
