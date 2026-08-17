import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ChannelSidebar } from "@/components/app/ChannelSidebar";
import { CreateChannelDialog } from "@/components/app/CreateChannelDialog";
import { CreateServerDialog } from "@/components/app/CreateServerDialog";
import { InviteDialog } from "@/components/app/InviteDialog";
import { JoinServerDialog } from "@/components/app/JoinServerDialog";
import { MemberPanel } from "@/components/app/MemberPanel";
import { ServerRail } from "@/components/app/ServerRail";
import { UserBar } from "@/components/app/UserBar";
import { ChatView } from "@/components/chat/ChatView";
import { VoiceRoom } from "@/components/voice/VoiceRoom";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useServerPresence } from "@/hooks/use-presence";
import {
  useMyServers,
  useServerChannels,
  useServerMembers,
  useServerPermissions,
} from "@/hooks/use-servers";
import { VoiceProviderRoot } from "@/hooks/use-voice";
import { ProfileDialogProvider } from "@/components/gamer/ProfileDialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Seus servidores — SecureChat" },
      {
        name: "description",
        content: "Converse por texto e voz em tempo real nos seus servidores do SecureChat.",
      },
      { property: "og:title", content: "Seus servidores — SecureChat" },
      {
        property: "og:description",
        content: "Chat em tempo real, canais de voz e presença ao vivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const { user, profile } = useAuth();
  const { data: servers = [], isLoading: loadingServers } = useMyServers();
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [unread, setUnread] = useState<Set<string>>(new Set());

  const activeServer = servers.find((s) => s.id === activeServerId) ?? null;
  const { data: channels = [] } = useServerChannels(activeServer?.id ?? null);
  const { data: members = [], isLoading: loadingMembers } = useServerMembers(
    activeServer?.id ?? null,
  );
  const { me, canManage } = useServerPermissions(members, user?.id);
  const presence = useServerPresence(
    activeServer?.id ?? null,
    user?.id,
    profile?.status ?? "online",
  );

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
      setActiveChannelId(channels.find((c) => c.type !== "voice")?.id ?? channels[0]?.id ?? null);
    }
  }, [channels, activeChannelId]);

  // Server-wide unread badges: any insert outside the open channel marks it.
  useEffect(() => {
    if (!activeServer || channels.length === 0 || !user?.id) return;
    const ids = new Set(channels.map((c) => c.id));
    const realtime = supabase
      .channel(`unread:${activeServer.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as { channel_id: string; author_id: string };
        if (!ids.has(row.channel_id)) return;
        if (row.author_id === user.id || row.channel_id === activeChannelId) return;
        setUnread((prev) => new Set(prev).add(row.channel_id));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(realtime);
    };
  }, [activeServer, channels, activeChannelId, user?.id]);

  const handleRead = useCallback((channelId: string) => {
    setUnread((prev) => {
      if (!prev.has(channelId)) return prev;
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });
  }, []);

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  return (
    <VoiceProviderRoot serverId={activeServer?.id ?? null} userId={user?.id}>
      <TooltipProvider delayDuration={200}>
        <ProfileDialogProvider>
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
              members={members}
              unreadChannelIds={unread}
              canInvite={canManage}
              canManage={canManage}
              onInvite={() => setInviteOpen(true)}
              onCreateChannel={() => setChannelOpen(true)}
            />
          ) : (
            <aside className="bg-surface border-border relative z-20 flex w-64 shrink-0 flex-col border-r">
              <div className="border-border relative overflow-hidden border-b px-4 py-3.5">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{ backgroundImage: "var(--gradient-ambient)" }}
                />
                <h2 className="relative text-sm font-semibold tracking-tight">
                  Nenhum servidor aberto
                </h2>
                <p className="text-muted-foreground relative mt-0.5 text-xs">
                  Selecione um servidor à esquerda.
                </p>
              </div>
              <div className="flex-1" />
              <UserBar />
            </aside>
          )}


          <main className="flex min-w-0 flex-1 flex-col">
            {activeServer && activeChannel ? (
              activeChannel.type === "voice" ? (
                <VoiceRoom
                  channel={activeChannel}
                  members={members}
                  me={me}
                  userId={user?.id}
                />
              ) : (
                <ChatView
                  key={activeChannel.id}
                  serverId={activeServer.id}
                  channel={activeChannel}
                  members={members}
                  userId={user?.id}
                  me={me}
                  onRead={handleRead}
                />
              )
            ) : (
              <div className="bg-ambient relative flex flex-1 items-center justify-center overflow-hidden p-8">
                <span
                  aria-hidden
                  className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]"
                />
                <span
                  aria-hidden
                  className="border-primary/15 pointer-events-none absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[80px] border"
                />
                <span
                  aria-hidden
                  className="border-primary/10 pointer-events-none absolute top-1/2 left-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-[120px] border"
                />

                <div className="animate-fade-up relative max-w-lg text-center">
                  <span className="surface-elevated glow-soft mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl">
                    <ShieldCheck className="text-primary h-9 w-9" strokeWidth={1.9} />
                  </span>
                  <p className="text-caption mb-3">Plataforma de comunicação segura</p>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Bem-vindo ao <span className="text-brand-gradient">SecureChat</span>
                  </h1>
                  <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm">
                    Escolha um servidor na barra lateral, crie o seu próprio espaço ou entre com um
                    convite.
                  </p>
                  <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <Button size="lg" onClick={() => setCreateOpen(true)}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Criar servidor
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => setJoinOpen(true)}>
                      Entrar com convite
                    </Button>
                  </div>

                  <div className="text-muted-foreground mt-10 grid grid-cols-3 gap-3 text-xs">
                    {[
                      { label: "Servidores", value: servers.length },
                      { label: "Texto + Voz", value: "Tempo real" },
                      { label: "Isolamento", value: "RLS" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="border-border/70 bg-surface/50 rounded-xl border px-3 py-2.5 backdrop-blur-sm"
                      >
                        <p className="text-foreground text-sm font-semibold">{stat.value}</p>
                        <p className="mt-0.5 text-[11px]">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {loadingServers && (
                    <p className="text-muted-foreground mt-6 text-xs">
                      Carregando seus servidores...
                    </p>
                  )}
                </div>
              </div>
            )}

          </main>

          {activeServer && (
            <MemberPanel members={members} loading={loadingMembers} presence={presence} />
          )}
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
          <>
            <InviteDialog
              serverId={activeServer.id}
              open={inviteOpen}
              onOpenChange={setInviteOpen}
            />
            <CreateChannelDialog
              serverId={activeServer.id}
              open={channelOpen}
              onOpenChange={setChannelOpen}
              onCreated={(channelId) => setActiveChannelId(channelId)}
            />
          </>
        )}
        </ProfileDialogProvider>
      </TooltipProvider>
    </VoiceProviderRoot>
  );
}
