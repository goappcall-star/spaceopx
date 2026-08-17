import { Hash, MessagesSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MessageComposer } from "@/components/chat/MessageComposer";
import { MessageItem } from "@/components/chat/MessageItem";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChannelMessages } from "@/hooks/use-messages";
import { useTyping } from "@/hooks/use-typing";
import { hasPermission } from "@/lib/permissions";
import { readStatesService } from "@/services/messages";
import type { Channel, MemberWithProfile, MessageWithMeta, Profile } from "@/types";

interface Props {
  serverId: string;
  channel: Channel;
  members: MemberWithProfile[];
  userId: string | undefined;
  me: MemberWithProfile | undefined;
  onRead: (channelId: string, messageId: string | null) => void;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function ChatView({ serverId, channel, members, userId, me, onRead }: Props) {
  const [replyTo, setReplyTo] = useState<MessageWithMeta | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const profiles = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const member of members) if (member.profile) map.set(member.profile.id, member.profile);
    return map;
  }, [members]);

  const canSend = hasPermission(me, "send_messages");
  const canModerate = hasPermission(me, "manage_channel");

  const { messages, loading, loadingMore, hasMore, loadOlder, send, edit, remove, toggleReaction } =
    useChannelMessages({ channelId: channel.id, serverId, userId, profiles, enabled: true });

  const displayName = me?.profile?.display_name ?? "Alguém";
  const { typingNames, notifyTyping } = useTyping(channel.id, userId, displayName);

  useEffect(() => {
    setReplyTo(null);
  }, [channel.id]);

  // Autoscroll on new messages when already near the bottom.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 240;
    if (nearBottom) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!userId || !last) return;
    onRead(channel.id, last.id);
    void readStatesService.markRead(channel.id, userId, last.id).catch(() => undefined);
  }, [messages, channel.id, userId, onRead]);

  return (
    <>
      <header className="border-border bg-background/70 relative z-10 flex h-14 shrink-0 items-center gap-2.5 border-b px-5 backdrop-blur-xl">
        <span className="bg-surface-elevated border-border text-primary flex h-7 w-7 items-center justify-center rounded-lg border">
          <Hash className="h-3.5 w-3.5" />
        </span>
        <h1 className="text-sm font-semibold tracking-tight">{channel.name}</h1>
        {channel.description && (
          <>
            <span className="bg-border h-4 w-px" />
            <p className="text-muted-foreground truncate text-xs">{channel.description}</p>
          </>
        )}
      </header>

      <div ref={scrollRef} className="scrollbar-slim bg-ambient flex-1 overflow-y-auto py-4">
        {loading && (
          <div className="space-y-5 px-5">
            {[0, 1, 2, 3].map((index) => (
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
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="surface-elevated glow-soft flex h-16 w-16 items-center justify-center rounded-2xl">
              <MessagesSquare className="text-primary h-7 w-7" />
            </span>
            <p className="text-foreground text-xl font-semibold tracking-tight">
              Comece a conversa em #{channel.name}
            </p>
            <p className="max-w-sm text-sm">
              Este é o início do canal. Mande a primeira mensagem e dê o tom.
            </p>
          </div>
        )}


        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const compact =
            !!previous &&
            previous.author_id === message.author_id &&
            !message.reply_to_id &&
            new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() <
              GROUP_WINDOW_MS;
          return (
            <MessageItem
              key={message.id}
              message={message}
              compact={compact}
              isOwn={message.author_id === userId}
              canDelete={message.author_id === userId || canModerate}
              onReply={setReplyTo}
              onEdit={edit}
              onDelete={remove}
              onReact={(id, emoji) => void toggleReaction(id, emoji)}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="text-muted-foreground flex h-5 items-center gap-1.5 px-6 text-xs">
        {typingNames.length > 0 && (
          <>
            <span className="flex gap-0.5" aria-hidden>
              <span className="bg-primary h-1 w-1 animate-bounce rounded-full [animation-delay:0ms]" />
              <span className="bg-primary h-1 w-1 animate-bounce rounded-full [animation-delay:120ms]" />
              <span className="bg-primary h-1 w-1 animate-bounce rounded-full [animation-delay:240ms]" />
            </span>
            <span className="truncate">
              <span className="text-foreground font-medium">
                {typingNames.slice(0, 3).join(", ")}
              </span>{" "}
              {typingNames.length === 1 ? "está digitando..." : "estão digitando..."}
            </span>
          </>
        )}
      </div>


      <MessageComposer
        serverId={serverId}
        channelId={channel.id}
        channelName={channel.name}
        members={members}
        disabled={!canSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTyping={notifyTyping}
        onSend={send}
      />
    </>
  );
}
