import { Paperclip, SendHorizonal, Smile, X } from "lucide-react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { moderationError } from "@/lib/community-moderation";
import {
  completeMention,
  mentionOptions,
  mentionQueryAt,
  mentionedUsernames,
  type MentionQuery,
} from "@/lib/chat-mentions";

import { QUICK_EMOJIS } from "@/components/chat/MessageItem";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, uploadsService, validateFile } from "@/services/uploads";
import type { Attachment, MemberWithProfile, MessageWithMeta } from "@/types";
import "./message-composer.css";

interface Props {
  serverId: string;
  channelId: string;
  channelName: string;
  members: MemberWithProfile[];
  disabled: boolean;
  replyTo: MessageWithMeta | null;
  onCancelReply: () => void;
  onTyping: () => void;
  onSend: (input: {
    content: string;
    replyToId?: string | null;
    attachments?: Attachment[];
    mentions?: string[];
  }) => Promise<void>;
}

export function MessageComposer({
  serverId,
  channelId,
  channelName,
  members,
  disabled,
  replyTo,
  onCancelReply,
  onTyping,
  onSend,
}: Props) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
  const [activeMention, setActiveMention] = useState(0);
  const listId = useId();
  const pendingCaret = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => (mentionQuery === null ? [] : mentionOptions(members, mentionQuery.query)),
    [members, mentionQuery],
  );
  const selectedMention = Math.min(activeMention, Math.max(0, suggestions.length - 1));

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  function updateMention(next: string, caret: number) {
    setMentionQuery(mentionQueryAt(next, caret));
    setActiveMention(0);
  }

  function handleChange(next: string, caret: number) {
    setValue(next);
    onTyping();
    updateMention(next, caret);
  }

  function applyMention(username: string) {
    if (!mentionQuery) return;
    const next = completeMention(value, mentionQuery, username);
    pendingCaret.current = next.caret;
    setValue(next.content);
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const invalid = validateFile(file);
        if (invalid) {
          toast.error(`${file.name}: ${invalid}`);
          continue;
        }
        const uploaded = await uploadsService.upload(serverId, channelId, file);
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (error) {
      toast.error((error as Error).message ?? "Falha no upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (disabled || sending) return;
    if (!value.trim() && attachments.length === 0) return;
    setSending(true);
    try {
      const usernames = mentionedUsernames(value);
      const mentioned = members
        .filter(
          (m) =>
            m.profile &&
            m.profile.username.toLowerCase() !== "todos" &&
            usernames.has(m.profile.username.toLowerCase()),
        )
        .map((m) => m.user_id);
      await onSend({
        content: value,
        replyToId: replyTo?.id ?? null,
        attachments,
        mentions: mentioned,
      });
      setValue("");
      setAttachments([]);
      onCancelReply();
    } catch (error) {
      toast.error(
        /community_spam_/.test(String((error as Error)?.message))
          ? moderationError(error)
          : ((error as Error).message ?? "Não foi possível enviar."),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="message-composer shrink-0 px-4 pt-2 pb-4">
      {replyTo && (
        <div className="border-border bg-surface-elevated text-muted-foreground mb-2 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs">
          <span>
            Respondendo a{" "}
            <span className="text-primary">{replyTo.author?.display_name ?? "Usuário"}</span>
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto h-6 w-6"
            aria-label="Cancelar resposta"
            onClick={onCancelReply}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <span
              key={attachment.path}
              className="border-border bg-surface-elevated flex items-center gap-2 rounded-lg border px-2 py-1 text-xs"
            >
              {attachment.name} · {formatBytes(attachment.size)}
              <button
                type="button"
                aria-label="Remover anexo"
                onClick={() =>
                  setAttachments((prev) => prev.filter((a) => a.path !== attachment.path))
                }
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        {suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Sugestões de menção"
            className="border-border bg-surface-elevated absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-xl border shadow-[var(--shadow-overlay)]"
          >
            {suggestions.map((option, index) => (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`${listId}-${index}`}
                  aria-selected={index === selectedMention}
                  tabIndex={-1}
                  className={`hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${index === selectedMention ? "bg-accent" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyMention(option.username)}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground font-friend font-semibold tracking-normal text-xs">
                    @{option.username}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="message-composer-surface flex items-end gap-1 rounded-2xl px-2 py-1.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            aria-label="Anexar arquivo"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Textarea
            ref={inputRef}
            rows={1}
            value={value}
            disabled={disabled}
            placeholder={
              disabled ? "Sem permissão para enviar mensagens" : `Conversar em #${channelName}`
            }
            onChange={(event) => handleChange(event.target.value, event.target.selectionStart)}
            onClick={(event) => updateMention(value, event.currentTarget.selectionStart)}
            onKeyUp={(event) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
                updateMention(value, event.currentTarget.selectionStart);
            }}
            aria-label={`Mensagem em ${channelName}`}
            aria-controls={suggestions.length ? listId : undefined}
            aria-expanded={suggestions.length > 0}
            aria-autocomplete="list"
            aria-activedescendant={suggestions.length ? `${listId}-${selectedMention}` : undefined}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (
                suggestions.length &&
                ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key) &&
                !event.shiftKey
              ) {
                event.preventDefault();
                if (event.key === "Escape") setMentionQuery(null);
                else if (event.key === "ArrowDown" || event.key === "ArrowUp")
                  setActiveMention(
                    (selectedMention + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) %
                      suggestions.length,
                  );
                else applyMention(suggestions[selectedMention]!.username);
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            className="max-h-40 min-h-9 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none hover:border-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label="Emojis">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1.5" align="end">
              <div className="grid grid-cols-4 gap-1 sm:flex">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="hover:bg-accent rounded p-1 text-base"
                    onClick={() => setValue((prev) => prev + emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Enviar mensagem"
            disabled={disabled || sending || uploading}
            onClick={() => void submit()}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
