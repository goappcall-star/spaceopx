import { supabase } from "@/integrations/supabase/client";
import type { InvitePreview, ServerInvite } from "@/types";

export const INVITE_ERRORS: Record<string, string> = {
  invite_not_found: "Convite inválido ou inexistente.",
  server_not_found: "O servidor deste convite não existe mais.",
  invite_expired: "Este convite expirou.",
  invite_exhausted: "Este convite atingiu o limite de usos.",
  not_authenticated: "Você precisa entrar na sua conta.",
  not_authorized: "Você não tem permissão para isso.",
};

export function inviteErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const key = Object.keys(INVITE_ERRORS).find((k) => raw.includes(k));
  return key ? INVITE_ERRORS[key] : "Não foi possível concluir a operação.";
}

export const invitesService = {
  async listByServer(serverId: string): Promise<ServerInvite[]> {
    const { data, error } = await supabase
      .from("server_invites")
      .select("*")
      .eq("server_id", serverId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ServerInvite[];
  },

  /** Validated server-side: only OWNER/ADMIN can mint a code. */
  async create(serverId: string, maxUses?: number | null, expiresInHours?: number | null) {
    const { data, error } = await supabase.rpc("create_server_invite", {
      _server_id: serverId,
      _max_uses: maxUses ?? undefined,
      _expires_in_hours: expiresInHours ?? 168,
    });
    if (error) throw error;
    return data as string;
  },

  async preview(code: string): Promise<InvitePreview | null> {
    const { data, error } = await supabase.rpc("get_invite_preview", { _code: code });
    if (error) throw error;
    const rows = (data ?? []) as InvitePreview[];
    return rows[0] ?? null;
  },

  /** Atomic join: membership + MEMBER role + usage counter. */
  async join(code: string): Promise<string> {
    const { data, error } = await supabase.rpc("join_server_by_invite", { _code: code });
    if (error) throw error;
    return data as string;
  },

  async revoke(inviteId: string) {
    const { error } = await supabase.from("server_invites").delete().eq("id", inviteId);
    if (error) throw error;
  },
};

export function inviteUrl(code: string) {
  if (typeof window === "undefined") return `/invite/${code}`;
  return `${window.location.origin}/invite/${code}`;
}
