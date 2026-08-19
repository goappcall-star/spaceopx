import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, MoreHorizontal, Search, UserMinus, UserPlus, UsersRound, Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusDot, STATUS_LABEL } from "@/components/app/StatusDot";
import { GamePresenceLine } from "@/components/gamer/GamePresenceLine";
import { shortTime, type SocialTab } from "@/components/social/SocialSidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { usePeopleSearch } from "@/hooks/use-social";
import { blocksService, conversationsService, friendsService } from "@/services/social";
import { cn } from "@/lib/utils";
import type { ConversationOverview, FriendEntry, FriendRequestEntry, UserStatus } from "@/types";

interface Props {
  userId: string | undefined;
  tab: SocialTab;
  friends: FriendEntry[];
  requests: FriendRequestEntry[];
  conversations: ConversationOverview[];
  onOpenConversation: (conversationId: string) => void;
  onOpenProfile: (userId: string) => void;
}

const TAB_TITLE: Record<SocialTab, string> = {
  friends: "Amigos",
  requests: "Solicitações",
  messages: "Mensagens",
  groups: "Grupos",
};

export function SocialHome({
  userId,
  tab,
  friends,
  requests,
  conversations,
  onOpenConversation,
  onOpenProfile,
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const { data: results = [], isFetching } = usePeopleSearch(search);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    void queryClient.invalidateQueries({ queryKey: ["relationship"] });
  }

  async function openDirect(otherId: string) {
    try {
      const id = await conversationsService.openDirect(otherId);
      refresh();
      onOpenConversation(id);
    } catch {
      toast.error("Não foi possível abrir a conversa.");
    }
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      refresh();
    } catch {
      toast.error("Ação não concluída.");
    }
  }

  const incoming = requests.filter((r) => r.direction === "incoming");
  const outgoing = requests.filter((r) => r.direction === "outgoing");
  const groups = conversations.filter((c) => c.type === "group");
  const directs = conversations.filter((c) => c.type === "direct");
  const friendIds = new Set(friends.map((f) => f.profile.id));
  const requestIds = new Set(requests.map((r) => r.profile.id));

  const buckets: { label: string; entries: FriendEntry[] }[] = [
    { label: "Online", entries: friends.filter((f) => f.profile.status === "online") },
    {
      label: "Ausentes",
      entries: friends.filter((f) => f.profile.status === "idle" || f.profile.status === "dnd"),
    },
    { label: "Offline", entries: friends.filter((f) => f.profile.status === "offline") },
  ];

  return (
    <div className="bg-ambient relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <span
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 opacity-[0.25] [mask-image:radial-gradient(70%_50%_at_50%_0%,black,transparent)]"
      />

      <header className="border-border bg-background/70 relative z-10 border-b px-6 py-5 backdrop-blur-md">
        <p className="text-caption">Central social</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          <span className="text-brand-gradient">{TAB_TITLE[tab]}</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Seu squad, seus amigos, suas conversas.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar usuários..."
              className="pl-9"
              aria-label="Pesquisar usuários"
            />
          </div>
          <Button variant="outline" onClick={() => setGroupOpen(true)}>
            <UsersRound className="mr-2 h-4 w-4" />
            Criar grupo
          </Button>
        </div>
      </header>

      <div className="scrollbar-slim relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {search.trim().length >= 2 ? (
          <Section title={isFetching ? "Buscando..." : `Resultados (${results.length})`}>
            {results.length === 0 && !isFetching ? (
              <Empty text="Nenhum usuário encontrado." />
            ) : (
              <ul className="space-y-1.5">
                {results
                  .filter((person) => person.id !== userId)
                  .map((person) => (
                    <Row
                      key={person.id}
                      avatarUrl={person.avatar_url}
                      name={person.display_name}
                      username={person.username}
                      status={person.status as UserStatus}
                      onOpenProfile={() => onOpenProfile(person.id)}
                      actions={
                        <>
                          {!friendIds.has(person.id) && !requestIds.has(person.id) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                run(
                                  () => friendsService.sendRequest(person.id),
                                  "Solicitação enviada.",
                                )
                              }
                            >
                              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                              Adicionar
                            </Button>
                          )}
                          {requestIds.has(person.id) && !friendIds.has(person.id) && (
                            <span className="text-muted-foreground text-xs">Pendente</span>
                          )}
                          <Button size="sm" onClick={() => openDirect(person.id)}>
                            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                            Mensagem
                          </Button>
                        </>
                      }
                    />
                  ))}
              </ul>
            )}
          </Section>
        ) : tab === "friends" ? (
          friends.length === 0 ? (
            <Empty text="Você ainda não tem amigos. Pesquise usuários acima." />
          ) : (
            buckets
              .filter((bucket) => bucket.entries.length > 0)
              .map((bucket) => (
                <Section key={bucket.label} title={`${bucket.label} — ${bucket.entries.length}`}>
                  <ul className="space-y-1.5">
                    {bucket.entries.map((friend) => (
                      <Row
                        key={friend.friendshipId}
                        avatarUrl={friend.profile.avatar_url}
                        name={friend.profile.display_name}
                        username={friend.profile.username}
                        status={friend.profile.status}
                        presenceNode={<GamePresenceLine presence={friend.presence} withLabel />}
                        onOpenProfile={() => onOpenProfile(friend.profile.id)}
                        actions={
                          <>
                            <Button size="sm" onClick={() => openDirect(friend.profile.id)}>
                              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                              Mensagem
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" aria-label="Mais ações">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() =>
                                    void run(
                                      () => friendsService.respond(friend.friendshipId, "remove"),
                                      "Amizade removida.",
                                    )
                                  }
                                >
                                  <UserMinus className="mr-2 h-4 w-4" />
                                  Remover amigo
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() =>
                                    void run(
                                      () => blocksService.block(friend.profile.id),
                                      "Usuário bloqueado.",
                                    )
                                  }
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Bloquear
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        }
                      />
                    ))}
                  </ul>
                </Section>
              ))
          )
        ) : tab === "requests" ? (
          <>
            <Section title={`Recebidas — ${incoming.length}`}>
              {incoming.length === 0 ? (
                <Empty text="Nenhuma solicitação recebida." />
              ) : (
                <ul className="space-y-1.5">
                  {incoming.map((request) => (
                    <Row
                      key={request.friendshipId}
                      avatarUrl={request.profile.avatar_url}
                      name={request.profile.display_name}
                      username={request.profile.username}
                      status={request.profile.status}
                      onOpenProfile={() => onOpenProfile(request.profile.id)}
                      actions={
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              run(
                                () => friendsService.respond(request.friendshipId, "accept"),
                                "Solicitação aceita.",
                              )
                            }
                          >
                            Aceitar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              run(
                                () => friendsService.respond(request.friendshipId, "decline"),
                                "Solicitação recusada.",
                              )
                            }
                          >
                            Recusar
                          </Button>
                        </>
                      }
                    />
                  ))}
                </ul>
              )}
            </Section>
            <Section title={`Enviadas — ${outgoing.length}`}>
              {outgoing.length === 0 ? (
                <Empty text="Nenhuma solicitação enviada." />
              ) : (
                <ul className="space-y-1.5">
                  {outgoing.map((request) => (
                    <Row
                      key={request.friendshipId}
                      avatarUrl={request.profile.avatar_url}
                      name={request.profile.display_name}
                      username={request.profile.username}
                      status={request.profile.status}
                      onOpenProfile={() => onOpenProfile(request.profile.id)}
                      actions={
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            run(
                              () => friendsService.respond(request.friendshipId, "cancel"),
                              "Solicitação cancelada.",
                            )
                          }
                        >
                          Cancelar
                        </Button>
                      }
                    />
                  ))}
                </ul>
              )}
            </Section>
          </>
        ) : (
          <Section title={tab === "messages" ? "Conversas" : "Grupos"}>
            {(tab === "messages" ? directs : groups).length === 0 ? (
              <Empty
                text={tab === "messages" ? "Nenhuma conversa ainda." : "Nenhum grupo ainda."}
              />
            ) : (
              <ul className="space-y-1.5">
                {(tab === "messages" ? directs : groups).map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => onOpenConversation(conversation.id)}
                      className="glass-panel hover:bg-surface-hover/60 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={
                            (conversation.type === "group"
                              ? conversation.avatar_url
                              : conversation.otherProfile?.avatar_url) ?? undefined
                          }
                          alt=""
                        />
                        <AvatarFallback className="bg-surface-elevated text-xs">
                          {(conversation.type === "group"
                            ? (conversation.name ?? "GR")
                            : (conversation.otherProfile?.display_name ?? "??")
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {conversation.type === "group"
                            ? (conversation.name ?? "Grupo")
                            : (conversation.otherProfile?.display_name ?? "Conversa")}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {conversation.last_message_content ?? "Sem mensagens"}
                        </span>
                      </span>
                      {conversation.type === "group" && (
                        <span className="text-muted-foreground text-[11px]">
                          {conversation.member_count} membros
                        </span>
                      )}
                      <span className="text-muted-foreground shrink-0 text-[11px]">
                        {shortTime(conversation.last_message_at)}
                      </span>
                      {conversation.unread_count > 0 && (
                        <span className="bg-primary text-primary-foreground glow-soft shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                          {conversation.unread_count}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>

      <CreateGroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        friends={friends}
        onCreated={(id) => {
          refresh();
          onOpenConversation(id);
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-muted-foreground text-sm">{text}</p>;
}

function Row({
  avatarUrl,
  name,
  username,
  status,
  presenceNode,
  actions,
  onOpenProfile,
}: {
  avatarUrl: string | null;
  name: string;
  username: string;
  status: UserStatus;
  presenceNode?: React.ReactNode;
  actions?: React.ReactNode;
  onOpenProfile: () => void;
}) {
  return (
    <li className="glass-panel hover:bg-surface-hover/50 group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors">
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="relative shrink-0">
          <Avatar className="ring-border h-10 w-10 ring-1">
            <AvatarImage src={avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-surface-elevated text-xs">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <StatusDot
            status={status}
            className="border-surface absolute -right-0.5 -bottom-0.5 border-2"
          />
        </div>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="text-muted-foreground block truncate font-mono text-[11px]">
            @{username}
          </span>
          {presenceNode ?? (
            <span className="text-muted-foreground block text-[11px]">{STATUS_LABEL[status]}</span>
          )}
        </span>
      </button>
      <div
        className={cn(
          "flex shrink-0 items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100",
        )}
      >
        {actions}
      </div>
    </li>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  friends,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friends: FriendEntry[];
  onCreated: (conversationId: string) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (name.trim().length < 2 || selected.length === 0) return;
    setBusy(true);
    try {
      const id = await conversationsService.createGroup(name, selected);
      toast.success("Grupo criado.");
      onOpenChange(false);
      setName("");
      setSelected([]);
      onCreated(id);
    } catch {
      toast.error("Não foi possível criar o grupo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar grupo</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome do grupo"
          aria-label="Nome do grupo"
        />
        <div className="scrollbar-slim max-h-64 space-y-1 overflow-y-auto">
          {friends.length === 0 && (
            <p className="text-muted-foreground text-sm">Adicione amigos primeiro.</p>
          )}
          {friends.map((friend) => (
            <label
              key={friend.profile.id}
              className="hover:bg-surface-hover flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm"
            >
              <Checkbox
                checked={selected.includes(friend.profile.id)}
                onCheckedChange={(checked) =>
                  setSelected((prev) =>
                    checked
                      ? [...prev, friend.profile.id]
                      : prev.filter((id) => id !== friend.profile.id),
                  )
                }
              />
              <Avatar className="h-7 w-7">
                <AvatarImage src={friend.profile.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="text-[10px]">
                  {friend.profile.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {friend.profile.display_name}
            </label>
          ))}
        </div>
        <Button onClick={submit} disabled={busy || name.trim().length < 2 || selected.length === 0}>
          Criar grupo
        </Button>
      </DialogContent>
    </Dialog>
  );
}
