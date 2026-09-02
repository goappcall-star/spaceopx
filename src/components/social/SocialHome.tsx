import { useQueryClient } from "@tanstack/react-query";
import { Ban, MessageSquare, MoreHorizontal, Search, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { STATUS_LABEL, StatusDot } from "@/components/app/StatusDot";
import { GamePresenceLine } from "@/components/gamer/GamePresenceLine";
import { QuickProfile } from "@/components/gamer/QuickProfile";
import { shortTime, type SocialTab } from "@/components/social/SocialSidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useGlobalPresence } from "@/hooks/use-global-presence";
import { usePeopleSearch } from "@/hooks/use-social";
import { blocksService, conversationsService, friendsService, peopleService } from "@/services/social";
import { cn } from "@/lib/utils";
import type { ConversationOverview, FriendEntry, FriendRequestEntry, UserStatus } from "@/types";

interface Props {
  userId: string | undefined;
  tab: SocialTab;
  friends: FriendEntry[];
  requests: FriendRequestEntry[];
  conversations: ConversationOverview[];
  onOpenConversation: (conversationId: string) => void;
}

const TAB_TITLE: Record<SocialTab, string> = {
  friends: "Amigos",
  requests: "Solicitações",
  messages: "Mensagens",
  groups: "Grupos",
};

type FriendCategory = "available" | "all" | "add";

const CATEGORIES: { id: FriendCategory; label: string }[] = [
  { id: "available", label: "Disponíveis" },
  { id: "all", label: "Todos" },
  { id: "add", label: "Adicionar amigo" },
];

export function SocialHome({
  userId,
  tab,
  friends,
  requests,
  conversations,
  onOpenConversation,
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FriendCategory>("available");
  const { statusOf } = useGlobalPresence();
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

  const available = friends.filter((f) => statusOf(f.profile.id) !== "offline");

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
        <p className="text-muted-foreground mt-1 text-sm">Seu squad, seus amigos, suas conversas.</p>

        <div className="mt-4 max-w-sm">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar usuários..."
              className="pl-9"
              aria-label="Pesquisar usuários"
            />
          </div>
        </div>

        {tab === "friends" && search.trim().length < 2 && (
          <nav className="mt-4 flex flex-wrap gap-1.5">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors",
                  category === item.id
                    ? "border-primary/60 bg-primary/15 text-foreground glow-soft"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover/60",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
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
                      userId={person.id}
                      avatarUrl={person.avatar_url}
                      name={person.display_name}
                      username={person.username}
                      status={statusOf(person.id)}
                      onStartDirect={onOpenConversation}
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
          category === "add" ? (
            <AddFriendPanel onDone={refresh} />
          ) : (
            <FriendList
              entries={category === "available" ? available : friends}
              emptyText={
                category === "available"
                  ? "Nenhum amigo disponível agora."
                  : "Você ainda não tem amigos. Use Adicionar amigo."
              }
              title={
                category === "available"
                  ? `Disponíveis — ${available.length}`
                  : `Todos — ${friends.length}`
              }
              statusOf={statusOf}
              onMessage={openDirect}
              onStartDirect={onOpenConversation}
              onRemove={(id) =>
                run(() => friendsService.respond(id, "remove"), "Amizade removida.")
              }
              onBlock={(id) => run(() => blocksService.block(id), "Usuário bloqueado.")}
            />
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
                      userId={request.profile.id}
                      avatarUrl={request.profile.avatar_url}
                      name={request.profile.display_name}
                      username={request.profile.username}
                      status={statusOf(request.profile.id)}
                      onStartDirect={onOpenConversation}
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
                      userId={request.profile.id}
                      avatarUrl={request.profile.avatar_url}
                      name={request.profile.display_name}
                      username={request.profile.username}
                      status={statusOf(request.profile.id)}
                      onStartDirect={onOpenConversation}
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
              <Empty text={tab === "messages" ? "Nenhuma conversa ainda." : "Nenhum grupo ainda."} />
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
    </div>
  );
}

function FriendList({
  entries,
  title,
  emptyText,
  statusOf,
  onMessage,
  onRemove,
  onBlock,
  onStartDirect,
}: {
  entries: FriendEntry[];
  title: string;
  emptyText: string;
  statusOf: (id: string) => UserStatus;
  onMessage: (userId: string) => void;
  onRemove: (friendshipId: string) => void;
  onBlock: (userId: string) => void;
  onStartDirect: (conversationId: string) => void;
}) {
  return (
    <Section title={title}>
      {entries.length === 0 ? (
        <Empty text={emptyText} />
      ) : (
        <ul className="space-y-1.5">
          {entries.map((friend) => (
            <Row
              key={friend.friendshipId}
              userId={friend.profile.id}
              avatarUrl={friend.profile.avatar_url}
              name={friend.profile.display_name}
              username={friend.profile.username}
              status={statusOf(friend.profile.id)}
              presenceNode={<GamePresenceLine presence={friend.presence} withLabel />}
              onStartDirect={onStartDirect}
              actions={
                <>
                  <Button size="sm" onClick={() => onMessage(friend.profile.id)}>
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
                      <DropdownMenuItem onSelect={() => onRemove(friend.friendshipId)}>
                        <UserMinus className="mr-2 h-4 w-4" />
                        Remover amigo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => onBlock(friend.profile.id)}
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
      )}
    </Section>
  );
}

/** Add a friend by exact @username, reusing the existing friendship RPCs. */
function AddFriendPanel({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function submit() {
    const username = value.trim().replace(/^@/, "").toLowerCase();
    if (username.length < 3) {
      setFeedback({ tone: "error", text: "Digite um username válido." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const matches = await peopleService.search(username);
      const person = matches.find((m) => m.username.toLowerCase() === username);
      if (!person) {
        setFeedback({ tone: "error", text: "Usuário não encontrado." });
        return;
      }

      const relationship = await friendsService.relationship(person.id);
      if (relationship.state === "friends") {
        setFeedback({ tone: "ok", text: `Você já é amigo de @${person.username}.` });
        return;
      }
      if (relationship.state === "request_sent") {
        setFeedback({ tone: "ok", text: "Solicitação já enviada." });
        return;
      }
      if (relationship.state === "request_received") {
        setFeedback({
          tone: "ok",
          text: "Este usuário já te enviou uma solicitação — responda em Solicitações.",
        });
        return;
      }
      if (relationship.state === "blocked_by_me" || relationship.state === "blocked_me") {
        setFeedback({ tone: "error", text: "Usuário bloqueado." });
        return;
      }

      await friendsService.sendRequest(person.id);
      toast.success("Solicitação enviada.");
      setFeedback({ tone: "ok", text: `Solicitação enviada para @${person.username}.` });
      setValue("");
      onDone();
    } catch {
      setFeedback({ tone: "error", text: "Não foi possível enviar a solicitação." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Adicionar amigo">
      <div className="glass-panel max-w-xl rounded-xl p-4">
        <p className="text-muted-foreground text-sm">
          Envie uma solicitação usando o username permanente do jogador.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void submit()}
            placeholder="@username"
            aria-label="Username do amigo"
            className="min-w-52 flex-1"
          />
          <Button onClick={() => void submit()} disabled={busy}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Adicionar amigo
          </Button>
        </div>
        {feedback && (
          <p
            className={cn(
              "mt-3 text-xs",
              feedback.tone === "ok" ? "text-primary" : "text-destructive",
            )}
          >
            {feedback.text}
          </p>
        )}
      </div>
    </Section>
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
  userId,
  avatarUrl,
  name,
  username,
  status,
  presenceNode,
  actions,
  onStartDirect,
}: {
  userId: string;
  avatarUrl: string | null;
  name: string;
  username: string;
  status: UserStatus;
  presenceNode?: React.ReactNode;
  actions?: React.ReactNode;
  onStartDirect: (conversationId: string) => void;
}) {
  return (
    <li className="glass-panel hover:bg-surface-hover/50 group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors">
      <QuickProfile
        userId={userId}
        side="bottom"
        className="min-w-0 flex-1"
        onStartDirect={onStartDirect}
      >
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left">
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
      </QuickProfile>
      <div className="flex shrink-0 items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
        {actions}
      </div>
    </li>
  );
}
