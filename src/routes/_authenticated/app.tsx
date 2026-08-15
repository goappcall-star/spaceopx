import { createFileRoute } from "@tanstack/react-router";
import { Hash, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { ChannelSidebar } from "@/components/app/ChannelSidebar";
import { CreateServerDialog } from "@/components/app/CreateServerDialog";
import { InviteDialog } from "@/components/app/InviteDialog";
import { JoinServerDialog } from "@/components/app/JoinServerDialog";
import { MemberPanel } from "@/components/app/MemberPanel";
import { ServerRail } from "@/components/app/ServerRail";
import { UserBar } from "@/components/app/UserBar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import {
  useMyServers,
  useServerChannels,
  useServerMembers,
  useServerPermissions,
} from "@/hooks/use-servers";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Seus servidores — SecureChat" },
      {
        name: "description",
        content: "Navegue pelos seus servidores, canais e membros no SecureChat.",
      },
      { property: "og:title", content: "Seus servidores — SecureChat" },
      { property: "og:description", content: "Navegue pelos seus servidores, canais e membros." },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const { user } = useAuth();
  const { data: servers = [], isLoading: loadingServers } = useMyServers();
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const activeServer = servers.find((s) => s.id === activeServerId) ?? null;
  const { data: channels = [] } = useServerChannels(activeServer?.id ?? null);
  const { data: members = [], isLoading: loadingMembers } = useServerMembers(
    activeServer?.id ?? null,
  );
  const { canManage } = useServerPermissions(members, user?.id);

  useEffect(() => {
    if (activeServerId && !servers.some((s) => s.id === activeServerId)) {
      setActiveServerId(null);
    }
  }, [servers, activeServerId]);

  useEffect(() => {
    if (channels.length === 0) {
      setActiveChannelId(null);
      return;
    }
    if (!channels.some((c) => c.id === activeChannelId)) {
      setActiveChannelId(channels[0]?.id ?? null);
    }
  }, [channels, activeChannelId]);

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-background flex h-screen overflow-hidden">
        <ServerRail
          servers={servers}
          activeServerId={activeServerId}
          onSelect={setActiveServerId}
          onAdd={() => setCreateOpen(true)}
        />

        {activeServer ? (
          <ChannelSidebar
            server={activeServer}
            channels={channels}
            activeChannelId={activeChannelId}
            onSelectChannel={setActiveChannelId}
            canInvite={canManage}
            onInvite={() => setInviteOpen(true)}
          />
        ) : (
          <aside className="bg-surface border-border flex w-60 shrink-0 flex-col border-r">
            <div className="border-border border-b p-4">
              <h2 className="text-sm font-semibold">Nenhum servidor aberto</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Selecione um servidor à esquerda.
              </p>
            </div>
            <div className="flex-1" />
            <UserBar />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          {activeServer ? (
            <>
              <header className="border-border bg-background flex h-14 shrink-0 items-center gap-2 border-b px-5">
                <Hash className="text-muted-foreground h-4 w-4" />
                <h1 className="text-sm font-semibold">{activeChannel?.name ?? "geral"}</h1>
                {activeChannel?.description && (
                  <>
                    <span className="bg-border h-4 w-px" />
                    <p className="text-muted-foreground truncate text-xs">
                      {activeChannel.description}
                    </p>
                  </>
                )}
              </header>
              <div className="bg-hero-glow flex flex-1 items-center justify-center p-8">
                <div className="max-w-md text-center">
                  <span className="bg-surface border-border mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border">
                    <Hash className="text-primary h-6 w-6" />
                  </span>
                  <h2 className="text-xl font-semibold">Canal #{activeChannel?.name ?? "geral"}</h2>
                  <p className="text-muted-foreground mt-2 text-sm">
                    A fundação do servidor está pronta. O envio de mensagens e o monitoramento
                    inteligente chegam nas próximas etapas.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-hero-glow flex flex-1 items-center justify-center p-8">
              <div className="max-w-md text-center">
                <span className="bg-surface border-border mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border">
                  <ShieldCheck className="text-primary h-7 w-7" />
                </span>
                <h1 className="text-2xl font-semibold">Bem-vindo ao SecureChat</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  Escolha um servidor ou crie seu primeiro servidor.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button onClick={() => setCreateOpen(true)}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Criar servidor
                  </Button>
                  <Button variant="secondary" onClick={() => setJoinOpen(true)}>
                    Entrar com convite
                  </Button>
                </div>
                {loadingServers && (
                  <p className="text-muted-foreground mt-6 text-xs">Carregando seus servidores...</p>
                )}
              </div>
            </div>
          )}
        </main>

        {activeServer && <MemberPanel members={members} loading={loadingMembers} />}
      </div>

      <CreateServerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(serverId) => setActiveServerId(serverId)}
      />
      <JoinServerDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onJoined={(serverId) => setActiveServerId(serverId)}
      />
      {activeServer && (
        <InviteDialog serverId={activeServer.id} open={inviteOpen} onOpenChange={setInviteOpen} />
      )}
    </TooltipProvider>
  );
}
