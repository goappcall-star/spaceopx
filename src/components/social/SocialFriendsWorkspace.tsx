import { useEffect, useState, type ReactNode } from "react";
import {
  Ban,
  ChevronDown,
  Gamepad2,
  Headphones,
  LayoutGrid,
  List,
  MessageSquare,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { STATUS_LABEL, StatusDot } from "@/components/app/StatusDot";
import { QuickProfile } from "@/components/gamer/QuickProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGlobalPresence } from "@/hooks/use-global-presence";
import { useSocialActivity } from "@/hooks/use-social-activity";
import { visibleSocialRooms, type SocialRoom } from "@/lib/social-activity";
import { cn } from "@/lib/utils";
import type { ConversationOverview, FriendEntry, FriendRequestEntry } from "@/types";
import "./social-workspace.css";

type Filter = "all" | "online" | "call" | "playing" | "offline";
const filters: { id: Filter; label: string; icon: typeof Users }[] = [
  { id: "all", label: "Todos", icon: Users },
  { id: "online", label: "Online", icon: Users },
  { id: "call", label: "Em chamada", icon: Headphones },
  { id: "playing", label: "Jogando", icon: Gamepad2 },
  { id: "offline", label: "Offline", icon: Users },
];

interface Props {
  userId: string | undefined;
  friends: FriendEntry[];
  requests: FriendRequestEntry[];
  conversations: ConversationOverview[];
  onMessage: (id: string) => void;
  onOpenConversation: (id: string) => void;
  onRemove: (id: string) => void;
  onBlock: (id: string) => void;
  onAccept: (id: string) => void;
  addFriendPanel: ReactNode;
}

export function SocialFriendsWorkspace({
  userId,
  friends,
  requests,
  conversations,
  onMessage,
  onOpenConversation,
  onRemove,
  onBlock,
  onAccept,
  addFriendPanel,
}: Props) {
  const { statusOf, games, connection } = useGlobalPresence();
  const authorizedRooms = useSocialActivity(userId, conversations);
  return (
    <SocialFriendsLayout
      {...{
        userId,
        friends,
        requests,
        conversations,
        onMessage,
        onOpenConversation,
        onRemove,
        onBlock,
        onAccept,
        addFriendPanel,
      }}
      statusOf={statusOf}
      games={games}
      authorizedRooms={connection === "online" ? authorizedRooms : []}
    />
  );
}

/** Presentational boundary also used by the isolated, synthetic layout preview. */
export function SocialFriendsLayout({
  userId,
  friends,
  requests,
  onMessage,
  onOpenConversation,
  onRemove,
  onBlock,
  onAccept,
  addFriendPanel,
  statusOf,
  games,
  authorizedRooms,
}: Props & {
  statusOf: (id: string) => "online" | "offline" | "idle" | "dnd";
  games: Record<string, { name: string }>;
  authorizedRooms: SocialRoom[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState("relevant");
  const [preference, setPreference] = useState({ owner: userId, panel: true, grid: false });
  const preferenceKey = userId ? `lobbyx:social-layout:${userId}` : null;
  useEffect(() => {
    try {
      const saved = JSON.parse(
        preferenceKey ? (localStorage.getItem(preferenceKey) ?? "{}") : "{}",
      );
      setPreference({ owner: userId, panel: saved.panel !== false, grid: saved.grid === true });
    } catch {
      setPreference({ owner: userId, panel: true, grid: false });
    }
  }, [preferenceKey, userId]);
  const panel = preference.owner === userId ? preference.panel : true;
  const grid = preference.owner === userId ? preference.grid : false;
  function updatePreference(next: { panel: boolean; grid: boolean }) {
    setPreference({ owner: userId, ...next });
    try {
      if (preferenceKey) localStorage.setItem(preferenceKey, JSON.stringify(next));
    } catch {
      /* Available for this session even when storage is blocked. */
    }
  }
  const visible = new Set(
    friends.filter((f) => statusOf(f.profile.id) !== "offline").map((f) => f.profile.id),
  );
  const rooms = visibleSocialRooms(authorizedRooms, visible);
  const callFor = (id: string) => rooms.find((room) => room.userIds.includes(id));
  const gameFor = (friend: FriendEntry) =>
    statusOf(friend.profile.id) !== "offline"
      ? (games[friend.profile.id]?.name ??
        (friend.presence?.status === "playing" ? friend.presence.game?.name : undefined))
      : undefined;
  const matches = (friend: FriendEntry, id: Filter) =>
    id === "all" ||
    (id === "online" && visible.has(friend.profile.id)) ||
    (id === "offline" && !visible.has(friend.profile.id)) ||
    (id === "call" && Boolean(callFor(friend.profile.id))) ||
    (id === "playing" && Boolean(gameFor(friend)));
  const entries = friends
    .filter(
      (f) =>
        matches(f, filter) &&
        `${f.profile.display_name} ${f.profile.username}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR").trim()),
    )
    .sort((a, b) => {
      if (sort === "relevant") {
        const rank = (f: FriendEntry) =>
          callFor(f.profile.id) ? 3 : gameFor(f) ? 2 : visible.has(f.profile.id) ? 1 : 0;
        const diff = rank(b) - rank(a);
        if (diff) return diff;
      }
      return a.profile.display_name.localeCompare(b.profile.display_name, "pt-BR");
    });
  const activity = friends.filter((f) => callFor(f.profile.id) || gameFor(f));
  const incoming = requests.filter((r) => r.direction === "incoming");
  function portrait(friend: FriendEntry, size = "h-10 w-10") {
    return (
      <div className="relative shrink-0">
        <Avatar frame={friend.profile.avatar_frame} className={size}>
          <AvatarImage src={friend.profile.avatar_url ?? undefined} alt="" />
          <AvatarFallback>{friend.profile.display_name.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <StatusDot
          status={statusOf(friend.profile.id)}
          className="absolute -right-0.5 -bottom-0.5 border-2 border-surface"
        />
      </div>
    );
  }
  function activityLabel(friend: FriendEntry) {
    const room = callFor(friend.profile.id);
    return room
      ? `Em chamada • ${room.name}`
      : gameFor(friend)
        ? `Jogando ${gameFor(friend)}`
        : STATUS_LABEL[statusOf(friend.profile.id)];
  }
  return (
    <div className="social-workspace min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className={cn("social-workspace-columns", panel && "has-panel")}>
        <main className="min-w-0">
          <header className="social-friends-header">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Central Social</p>
              <h1 className="social-friends-title">Amigos</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Seu squad, seus amigos, suas conversas.
              </p>
            </div>
            <div className="social-header-actions">
              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar amigos..."
                  aria-label="Pesquisar amigos"
                  className="social-search pl-9"
                />
              </div>
              <Button
                variant="outline"
                className="social-add-button"
                onClick={() => setAdding(!adding)}
                aria-expanded={adding}
              >
                {adding ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                <span>{adding ? "Fechar" : "Adicionar amigo"}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => updatePreference({ panel: !panel, grid })}
                aria-label={panel ? "Ocultar painel social" : "Mostrar painel social"}
                aria-expanded={panel}
                aria-controls="social-activity-panel"
                title={panel ? "Ocultar painel social" : "Mostrar painel social"}
              >
                {panel ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
            </div>
          </header>
          <div className="social-toolbar">
            <nav className="flex flex-wrap gap-2" aria-label="Filtrar amigos">
              {filters.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={cn("social-filter", filter === id && "is-active")}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5",
                      id === "online" && "text-success",
                      id === "playing" && "text-success",
                    )}
                  />
                  {label} <span>({friends.filter((f) => matches(f, id)).length})</span>
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <div className="social-view-switch" role="group" aria-label="Visualização de amigos">
                <button
                  aria-label="Visualizar em grade"
                  aria-pressed={grid}
                  onClick={() => updatePreference({ panel, grid: true })}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  aria-label="Visualizar em lista"
                  aria-pressed={!grid}
                  onClick={() => updatePreference({ panel, grid: false })}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              <div className="relative">
                <select
                  aria-label="Ordenar amigos"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="social-sort"
                >
                  <option value="relevant">Mais relevantes</option>
                  <option value="name">Nome: A–Z</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2" />
              </div>
            </div>
          </div>
          {adding && <div className="mb-6">{addFriendPanel}</div>}
          <section aria-labelledby="social-friends-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="social-friends-heading" className="font-semibold">
                Amigos
              </h2>
              <span className="text-muted-foreground text-xs" role="status">
                {entries.length} {entries.length === 1 ? "amigo" : "amigos"}
              </span>
            </div>
            {!entries.length ? (
              <div className="social-empty">
                <Users className="mx-auto mb-3 h-8 w-8 opacity-50" />
                <p>
                  {friends.length
                    ? "Nenhum amigo neste filtro."
                    : "Sua próxima conversa começa aqui."}
                </p>
                <p className="mt-1 text-xs">
                  {friends.length
                    ? "Experimente outro filtro ou nome."
                    : "Adicione amigos usando o nome de usuário."}
                </p>
              </div>
            ) : (
              <ul className={cn("social-friend-list", grid && "is-grid")}>
                {entries.map((friend) => {
                  const room = callFor(friend.profile.id),
                    game = gameFor(friend);
                  return (
                    <li key={friend.friendshipId} className="social-friend-row">
                      <QuickProfile
                        userId={friend.profile.id}
                        side="bottom"
                        onStartDirect={onOpenConversation}
                        className="social-friend-identity"
                      >
                        <button
                          className="flex w-full min-w-0 items-center gap-3 text-left"
                          aria-label={`Ver perfil de ${friend.profile.display_name}`}
                        >
                          {portrait(friend)}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {friend.profile.display_name}
                            </span>
                            <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  statusOf(friend.profile.id) === "offline"
                                    ? "bg-muted-foreground"
                                    : room
                                      ? "bg-primary"
                                      : statusOf(friend.profile.id) === "idle"
                                        ? "bg-warning"
                                        : statusOf(friend.profile.id) === "dnd"
                                          ? "bg-destructive"
                                          : "bg-success",
                                )}
                              />
                              <span className="truncate">{activityLabel(friend)}</span>
                            </span>
                          </span>
                        </button>
                      </QuickProfile>
                      <div className="social-friend-activity">
                        {room || game ? (
                          <>
                            <span
                              className={cn("social-activity-icon", game && !room && "is-playing")}
                            >
                              {room ? (
                                <Headphones className="h-4 w-4" />
                              ) : (
                                <Gamepad2 className="h-4 w-4" />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium">
                                {room ? "Em chamada" : game}
                              </span>
                              <span className="text-muted-foreground block truncate text-[11px]">
                                {room ? room.name : "Em jogo"}
                              </span>
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </div>
                      <div className="social-friend-actions">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Mensagem para ${friend.profile.display_name}`}
                          onClick={() => onMessage(friend.profile.id)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Mais ações para ${friend.profile.display_name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
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
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>
        {panel && (
          <aside
            id="social-activity-panel"
            className="social-activity-panel"
            aria-label="Painel social"
          >
            <section className="social-side-card">
              <h2>Em chamadas agora</h2>
              <p className="social-side-caption">
                Chamadas observadas em espaços acessíveis a você.
              </p>
              {rooms.length ? (
                <ul className="space-y-4">
                  {rooms.map((room) => (
                    <li key={`${room.kind}:${room.id}`} className="flex items-center gap-3">
                      <span className="social-room-icon">
                        <Headphones className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{room.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {room.userIds.length}{" "}
                          {room.userIds.length === 1 ? "amigo visível" : "amigos visíveis"}
                        </p>
                      </div>
                      <div className="flex -space-x-2">
                        {room.userIds.slice(0, 3).map((id) => {
                          const friend = friends.find((f) => f.profile.id === id)!;
                          return (
                            <Avatar
                              key={id}
                              className="h-6 w-6 border-2 border-surface"
                              title={friend.profile.display_name}
                            >
                              <AvatarImage
                                src={friend.profile.avatar_url ?? undefined}
                                alt={friend.profile.display_name}
                              />
                              <AvatarFallback className="text-[9px]">
                                {friend.profile.display_name.slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="social-side-empty">Nenhuma chamada acessível identificada agora.</p>
              )}
            </section>
            <section className="social-side-card">
              <h2>Atividade dos amigos</h2>
              {activity.length ? (
                <ul className="space-y-4">
                  {activity.slice(0, 6).map((friend) => (
                    <li key={friend.profile.id}>
                      <button
                        className="flex w-full items-center gap-3 text-left"
                        onClick={() => onMessage(friend.profile.id)}
                      >
                        {portrait(friend, "h-9 w-9")}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {friend.profile.display_name}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {activityLabel(friend)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="social-side-empty">
                  As atividades compartilhadas pelos seus amigos aparecem aqui.
                </p>
              )}
            </section>
            <section className="social-side-card">
              <h2>{incoming.length ? "Querem ser seus amigos" : "Conecte seu squad"}</h2>
              {incoming.length ? (
                <ul className="space-y-4">
                  {incoming.slice(0, 4).map((request) => (
                    <li key={request.friendshipId} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={request.profile.avatar_url ?? undefined} alt="" />
                        <AvatarFallback>{request.profile.display_name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {request.profile.display_name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          @{request.profile.username}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAccept(request.friendshipId)}
                      >
                        Aceitar
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <p className="social-side-empty">
                    Encontre seus amigos pelo @usuário e mantenha a conversa por perto.
                  </p>
                  <Button
                    variant="outline"
                    className="social-add-button mt-4 w-full"
                    onClick={() => setAdding(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Adicionar amigo
                  </Button>
                </>
              )}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
