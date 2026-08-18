import { ImagePlus, Paperclip, SendHorizonal, Smile, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { QUICK_EMOJIS } from "@/components/chat/MessageItem";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { dmUploadsService } from "@/services/social";
import { formatBytes } from "@/services/uploads";
import type { Attachment, DirectMessageWithMeta } from "@/types";

interface Props {
  conversationId: string;
  placeholder: string;
  replyTo: DirectMessageWithMeta | null;
  onCancelReply: () => void;
  onTyping: () => void;
  onSend: (input: {
    content: string;
    replyToId?: string | null;
    attachments?: Attachment[];
  }) => Promise<void>;
}

export function DmComposer({
  conversationId,
  placeholder,
  replyTo,
  onCancelReply,
  onTyping,
  onSend,
}: Props) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await dmUploadsService.upload(conversationId, file);
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (error) {
      toast.error((error as Error).message ?? "Falha no upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (imageRef.current) imageRef.current.value = "";
    }
  }

  async function submit() {
    if (sending) return;
    if (!value.trim() && attachments.length === 0) return;
    setSending(true);
    try {
      await onSend({ content: value, replyToId: replyTo?.id ?? null, attachments });
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
          <span className="truncate">
            Respondendo a{" "}
            <span className="text-primary">{replyTo.author?.display_name ?? "Usuário"}</span>:{" "}
            <span className="opacity-80">“{replyTo.content.slice(0, 60)}”</span>
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

      <div className="border-border bg-surface-elevated focus-within:border-primary/60 focus-within:shadow-glow flex items-end gap-1 rounded-2xl border px-2 py-1.5 transition-all duration-200">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <input
          ref={imageRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          aria-label="Enviar imagem ou GIF"
          disabled={uploading}
          onClick={() => imageRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          aria-label="Anexar arquivo"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Textarea
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            setValue(event.target.value);
            onTyping();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          className="max-h-40 min-h-9 resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none hover:border-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
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
          disabled={sending || uploading}
          onClick={() => void submit()}
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
