import { useSessionServer } from "@/components/call/SessionCommunications";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ChannelSidebar } from "@/components/app/ChannelSidebar";
import { CreateChannelDialog } from "@/components/app/CreateChannelDialog";
import { CreateServerDialog } from "@/components/app/CreateServerDialog";
import { InviteDialog } from "@/components/app/InviteDialog";
import { JoinServerDialog } from "@/components/app/JoinServerDialog";
import { MemberPanel } from "@/components/app/MemberPanel";
import { ServerRail } from "@/components/app/ServerRail";
import { ServerSettingsDialog } from "@/components/server-settings/ServerSettingsDialog";
import { UserBar } from "@/components/app/UserBar";
import { CallWorkspace } from "@/components/call/CallOverlay";
import { ChatView } from "@/components/chat/ChatView";
import { VoiceRoom } from "@/components/voice/VoiceRoom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  useMyServers,
  useServerChannels,
  useServerMembers,
  useServerPermissions,
} from "@/hooks/use-servers";
import { useServerAbilities } from "@/hooks/use-server-admin";
import { ProfileDialogProvider, useProfileDialog } from "@/components/gamer/ProfileDialog";
import { DirectChatView } from "@/components/social/DirectChatView";
import { SocialHome } from "@/components/social/SocialHome";
import { SocialSidebar, type SocialTab } from "@/components/social/SocialSidebar";
import { useConversations, useFriends } from "@/hooks/use-social";
import type { ConversationOverview, FriendEntry, FriendRequestEntry } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { channelsService } from "@/services/channels";
import { readStatesService } from "@/services/messages";
import { membersService } from "@/services/members";
import { memberHasPermission } from "@/services/permissions";
import { useServerPreferences } from "@/hooks/use-server-preferences";
import { shouldNotifyChannel } from "@/lib/channel-preferences";
import { ServerPersonalDialog } from "@/components/app/ServerPersonalDialog";
import type { ServerMenuAction } from "@/components/app/ServerContextMenu";
import type { Server } from "@/types";

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
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { server: serverParam } = useSearch({ from: "/_authenticated/app" });
  const { data: servers = [], isLoading: loadingServers } = useMyServers();
  const {
    serverId: activeServerId,
    setServerId: setActiveServerId,
    voiceReturn,
    setVoiceReturn,
  } = useSessionServer();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const preferences = useServerPreferences(user?.id);
  const [menuDialog, setMenuDialog] = useState<{
    server: Server;
    action: "profile" | "privacy" | "leave";
  } | null>(null);
  const [menuInviteServer, setMenuInviteServer] = useState<Server | null>(null);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"servers" | "social">("servers");
  const [socialTab, setSocialTab] = useState<SocialTab>("friends");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const { friends, requests } = useFriends(user?.id);
  const { conversations, totalUnread } = useConversations(user?.id);
  const pendingRequests = requests.filter((r) => r.direction === "incoming").length;
  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;

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
  const abilities = useServerAbilities(activeServer, members, user?.id);
  const activePreferences = activeServer ? preferences.get(activeServer.id) : null;

  async function handleServerAction(action: ServerMenuAction, server: Server) {
    if (!user) return;
    if (action === "privacy" || action === "profile" || action === "leave") {
      setMenuDialog({ action, server });
      return;
    }
    try {
      if (action === "invite") {
        const serverMembers = await membersService.listByServer(server.id);
        const member = serverMembers.find((m) => m.user_id === user.id);
        if (!memberHasPermission(member, server.owner_id, "create_invite")) {
          toast.error("Você não tem permissão para criar convites neste servidor.");
          return;
        }
        setMenuInviteServer(server);
      } else {
        const serverChannels = await channelsService.listByServer(server.id);
        const ids = new Set(serverChannels.map((c) => c.id));
        await Promise.all(
          serverChannels
            .filter((c) => c.type !== "voice")
            .map((c) => readStatesService.markRead(c.id, user.id, null)),
        );
        setUnread((previous) => new Set([...previous].filter((id) => !ids.has(id))));
        toast.success("Servidor marcado como lido.");
      }
    } catch {
      toast.error("Não foi possível concluir a operação. Tente novamente.");
    }
  }

  // Deep link (?server=...) — e.g. right after accepting an invite.
  useEffect(() => {
    if (!serverParam) return;
    if (!servers.some((s) => s.id === serverParam)) return;
    setView("servers");
    setActiveServerId((current) => current ?? serverParam);
  }, [serverParam, servers]);

  useEffect(() => {
    if (!loadingServers && activeServerId && !servers.some((s) => s.id === activeServerId)) {
      setActiveServerId(null);
    }
  }, [servers, activeServerId, loadingServers, setActiveServerId]);

  useEffect(() => {
    if (channels.length === 0) {
      setActiveChannelId(null);
      return;
    }
    if (!channels.some((c) => c.id === activeChannelId)) {
      setActiveChannelId(channels.find((c) => c.type !== "voice")?.id ?? channels[0]?.id ?? null);
    }
  }, [channels, activeChannelId]);

  useEffect(() => {
    if (!voiceReturn) return;
    setView("servers");
    setActiveServerId(voiceReturn.serverId);
    if (
      activeServerId === voiceReturn.serverId &&
      channels.some((c) => c.id === voiceReturn.channelId)
    ) {
      setActiveChannelId(voiceReturn.channelId);
      setVoiceReturn(null);
    }
  }, [voiceReturn, activeServerId, channels, setActiveServerId, setVoiceReturn]);

  // Server-wide unread badges: any insert outside the open channel marks it.
  useEffect(() => {
    if (!activeServer || channels.length === 0 || !user?.id) return;
    const ids = new Set(channels.map((c) => c.id));
    const realtime = supabase
      .channel(`unread:${activeServer.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as { channel_id: string; author_id: string; mentions?: string[] };
          if (!ids.has(row.channel_id)) return;
          if (row.author_id === user.id || row.channel_id === activeChannelId) return;
          const channel = channels.find((channel) => channel.id === row.channel_id);
          if (
            activePreferences &&
            channel &&
            !shouldNotifyChannel(activePreferences, channel, user.id, row.mentions)
          )
            return;
          setUnread((prev) => new Set(prev).add(row.channel_id));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(realtime);
    };
  }, [activeServer, channels, activeChannelId, user?.id, activePreferences]);

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
    <>
      <ProfileDialogProvider onStartDirect={openConversation}>
        <div className="bg-background flex h-screen overflow-hidden">
          <ServerRail
            getPreferences={preferences.get}
            onUpdatePreferences={preferences.update}
            onServerAction={(action, server) => {
              void handleServerAction(action, server);
            }}
            servers={servers}
            onHome={() => {
              void navigate({ to: "/app", search: {}, replace: true });
              setView("servers");
              setActiveServerId(null);
              setActiveChannelId(null);
              setActiveConversationId(null);
              setVoiceReturn(null);
            }}
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
              key={activeServer.id}
              onUpdatePreferences={(patch) => preferences.update(activeServer.id, patch)}
              onMarkRead={(ids) => {
                if (!user) return;
                void Promise.all(ids.map((id) => readStatesService.markRead(id, user.id, null)))
                  .then(() => {
                    setUnread(
                      (previous) => new Set([...previous].filter((id) => !ids.includes(id))),
                    );
                  })
                  .catch(() => toast.error("Não foi possível marcar como lido."));
              }}
              onStartDirect={openConversation}
              preferences={preferences.get(activeServer.id)}
              onToggleMuteChannel={(channelId) => {
                const current = preferences.get(activeServer.id);
                preferences.update(activeServer.id, {
                  mutedChannels: current.mutedChannels.includes(channelId)
                    ? current.mutedChannels.filter((id) => id !== channelId)
                    : [...current.mutedChannels, channelId],
                });
              }}
              server={activeServer}
              channels={channels}
              activeChannelId={activeChannelId}
              onSelectChannel={setActiveChannelId}
              members={members}
              unreadChannelIds={unread}
              canInvite={canManage || abilities.can("create_invite")}
              canManage={abilities.can("manage_channels")}
              canOpenSettings={abilities.canOpenSettings}
              onOpenSettings={() => setSettingsOpen(true)}
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

          <CallWorkspace
            onOpenConversation={openConversation}
            conversation={view === "social" ? activeConversation : null}
          >
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
                  onStartDirect={openConversation}
                  onInvite={
                    canManage || abilities.can("create_invite")
                      ? () => setInviteOpen(true)
                      : undefined
                  }
                  onManageRoles={canManage ? () => setSettingsOpen(true) : undefined}
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
                    <img
                      src="/lobbyx-logo.png"
                      alt="LobbyX"
                      className="h-20 w-20 rounded-3xl object-contain"
                    />
                  </span>
                  <p className="text-caption mb-3">Plataforma social gamer</p>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Bem-vindo ao <span className="text-brand-gradient">LobbyX</span>
                  </h1>
                  <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm">
                    Escolha um lobby na barra lateral, crie a sua própria comunidade ou entre com um
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
                    <p className="text-muted-foreground mt-6 text-xs">Carregando seus lobbies...</p>
                  )}
                </div>
              </div>
            )}
          </CallWorkspace>

          {view === "servers" && activeServer && (
            <MemberPanel
              server={activeServer}
              onInvite={
                canManage || abilities.can("create_invite") ? () => setInviteOpen(true) : undefined
              }
              members={members}
              loading={loadingMembers}
              onStartDirect={openConversation}
            />
          )}
        </div>

        <CreateServerDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(serverId) => setActiveServerId(serverId)}
        />
        {menuInviteServer && (
          <InviteDialog
            key={menuInviteServer.id}
            serverId={menuInviteServer.id}
            open
            onOpenChange={(open) => {
              if (!open) setMenuInviteServer(null);
            }}
          />
        )}
        {menuDialog && user && (
          <ServerPersonalDialog
            key={`${menuDialog.server.id}:${menuDialog.action}`}
            {...menuDialog}
            userId={user.id}
            onClose={() => setMenuDialog(null)}
            onLeft={(serverId) => {
              if (activeServerId === serverId) {
                setActiveServerId(null);
                setActiveChannelId(null);
                setSettingsOpen(false);
                setInviteOpen(false);
                setChannelOpen(false);
              }
            }}
          />
        )}
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
            {user && (
              <ServerSettingsDialog
                server={activeServer}
                members={members}
                currentUserId={user.id}
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
              />
            )}
          </>
        )}
      </ProfileDialogProvider>
    </>
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
    />
  );
}
