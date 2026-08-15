import { Check, CornerUpLeft, Pencil, SmilePlus, Trash2, X } from "lucide-react";
import { memo, useState } from "react";

import { AttachmentView } from "@/components/chat/AttachmentView";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MessageWithMeta } from "@/types";

export const QUICK_EMOJIS = ["🔥", "😂", "👍", "🎮", "💀", "❤️", "🚀", "👀"];

interface Props {
  message: MessageWithMeta;
  canDelete: boolean;
  isOwn: boolean;
  compact: boolean;
  onReply: (message: MessageWithMeta) => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReact: (id: string, emoji: string) => void;
}

function renderContent(content: string) {
  return content.split(/(@[a-z0-9_.-]+)/gi).map((part, index) =>
    part.startsWith("@") ? (
      <span key={index} className="bg-primary/15 text-primary rounded px-1 font-medium">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const MessageItem = memo(function MessageItem({
  message,
  canDelete,
  isOwn,
  compact,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const name = message.author?.display_name ?? "Usuário";

  return (
    <div
      className={cn(
        "group hover:bg-surface/60 relative flex gap-3 rounded-lg px-3 transition-colors",
        compact ? "py-0.5" : "mt-3 py-1.5",
      )}
    >
      <div className="w-9 shrink-0">
        {compact ? (
          <span className="text-muted-foreground mt-1 hidden text-[10px] group-hover:block">
            {time(message.created_at)}
          </span>
        ) : (
          <Avatar className="ring-border h-9 w-9 ring-1">
            <AvatarImage src={message.author?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-secondary text-xs">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {message.replyTo && (
          <p className="text-muted-foreground mb-0.5 flex items-center gap-1.5 truncate text-xs">
            <CornerUpLeft className="h-3 w-3" />
            <span className="text-primary">
              {message.replyTo.author?.display_name ?? "Usuário"}
            </span>
            <span className="truncate opacity-80">{message.replyTo.content.slice(0, 90)}</span>
          </p>
        )}

        {!compact && (
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-muted-foreground font-mono text-[11px]">
              @{message.author?.username ?? "?"}
            </span>
            <span className="text-muted-foreground text-[11px]">{time(message.created_at)}</span>
          </p>
        )}

        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-16 text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  if (draft.trim()) await onEdit(message.id, draft);
                  setEditing(false);
                }}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="mr-1 h-3.5 w-3.5" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-foreground/90 text-sm break-words whitespace-pre-wrap">
            {renderContent(message.content)}
            {message.edited_at && (
              <span className="text-muted-foreground ml-1.5 text-[10px]">(editada)</span>
            )}
          </p>
        )}

        {message.attachments.map((attachment) => (
          <AttachmentView key={attachment.path} attachment={attachment} />
        ))}

        {message.reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => onReact(message.id, reaction.emoji)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                  reaction.mine
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:border-primary/40",
                )}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-border bg-surface absolute -top-3 right-3 hidden items-center gap-0.5 rounded-lg border p-0.5 shadow-md group-hover:flex">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Reagir">
              <SmilePlus className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1.5" align="end">
            <div className="flex gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(message.id, emoji)}
                  className="hover:bg-accent rounded p-1 text-base"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Responder"
          onClick={() => onReply(message)}
        >
          <CornerUpLeft className="h-3.5 w-3.5" />
        </Button>
        {isOwn && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Editar"
            onClick={() => {
              setDraft(message.content);
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {canDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive h-7 w-7"
            aria-label="Excluir"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDelete(message.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
