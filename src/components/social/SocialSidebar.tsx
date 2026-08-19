import { MessageSquare, UserPlus, Users, UsersRound } from "lucide-react";

import { StatusDot } from "@/components/app/StatusDot";
import { UserBar } from "@/components/app/UserBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ConversationOverview, UserStatus } from "@/types";

export type SocialTab = "friends" | "requests" | "messages" | "groups";

interface Props {
  tab: SocialTab;
  onTabChange: (tab: SocialTab) => void;
  conversations: ConversationOverview[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  pendingRequests: number;
}

const NAV: { id: SocialTab; label: string; icon: typeof Users }[] = [
  { id: "friends", label: "Amigos", icon: Users },
  { id: "requests", label: "Solicitações", icon: UserPlus },
  { id: "messages", label: "Mensagens", icon: MessageSquare },
  { id: "groups", label: "Grupos", icon: UsersRound },
];

export function shortTime(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function SocialSidebar({
  tab,
  onTabChange,
  conversations,
  activeConversationId,
  onSelectConversation,
  pendingRequests,
}: Props) {
  const direct = conversations.filter((c) => c.type === "direct");

  return (
    <aside className="bg-surface border-border relative z-20 flex w-64 shrink-0 flex-col border-r">
      <div className="border-border relative overflow-hidden border-b px-4 py-3.5">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ backgroundImage: "var(--gradient-ambient)" }}
        />
        <h2 className="relative text-sm font-semibold tracking-tight">Social</h2>
        <p className="text-muted-foreground relative mt-0.5 text-xs">Seu squad e conversas</p>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 py-2.5">
        {NAV.map((item) => {
          const active = tab === item.id && !activeConversationId;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-surface-hover text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-primary")} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "requests" && pendingRequests > 0 && (
                <span className="bg-primary text-primary-foreground glow-soft rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {pendingRequests}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <p className="text-muted-foreground px-1.5 pt-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
          Conversas diretas
        </p>
        {direct.length === 0 ? (
          <p className="text-muted-foreground px-1.5 text-xs">Nenhuma conversa ainda.</p>
        ) : (
          <ul className="space-y-0.5">
            {direct.map((conversation) => {
              const active = conversation.id === activeConversationId;
              const profile = conversation.otherProfile;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                      active
                        ? "bg-surface-hover text-foreground"
                        : "text-muted-foreground hover:bg-surface-hover/60 hover:text-foreground",
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                        <AvatarFallback className="bg-surface-elevated text-[11px]">
                          {(profile?.display_name ?? "??").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <StatusDot
                        status={(profile?.status as UserStatus) ?? "offline"}
                        className="border-surface absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 border-2"
                      />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {profile?.display_name ?? "Conversa"}
                      </span>
                      <span className="text-muted-foreground block truncate text-[11px]">
                        {conversation.last_message_content ?? "Sem mensagens"}
                      </span>
                    </span>
                    {conversation.unread_count > 0 && (
                      <span className="bg-primary text-primary-foreground glow-soft shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                        {conversation.unread_count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <UserBar />
    </aside>
  );
}
