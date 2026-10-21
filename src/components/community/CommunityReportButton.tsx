import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReportForm } from "./ModerationViews";
import { moderationService } from "@/services/community-moderation";
import { moderationError } from "@/lib/community-moderation";
import type { ReportKind } from "@/types/community-moderation";
interface ReportButtonProps {
  serverId: string;
  kind: ReportKind;
  targetId: string;
  compact?: boolean;
}
export function CommunityReportButton(props: ReportButtonProps) {
  const { user } = useAuth();
  return user ? (
    <SessionReportButton
      key={`${user.id}:${props.serverId}:${props.kind}:${props.targetId}`}
      {...props}
    />
  ) : null;
}
function SessionReportButton({ serverId, kind, targetId, compact = false }: ReportButtonProps) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [id, setId] = useState(() => crypto.randomUUID()),
    [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        aria-label="Denunciar"
        title="Denunciar"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        className={compact ? "h-7 w-7" : ""}
        onClick={() => {
          setOpen(true);
          setError(null);
          setId(crypto.randomUUID());
        }}
      >
        <Flag className="h-3.5 w-3.5" />
        {!compact && "Denunciar"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>
            Denunciar {kind === "directory" ? "comunidade pública" : "conteúdo ou membro"}
          </DialogTitle>
          <DialogDescription>
            A denúncia será enviada à equipe autorizada. Não inclua dados pessoais desnecessários.
          </DialogDescription>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <ReportForm
            kind={kind}
            targetId={targetId}
            busy={busy}
            onSubmit={(category, description) => {
              if (busy) return;
              setBusy(true);
              void moderationService
                .submit(id, serverId, kind, targetId, category, description)
                .then(() => {
                  if (!mounted.current) return;
                  toast.success("Denúncia registrada ou vinculada à solicitação pendente.");
                  setOpen(false);
                })
                .catch((e) => {
                  if (mounted.current) setError(moderationError(e));
                })
                .finally(() => {
                  if (mounted.current) setBusy(false);
                });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
