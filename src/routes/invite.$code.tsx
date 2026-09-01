import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { invitesService } from "@/services/invites";

export const Route = createFileRoute("/invite/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite — LobbyX" },
      { name: "description", content: "Você foi convidado para um servidor no LobbyX." },
      { property: "og:title", content: "Convite — LobbyX" },
      { property: "og:description", content: "Você foi convidado para um servidor no LobbyX." },
    ],
  }),
  component: InvitePage,
});

/** Human copy for every invalid-invite reason returned by the backend. */
const INVALID_STATES: Record<string, { emoji: string; title: string; text: string }> = {
  invite_not_found: {
    emoji: "🔗",
    title: "Convite inválido",
    text: "Este convite não existe ou não está mais disponível.",
  },
  invite_expired: {
    emoji: "⏰",
    title: "Convite expirado",
    text: "Este convite não está mais disponível.",
  },
  invite_exhausted: {
    emoji: "🚫",
    title: "Convite esgotado",
    text: "Este convite atingiu o limite de usos.",
  },
  server_not_found: {
    emoji: "👻",
    title: "Servidor indisponível",
    text: "Este servidor não está mais disponível.",
  },
  user_banned: {
    emoji: "⛔",
    title: "Acesso não permitido",
    text: "Você não pode entrar neste servidor.",
  },
};

function InvitePage() {
  const { code } = useParams({ from: "/invite/$code" });
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const destination = `/invite/${code}`;

  // Preview works signed-out too — the token lives in the URL, never in state.
  const {
    data: preview,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invite-preview", code, isAuthenticated],
    queryFn: () => invitesService.preview(code),
    enabled: !loading,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => invitesService.join(code),
    onSuccess: async (serverId) => {
      await queryClient.invalidateQueries();
      toast.success("Você entrou no servidor.");
      await navigate({ to: "/app", search: { server: serverId }, replace: true });
    },
    onError: (error) => {
      const raw = error instanceof Error ? error.message : "";
      const key = Object.keys(INVALID_STATES).find((k) => raw.includes(k));
      toast.error(
        key ? INVALID_STATES[key]!.text : "Não foi possível entrar no servidor. Tente novamente.",
      );
      void queryClient.invalidateQueries({ queryKey: ["invite-preview", code] });
    },
  });

  if (loading || isLoading) {
    return (
      <AuthShell title="Convite" subtitle="Carregando informações do servidor...">
        <div className="border-border bg-surface h-20 animate-pulse rounded-xl border" />
      </AuthShell>
    );
  }

  if (isError || !preview) {
    const state = INVALID_STATES['invite_not_found']!;
    return <InvalidState {...state} />;
  }

  if (!preview.valid) {
    const state = INVALID_STATES[preview.reason ?? "invite_not_found"] ?? INVALID_STATES['invite_not_found']!;
    return <InvalidState {...state} />;
  }

  return (
    <AuthShell
      title="Você foi convidado"
      subtitle="Confira o servidor antes de entrar."
      footer={
        <Link to="/" className="text-muted-foreground hover:text-primary">
          Voltar para a home
        </Link>
      }
    >
      {preview.server_banner_url && (
        <div
          className="border-border mb-3 h-28 w-full overflow-hidden rounded-xl border bg-cover bg-center"
          style={{ backgroundImage: `url(${preview.server_banner_url})` }}
          aria-hidden
        />
      )}
      <div className="border-border bg-surface mb-5 flex items-center gap-3 rounded-xl border p-3">

        <Avatar className="ring-border h-14 w-14 rounded-2xl ring-1">
          <AvatarImage src={preview.server_icon_url ?? undefined} alt="" />
          <AvatarFallback className="bg-surface-elevated rounded-2xl text-sm">
            {(preview.server_name ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{preview.server_name}</p>
          {preview.server_description && (
            <p className="text-muted-foreground truncate text-xs">{preview.server_description}</p>
          )}
          <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            {Number(preview.member_count ?? 0).toLocaleString("pt-BR")} membros
          </p>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="space-y-2">
          <Button asChild className="w-full">
            <Link to="/login" search={{ redirect: destination }}>
              Entrar para continuar
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/register" search={{ redirect: destination }}>
              Criar uma conta
            </Link>
          </Button>
        </div>
      ) : preview.already_member ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">Você já faz parte deste servidor.</p>
          <Button asChild className="w-full">
            <Link to="/app" search={{ server: preview.server_id ?? undefined }}>
              Abrir servidor
            </Link>
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          onClick={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
        >
          {joinMutation.isPending ? "Entrando..." : "Entrar no servidor"}
        </Button>
      )}
    </AuthShell>
  );
}

function InvalidState({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <AuthShell title={`${emoji} ${title}`} subtitle={text}>
      <Button asChild variant="outline" className="w-full">
        <Link to="/">Voltar</Link>
      </Button>
    </AuthShell>
  );
}
