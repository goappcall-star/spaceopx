import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Gamepad2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ChannelSidebar } from "@/components/app/ChannelSidebar";
import { CreateChannelDialog } from "@/components/app/CreateChannelDialog";
import { CreateServerDialog } from "@/components/app/CreateServerDialog";
import { InviteDialog } from "@/components/app/InviteDialog";
import { JoinServerDialog } from "@/components/app/JoinServerDialog";
import { MemberPanel } from "@/components/app/MemberPanel";
import { ServerRail } from "@/components/app/ServerRail";
import { UserBar } from "@/components/app/UserBar";
import { CallOverlay } from "@/components/call/CallOverlay";
import { IncomingCallDialog } from "@/components/call/IncomingCallDialog";
import { ChatView } from "@/components/chat/ChatView";
import { RemoteAudio } from "@/components/voice/RemoteAudio";
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
import { CallProviderRoot } from "@/hooks/use-call";
import { VoiceProviderRoot } from "@/hooks/use-voice";
import { ProfileDialogProvider, useProfileDialog } from "@/components/gamer/ProfileDialog";
import { DirectChatView } from "@/components/social/DirectChatView";
import { SocialHome } from "@/components/social/SocialHome";
import { SocialSidebar, type SocialTab } from "@/components/social/SocialSidebar";
import { useConversations, useFriends } from "@/hooks/use-social";
import type { ConversationOverview, FriendEntry, FriendRequestEntry } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: z.object({ server: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Seus lobbies — LobbyX" },
      {
        name: "description",
        content: "Converse por texto, voz e vídeo em tempo real nas suas comunidades do LobbyX.",
      },
      { property: "og:title", content: "Seus lobbies — LobbyX" },
      {
        property: "og:description",
        content: "Chat em tempo real, voz, vídeo, screen share e presença ao vivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const { user, profile } = useAuth();
  const { server: serverParam } = useSearch({ from: "/_authenticated/app" });
  const { data: servers = [], isLoading: loadingServers } = useMyServers();
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"servers" | "social">("servers");
  const [socialTab, setSocialTab] = useState<SocialTab>("friends");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const { friends, requests } = useFriends(user?.id);
  const { conversations, totalUnread } = useConversations(user?.id);
  const pendingRequests = requests.filter((r) => r.direction === "incoming").length;
  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  function openConversation(conversationId: string) {
    setView("social");
    setActiveConversationId(conversationId);
  }

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

  // Deep link (?server=...) — e.g. right after accepting an invite.
  useEffect(() => {
    if (!serverParam) return;
    if (!servers.some((s) => s.id === serverParam)) return;
    setView("servers");
    setActiveServerId((current) => current ?? serverParam);
  }, [serverParam, servers]);

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
      <RemoteAudio />
      <TooltipProvider delayDuration={200}>
        <CallProviderRoot userId={user?.id} profile={profile}>
        <IncomingCallDialog />
        <CallOverlay />
        <ProfileDialogProvider onStartDirect={openConversation}>
        <div className="bg-background flex h-screen overflow-hidden">
          <ServerRail
            servers={servers}
            activeServerId={activeServerId}
            onSelect={(id) => {
              setView("servers");
              setActiveServerId(id);
            }}
            onAdd={() => setCreateOpen(true)}
            socialActive={view === "social"}
            onSelectSocial={() => setView("social")}
            socialBadge={totalUnread + pendingRequests}
          />

          {view === "social" ? (
            <SocialSidebar
              tab={socialTab}
              onTabChange={(tab) => {
                setSocialTab(tab);
                setActiveConversationId(null);
              }}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={openConversation}
              pendingRequests={pendingRequests}
            />
          ) : activeServer ? (
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
            {view === "social" ? (
              <SocialMain
                conversation={activeConversation}
                userId={user?.id}
                displayName={profile?.display_name ?? "Alguém"}
                tab={socialTab}
                friends={friends}
                requests={requests}
                conversations={conversations}
                onOpenConversation={openConversation}
                onCloseConversation={() => setActiveConversationId(null)}
              />
            ) : activeServer && activeChannel ? (
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
                    <Gamepad2 className="text-primary h-9 w-9" strokeWidth={1.9} />
                  </span>
                  <p className="text-caption mb-3">Plataforma social gamer</p>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Bem-vindo ao <span className="text-brand-gradient">LobbyX</span>
                  </h1>
                  <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm">
                    Escolha um lobby na barra lateral, crie a sua própria comunidade ou entre com
                    um convite.
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
                      { label: "Lobbies", value: servers.length },
                      { label: "Texto, voz e vídeo", value: "Tempo real" },
                      { label: "Progressão", value: "XP e badges" },
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
                      Carregando seus lobbies...
                    </p>
                  )}
                </div>
              </div>
            )}

          </main>

          {view === "servers" && activeServer && (
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
        </CallProviderRoot>
      </TooltipProvider>
    </VoiceProviderRoot>
  );
}

function SocialMain({
  conversation,
  userId,
  displayName,
  tab,
  friends,
  requests,
  conversations,
  onOpenConversation,
  onCloseConversation,
}: {
  conversation: ConversationOverview | null;
  userId: string | undefined;
  displayName: string;
  tab: SocialTab;
  friends: FriendEntry[];
  requests: FriendRequestEntry[];
  conversations: ConversationOverview[];
  onOpenConversation: (id: string) => void;
  onCloseConversation: () => void;
}) {
  const { openProfile } = useProfileDialog();

  if (conversation) {
    return (
      <DirectChatView
        key={conversation.id}
        conversation={conversation}
        userId={userId}
        displayName={displayName}
        onOpenProfile={openProfile}
        onLeft={onCloseConversation}
      />
    );
  }

  return (
    <SocialHome
      userId={userId}
      tab={tab}
      friends={friends}
      requests={requests}
      conversations={conversations}
      onOpenConversation={onOpenConversation}
      onOpenProfile={openProfile}
    />
  );
}
