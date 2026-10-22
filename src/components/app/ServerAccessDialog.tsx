import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { serversService } from "@/services/servers";
import { invitesService, inviteErrorMessage } from "@/services/invites";
import { profileImagesService } from "@/services/profile-images";
import { ServerAccessDialogView, type ServerAccessMode } from "./ServerAccessDialogView";

export function ServerAccessDialog({
  open,
  onOpenChange,
  onCompleted,
  initialMode = "create",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (id: string) => void;
  initialMode?: ServerAccessMode;
}) {
  const { user } = useAuth(),
    client = useQueryClient();
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  const currentUser = useRef(user?.id);
  currentUser.current = user?.id;
  useEffect(() => {
    uploaded.current = null;
  }, [open, user?.id]);
  if (!open) return null;
  const ensureUser = (id?: string) => {
    if (!id || currentUser.current !== id)
      throw Error("Sua conta mudou. Reabra esta janela para continuar.");
  };
  async function complete(id: string, uid: string, refreshAll = false) {
    ensureUser(uid);
    await Promise.allSettled(
      refreshAll
        ? [client.invalidateQueries()]
        : [
            client.invalidateQueries({ queryKey: ["servers"] }),
            client.invalidateQueries({ queryKey: ["members", id] }),
            client.invalidateQueries({ queryKey: ["channels", id] }),
          ],
    );
    ensureUser(uid);
    onCompleted(id);
  }
  return (
    <ServerAccessDialogView
      key={user?.id ?? "signed-out"}
      open
      initialMode={initialMode}
      onOpenChange={onOpenChange}
      onCreate={async (draft) => {
        const uid = user?.id;
        ensureUser(uid);
        let iconUrl: string | undefined;
        if (draft.iconFile) {
          if (uploaded.current?.file === draft.iconFile) iconUrl = uploaded.current.url;
          else {
            iconUrl = await profileImagesService.upload("avatars", uid!, draft.iconFile);
            uploaded.current = { file: draft.iconFile, url: iconUrl };
          }
        }
        ensureUser(uid);
        const id = await serversService.create({
          name: draft.name,
          description: draft.description,
          theme: draft.theme,
          visibility: draft.visibility,
          ...(iconUrl ? { iconUrl } : {}),
        });
        await complete(id, uid!);
        toast.success("Servidor criado com cargos e canal #geral.");
      }}
      onJoin={async (code) => {
        const uid = user?.id;
        ensureUser(uid);
        try {
          const id = await invitesService.join(code);
          await complete(id, uid!, true);
          toast.success("Você entrou no servidor.");
        } catch (e) {
          throw Error(inviteErrorMessage(e));
        }
      }}
      onPreview={async (code) => {
        try {
          return await invitesService.preview(code);
        } catch (e) {
          throw Error(inviteErrorMessage(e));
        }
      }}
    />
  );
}
