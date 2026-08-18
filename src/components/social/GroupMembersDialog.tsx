import { StatusDot } from "@/components/app/StatusDot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConversationMembers } from "@/hooks/use-social";
import type { ConversationOverview, UserStatus } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationOverview;
  userId: string | undefined;
  onOpenProfile: (userId: string) => void;
}

export function GroupMembersDialog({
  open,
  onOpenChange,
  conversation,
  userId,
  onOpenProfile,
}: Props) {
  const { data: members = [] } = useConversationMembers(open ? conversation.id : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{conversation.name ?? "Grupo"}</DialogTitle>
          <DialogDescription>{members.length} participantes nesta conversa.</DialogDescription>
        </DialogHeader>

        <div className="scrollbar-slim max-h-80 space-y-1 overflow-y-auto">
          {members.map((member) => {
            const profile = member.profile;
            const name = profile?.display_name ?? "Usuário";
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => profile && onOpenProfile(profile.id)}
                className="hover:bg-surface-elevated flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors"
              >
                <span className="relative">
                  <Avatar className="ring-border h-8 w-8 ring-1">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-surface-elevated text-[11px]">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {profile && (
                    <StatusDot
                      status={profile.status as UserStatus}
                      className="border-background absolute -right-0.5 -bottom-0.5 h-3 w-3 border-2"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{name}</span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    @{profile?.username ?? "?"}
                  </span>
                </span>
                {profile?.id === userId && (
                  <span className="text-muted-foreground text-[11px]">você</span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
