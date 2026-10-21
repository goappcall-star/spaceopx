import { supabase } from "@/integrations/supabase/client";
import { validateCommunityPayload, parseCommunitySettings } from "@/lib/community-validation";
import type { CommunityPayload, CommunityState } from "@/types/community";
import type { Json } from "@/integrations/supabase/types";

export function communityErrorMessage(error: unknown) {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  if (/community_revision_conflict|40001/.test(raw))
    return "A configuração mudou em outra sessão. Atualize a tela antes de salvar.";
  if (/community_owner_required/.test(raw))
    return "Somente o proprietário pode delegar a gestão da comunidade.";
  if (/community_not_authorized|42501/.test(raw))
    return "Você não tem autorização para gerenciar esta comunidade.";
  if (/community_role_ineligible/.test(raw))
    return "Escolha um cargo específico. OWNER e MEMBER não podem receber esta delegação.";
  if (/community_invalid_channel/.test(raw))
    return "O canal de boas-vindas não está mais disponível ou não pode ser usado. Escolha outro canal.";
  if (/community_invalid/.test(raw))
    return "Confira as regras, o canal, a categoria e os interesses.";
  if (/Muitos envios/.test(raw))
    return "Muitas alterações em sequência. Aguarde antes de tentar novamente.";
  if (/PGRST202|Could not find the function|does not exist/.test(raw))
    return "O backend de comunidades ainda não está disponível neste ambiente. A Fase 1 exige a migration local.";
  return "Não foi possível concluir a operação da comunidade. Confira a conexão e tente novamente.";
}

function projectedForServer(value: unknown, serverId: string) {
  const settings = parseCommunitySettings(value);
  if (settings.server_id !== serverId.toLowerCase()) throw Error("community_invalid_response");
  return settings;
}
export const communitiesService = {
  async get(serverId: string): Promise<CommunityState> {
    const { data, error } = await supabase.rpc("get_server_community", { _server_id: serverId });
    if (error) throw error;
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data["can_manage"] !== "boolean" ||
      typeof data["is_owner"] !== "boolean"
    )
      throw Error("community_invalid_response");
    return {
      can_manage: data["can_manage"],
      is_owner: data["is_owner"],
      settings: data["settings"] == null ? null : projectedForServer(data["settings"], serverId),
    };
  },
  async save(serverId: string, payload: CommunityPayload, revision: number) {
    const clean = validateCommunityPayload(payload);
    const { data, error } = await supabase.rpc("save_server_community", {
      _server_id: serverId,
      _payload: clean as unknown as Json,
      _expected_revision: revision,
    });
    if (error) throw error;
    return projectedForServer(data, serverId);
  },
  async disable(serverId: string, revision: number) {
    const { data, error } = await supabase.rpc("disable_server_community", {
      _server_id: serverId,
      _expected_revision: revision,
    });
    if (error) throw error;
    return projectedForServer(data, serverId);
  },
  async delegate(serverId: string, roleId: string, enabled: boolean) {
    const { error } = await supabase.rpc("set_community_role_permission", {
      _server_id: serverId,
      _role_id: roleId,
      _enabled: enabled,
    });
    if (error) throw error;
  },
};
