import { Paperclip, SendHorizonal, Smile, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { QUICK_EMOJIS } from "@/components/chat/MessageItem";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, uploadsService, validateFile } from "@/services/uploads";
import type { Attachment, MemberWithProfile, MessageWithMeta } from "@/types";

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
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestions =
    mentionQuery === null
      ? []
      : members
          .filter((m) => (m.profile?.username ?? "").includes(mentionQuery.toLowerCase()))
          .slice(0, 6);

  function handleChange(next: string) {
    setValue(next);
    onTyping();
    const match = /(?:^|\s)@([a-z0-9_.-]*)$/i.exec(next);
    setMentionQuery(match ? (match[1] ?? "") : null);
  }

  function applyMention(username: string) {
    setValue((prev) => prev.replace(/(?:^|\s)@([a-z0-9_.-]*)$/i, (m) => `${m.startsWith(" ") ? " " : ""}@${username} `));
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
      const mentioned = members
        .filter((m) => m.profile && value.includes(`@${m.profile.username}`))
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
      toast.error((error as Error).message ?? "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-border bg-background shrink-0 border-t px-4 pt-2 pb-4">
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
                onClick={() => setAttachments((prev) => prev.filter((a) => a.path !== attachment.path))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        {suggestions.length > 0 && (
          <ul className="border-border bg-popover absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-lg border shadow-lg">
            {suggestions.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  onClick={() => applyMention(member.profile?.username ?? "")}
                >
                  <span className="font-medium">{member.profile?.display_name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    @{member.profile?.username}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-border bg-surface focus-within:border-primary/60 focus-within:shadow-glow flex items-end gap-1 rounded-xl border px-2 py-1.5 transition-all">
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
            className="h-9 w-9"
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
            placeholder={disabled ? "Sem permissão para enviar mensagens" : `Conversar em #${channelName}`}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none focus-visible:ring-0"
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Emojis">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1.5" align="end">
              <div className="flex gap-1">
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
            className="h-9 w-9"
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
