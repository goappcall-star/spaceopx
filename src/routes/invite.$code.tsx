import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { inviteErrorMessage, invitesService } from "@/services/invites";

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

function InvitePage() {
  const { code } = useParams({ from: "/invite/$code" });
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: preview, isLoading } = useQuery({
    queryKey: ["invite-preview", code],
    queryFn: () => invitesService.preview(code),
    enabled: isAuthenticated,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => invitesService.join(code),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Você entrou no servidor.");
      await navigate({ to: "/app", replace: true });
    },
    onError: (error) => toast.error(inviteErrorMessage(error)),
  });

  if (loading) {
    return (
      <AuthShell title="Convite" subtitle="Verificando seu acesso...">
        <p className="text-muted-foreground text-sm">Um instante.</p>
      </AuthShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthShell
        title="Você foi convidado"
        subtitle="Entre na sua conta para aceitar o convite."
        footer={
          <Link to="/register" className="text-primary font-medium hover:underline">
            Criar uma conta
          </Link>
        }
      >
        <Button asChild className="w-full">
          <Link to="/login" search={{ redirect: `/invite/${code}` }}>
            Entrar para continuar
          </Link>
        </Button>
      </AuthShell>
    );
  }

  if (isLoading) {
    return (
      <AuthShell title="Convite" subtitle="Carregando informações do servidor...">
        <p className="text-muted-foreground text-sm">Um instante.</p>
      </AuthShell>
    );
  }

  if (!preview || !preview.valid) {
    return (
      <AuthShell
        title="Convite indisponível"
        subtitle={inviteErrorMessage(new Error(preview?.reason ?? "invite_not_found"))}
        footer={
          <Link to="/app" className="text-primary font-medium hover:underline">
            Ir para o app
          </Link>
        }
      >
        <p className="text-muted-foreground text-sm">
          Peça um novo link para quem administra o servidor.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={preview.server_name ?? "Servidor"}
      subtitle={`${preview.member_count} membro(s) · convite válido`}
      footer={
        <Link to="/app" className="text-primary font-medium hover:underline">
          Voltar para o app
        </Link>
      }
    >
      <div className="border-border bg-surface mb-5 flex items-center gap-3 rounded-xl border p-3">
        <Avatar className="ring-border h-12 w-12 rounded-2xl ring-1">
          <AvatarImage src={preview.server_icon_url ?? undefined} alt="" />
          <AvatarFallback className="bg-surface-elevated rounded-2xl text-sm">
            {(preview.server_name ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{preview.server_name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {preview.member_count} membro(s) online na comunidade
          </p>
        </div>
      </div>
      {preview.server_description && (
        <p className="text-muted-foreground mb-5 text-sm">{preview.server_description}</p>
      )}
      {preview.already_member ? (
        <Button asChild className="w-full">
          <Link to="/app">Você já é membro — abrir app</Link>
        </Button>
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
