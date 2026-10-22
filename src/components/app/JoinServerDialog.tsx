import { ServerAccessDialog } from "./ServerAccessDialog";

export function JoinServerDialog({
  open,
  onOpenChange,
  onJoined,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: (serverId: string) => void;
}) {
  return (
    <ServerAccessDialog
      open={open}
      onOpenChange={onOpenChange}
      onCompleted={onJoined}
      initialMode="join"
    />
  );
}
