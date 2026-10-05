import { supabase } from "@/integrations/supabase/client";
import type { ServerCategory } from "@/types";
function validName(name: string) {
  const value = name.trim();
  if (!value || value.length > 80) throw new Error("Use um nome de 1 a 80 caracteres.");
  return value;
}
export const categoriesService = {
  async reorder(serverId: string, categories: ServerCategory[]) {
    if (categories.some((category) => category.server_id !== serverId))
      throw new Error("Categoria de outro servidor.");
    const { error } = await supabase.from("server_categories").upsert(
      categories.map((category, position) => ({ ...category, position })),
      { onConflict: "id" },
    );
    if (error) throw error;
  },
  async list(serverId: string): Promise<ServerCategory[]> {
    const { data, error } = await supabase
      .from("server_categories")
      .select("*")
      .eq("server_id", serverId)
      .order("position")
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  },
  async create(serverId: string, name: string, position: number) {
    const { data, error } = await supabase
      .from("server_categories")
      .insert({ server_id: serverId, name: validName(name), position })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async rename(serverId: string, id: string, name: string) {
    const { error } = await supabase
      .from("server_categories")
      .update({ name: validName(name) })
      .eq("server_id", serverId)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
  },
  async remove(serverId: string, id: string) {
    const { error } = await supabase
      .from("server_categories")
      .delete()
      .eq("server_id", serverId)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
  },
  async assignChannel(serverId: string, channelId: string, categoryId: string | null) {
    const { error } = await supabase
      .from("channels")
      .update({ category_id: categoryId })
      .eq("server_id", serverId)
      .eq("id", channelId)
      .select()
      .single();
    if (error) throw error;
  },
};
