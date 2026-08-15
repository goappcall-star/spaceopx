import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/types";

export const rolesService = {
  async listByServer(serverId: string): Promise<Role[]> {
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .eq("server_id", serverId)
      .order("position", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Role[];
  },
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MEMBER: "Membro",
};

export function roleLabel(name: string) {
  return ROLE_LABELS[name] ?? name;
}
