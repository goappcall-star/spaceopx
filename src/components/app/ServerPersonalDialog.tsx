import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { membersService } from "@/services/members";
import { supabase } from "@/integrations/supabase/client";
import type { Server } from "@/types";

export function ServerPersonalDialog({
  server,
  action,
  userId,
  onClose,
  onLeft,
}: {
  server: Server;
  action: "profile" | "privacy" | "leave";
  userId: string;
  onClose: () => void;
  onLeft: (serverId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<boolean | null>(null);
  const membership = useQuery({
    queryKey: ["my-membership", server.id, userId],
    queryFn: () => membersService.getMyMembership(server.id, userId),
  });
  const dmPrivacy = useQuery({
    queryKey: ["server-dm-privacy", server.id, userId],
    enabled: action === "privacy",
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_server_dm_privacy", {
        _server_id: server.id,
      });
      if (error) throw error;
      return data;
    },
  });
  const isOwner = server.owner_id === userId;
  const mutation = useMutation({
    mutationFn: async () => {
      if (!membership.data) throw new Error("membership_missing");
      if (action === "leave") {
        if (isOwner) throw new Error("owner_cannot_leave");
        await membersService.leave(membership.data.id);
      } else if (action === "profile") {
        await membersService.updateNickname(
          membership.data.id,
          nickname ?? membership.data.nickname,
        );
      } else {
        if (dmPrivacy.data === undefined) throw new Error("privacy_unavailable");
        const { error } = await supabase.rpc("set_server_dm_privacy", {
          _server_id: server.id,
          _allow: privacy ?? dmPrivacy.data,
        });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      if (action === "leave") {
        await queryClient.cancelQueries({ queryKey: ["servers"] });
        onLeft(server.id);
        queryClient.setQueryData<Server[]>(["servers"], (items) =>
          items?.filter((s) => s.id !== server.id),
        );
        void queryClient.invalidateQueries({ queryKey: ["servers"] });
      }
      void queryClient.invalidateQueries({ queryKey: ["members", server.id] });
      void queryClient.invalidateQueries({ queryKey: ["my-membership", server.id, userId] });
      void queryClient.invalidateQueries({ queryKey: ["server-dm-privacy", server.id, userId] });
      toast.success(action === "leave" ? "Você saiu do servidor." : "Alterações salvas.");
      onClose();
    },
    onError: () => toast.error("Não foi possível concluir a operação. Tente novamente."),
  });
  const title = {
    profile: "Editar perfil por servidor",
    privacy: "Config. de privacidade",
    leave: "Sair do servidor",
  }[action];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{server.name}</DialogDescription>
        </DialogHeader>
        {action === "profile" && (
          <div className="space-y-2">
            <Label htmlFor="server-nickname">Apelido neste servidor</Label>
            <Input
              id="server-nickname"
              maxLength={32}
              disabled={!membership.data || mutation.isPending}
              value={nickname ?? membership.data?.nickname ?? ""}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Usar meu nome de perfil"
            />
            <p className="text-muted-foreground text-sm">
              Seu nome global e avatar continuam os mesmos. Deixe vazio para usar seu nome de
              perfil.
            </p>
          </div>
        )}
        {action === "privacy" &&
          (dmPrivacy.isError ? (
            <p role="alert" className="text-destructive text-sm">
              As configurações de privacidade ainda não estão disponíveis. Tente novamente mais
              tarde.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="server-dms">Permitir mensagens diretas de membros</Label>
                <Switch
                  id="server-dms"
                  disabled={dmPrivacy.data === undefined || mutation.isPending}
                  checked={privacy ?? dmPrivacy.data ?? true}
                  onCheckedChange={setPrivacy}
                />
              </div>
              <p className="text-muted-foreground text-sm">
                Ao desativar, membros deste servidor que não são seus amigos não poderão enviar
                mensagens diretas para você, mesmo em conversas existentes. Seus amigos continuam
                podendo conversar.
              </p>
            </div>
          ))}
        {action === "leave" && (
          <p className="text-sm">
            {isOwner
              ? "Você é o proprietário deste servidor. Transfira a propriedade antes de sair ou use a opção de excluir nas configurações do servidor."
              : "Você perderá o acesso aos canais. Para voltar a um servidor privado, precisará de um novo convite. Deseja sair?"}
          </p>
        )}
        {membership.isError && (
          <p role="alert" className="text-destructive text-sm">
            Não foi possível carregar sua participação no servidor.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={action === "leave" ? "destructive" : "default"}
            disabled={
              mutation.isPending ||
              !membership.data ||
              (action === "leave" && isOwner) ||
              (action === "privacy" && dmPrivacy.data === undefined)
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Aguarde..." : action === "leave" ? "Sair do servidor" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
