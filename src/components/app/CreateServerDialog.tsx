import { ServerAccessDialog } from "./ServerAccessDialog";

export function CreateServerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (serverId: string) => void;
}) {
  return (
    <ServerAccessDialog
      open={open}
      onOpenChange={onOpenChange}
      onCompleted={onCreated}
      initialMode="create"
    />
  );
}
