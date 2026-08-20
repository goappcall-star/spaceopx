import { Gamepad2, LogOut, Phone, Users, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/app/StatusDot";
import { DmComposer } from "@/components/social/DmComposer";
import { DmMessageItem } from "@/components/social/DmMessageItem";
import { GroupMembersDialog } from "@/components/social/GroupMembersDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDirectMessages } from "@/hooks/use-dm-messages";
import { useConversationMembers } from "@/hooks/use-social";
import { useCall } from "@/hooks/use-call";
import { useTyping } from "@/hooks/use-typing";
import { conversationsService } from "@/services/social";
import type { ConversationOverview, DirectMessageWithMeta, Profile, UserStatus } from "@/types";

interface Props {
  conversation: ConversationOverview;
  userId: string | undefined;
  displayName: string;
  onOpenProfile: (userId: string) => void;
  onLeft: () => void;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function DirectChatView({ conversation, userId, displayName, onOpenProfile, onLeft }: Props) {
  const [replyTo, setReplyTo] = useState<DirectMessageWithMeta | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: members = [] } = useConversationMembers(conversation.id);
  const profiles = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const member of members) if (member.profile) map.set(member.profile.id, member.profile);
    return map;
  }, [members]);

  const { messages, loading, loadingMore, hasMore, loadOlder, send, edit, remove, toggleReaction } =
    useDirectMessages({ conversationId: conversation.id, userId, profiles });

  const { typingNames, notifyTyping } = useTyping(conversation.id, userId, displayName);

  const other = conversation.otherProfile ?? null;
  const { startCall, status: callStatus, busyUsers } = useCall();
  const callBusy = callStatus !== "idle" && callStatus !== "ended";
  const peerBusy = other ? !!busyUsers[other.id] : false;
  const isGroup = conversation.type === "group";
  const title = isGroup ? (conversation.name ?? "Grupo") : (other?.display_name ?? "Conversa");

  useEffect(() => setReplyTo(null), [conversation.id]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 240;
    if (nearBottom) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Reading the conversation clears its unread badge.
  useEffect(() => {
    if (!userId) return;
    void conversationsService.markRead(conversation.id).catch(() => undefined);
  }, [conversation.id, messages.length, userId]);

  return (
    <>
      <header className="border-border bg-background/70 relative z-10 flex h-14 shrink-0 items-center gap-3 border-b px-5 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => (isGroup ? setMembersOpen(true) : other && onOpenProfile(other.id))}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className="relative">
            <Avatar className="ring-border h-8 w-8 ring-1">
              <AvatarImage src={(isGroup ? conversation.avatar_url : other?.avatar_url) ?? undefined} alt="" />
              <AvatarFallback className="bg-surface-elevated text-[11px]">
                {title.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!isGroup && other && (
              <StatusDot
                status={other.status as UserStatus}
                className="border-background absolute -right-0.5 -bottom-0.5 h-3 w-3 border-2"
              />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight">{title}</span>
            <span className="text-muted-foreground block truncate text-[11px]">
              {isGroup ? `${conversation.member_count} participantes` : `@${other?.username ?? "?"}`}
            </span>
          </span>
        </button>

        {!isGroup && other?.custom_status && (
          <span className="text-muted-foreground hidden truncate text-xs md:inline">
            <Gamepad2 className="mr-1 inline h-3 w-3" />
            {other.custom_status}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {!isGroup && other && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={callBusy || peerBusy}
                    aria-label="Chamada de voz"
                    onClick={() =>
                      void startCall(
                        {
                          id: other.id,
                          display_name: other.display_name,
                          username: other.username,
                          avatar_url: other.avatar_url ?? null,
                        },
                        false,
                      )
                    }
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {peerBusy ? "Em chamada" : "Chamada de voz"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={callBusy || peerBusy}
                    aria-label="Chamada de vídeo"
                    onClick={() =>
                      void startCall(
                        {
                          id: other.id,
                          display_name: other.display_name,
                          username: other.username,
                          avatar_url: other.avatar_url ?? null,
                        },
                        true,
                      )
                    }
                  >
                    <Video className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {peerBusy ? "Em chamada" : "Chamada de vídeo"}
                </TooltipContent>
              </Tooltip>
            </>
          )}
          {isGroup && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setMembersOpen(true)}>
                <Users className="mr-1.5 h-4 w-4" />
                Membros
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  try {
                    await conversationsService.leave(conversation.id);
                    toast.success("Você saiu do grupo.");
                    onLeft();
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                Sair
              </Button>
            </>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="scrollbar-slim bg-ambient flex-1 overflow-y-auto py-4">
        {loading && (
          <div className="space-y-5 px-5">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="bg-surface-elevated h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="bg-surface-elevated h-3 w-40" />
                  <Skeleton className="bg-surface-elevated h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <div className="flex justify-center pb-2">
            <Button size="sm" variant="ghost" onClick={() => void loadOlder()} disabled={loadingMore}>
              {loadingMore ? "Carregando..." : "Carregar mensagens anteriores"}
            </Button>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-foreground text-xl font-semibold tracking-tight">{title}</p>
            <p className="max-w-sm text-sm">Este é o começo da sua conversa. Manda a primeira.</p>
          </div>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const compact =
            !!previous &&
            previous.sender_id === message.sender_id &&
            !message.reply_to_id &&
            new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() <
              GROUP_WINDOW_MS;
          return (
            <DmMessageItem
              key={message.id}
              message={message}
              compact={compact}
              isOwn={message.sender_id === userId}
              onReply={setReplyTo}
              onEdit={edit}
              onDelete={remove}
              onReact={(id, emoji) => void toggleReaction(id, emoji)}
              onOpenProfile={onOpenProfile}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="text-muted-foreground flex h-5 items-center gap-1.5 px-6 text-xs">
        {typingNames.length > 0 && (
          <span className="truncate">
            <span className="text-foreground font-medium">{typingNames.slice(0, 3).join(", ")}</span>{" "}
            {typingNames.length === 1 ? "está digitando..." : "estão digitando..."}
          </span>
        )}
      </div>

      <DmComposer
        conversationId={conversation.id}
        placeholder={`Conversar com ${title}`}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTyping={notifyTyping}
        onSend={send}
      />

      {isGroup && (
        <GroupMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          conversation={conversation}
          userId={userId}
          onOpenProfile={onOpenProfile}
        />
      )}
    </>
  );
}
