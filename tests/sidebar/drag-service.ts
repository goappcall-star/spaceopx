import type { ServerCategory, Channel } from "../../src/types";
export let categories: ServerCategory[] = ["GERAL", "JOGOS", "AMIGOS"].map((name, position) => ({
  id: name,
  server_id: "fixture",
  name,
  position,
  created_at: "2026-10-05",
}));
export let channels: Channel[] = [
  {
    id: "voice",
    server_id: "fixture",
    category_id: "GERAL",
    name: "Bate-papo",
    type: "voice",
    description: null,
    position: 0,
    created_at: "2026-10-05",
    updated_at: "2026-10-05",
  },
];
export const categoriesService = {
  async list() {
    return [...categories];
  },
  async reorder(serverId: string, next: ServerCategory[]) {
    if (serverId !== "fixture") throw Error("No real server permitted");
    categories = next.map((category, position) => ({ ...category, position }));
  },
  async assignChannel(serverId: string, id: string, categoryId: string | null) {
    if (serverId !== "fixture") throw Error("No real server permitted");
    channels = channels.map((channel) =>
      channel.id === id ? { ...channel, category_id: categoryId } : channel,
    );
  },
};
