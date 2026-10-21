import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CommunityModerationConsole } from "./CommunityModerationConsole";
import { CommunityReportButton } from "./CommunityReportButton";
import type { ModerationPerson } from "./ModerationViews";
export function CommunitySafetyTools({
  serverId,
  userId,
  people,
  roles,
}: {
  serverId: string;
  userId: string;
  people: ModerationPerson[];
  roles: ModerationPerson[];
}) {
  const [open, setOpen] = useState(false),
    [target, setTarget] = useState("");
  return (
    <div className="border-border bg-surface flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Moderação e minhas solicitações
      </Button>
      <label className="sr-only" htmlFor="community-report-target">
        Alvo da denúncia
      </label>
      <select
        id="community-report-target"
        className="bg-background border-border h-8 max-w-52 rounded-lg border px-2 text-xs"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">Denunciar um membro…</option>
        {people
          .filter((p) => p.id !== userId)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>
      {target && (
        <CommunityReportButton key={target} serverId={serverId} kind="member" targetId={target} />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogTitle>Central da Comunidade · Moderação</DialogTitle>
          <DialogDescription>
            Os recursos disponíveis dependem das suas permissões atuais.
          </DialogDescription>
          <CommunityModerationConsole
            key={`${userId}:${serverId}`}
            userId={userId}
            serverId={serverId}
            people={people}
            roles={roles}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
