import { AccessibilitySettings } from "@/components/settings/AccessibilitySettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { ProfileSettingsEditor } from "@/components/settings/ProfileSettingsEditor";
import {
  SettingsShell,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/components/settings/SettingsShell";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { DesktopPermissions } from "@/components/gamer/DesktopPermissions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Gamepad2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useFavoriteGames, useGames } from "@/hooks/use-gamer";
import { favoriteGamesService, MAX_FAVORITE_GAMES } from "@/services/gamer";

export const Route = createFileRoute("/_authenticated/settings_/profile")({
  validateSearch: z.object({ section: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Seu perfil — LobbyX" },
      {
        name: "description",
        content:
          "Personalize seu perfil gamer no LobbyX: avatar, banner, bio, molduras e tema neon.",
      },
      { property: "og:title", content: "Seu perfil — LobbyX" },
      {
        property: "og:description",
        content: "Avatar, banner, bio, jogos favoritos, XP, badges e personalização visual.",
      },
    ],
  }),
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  const search = Route.useSearch();
  const section: SettingsSection = SETTINGS_SECTIONS.some(
    (item) => item.id === search.section && item.id !== "voice",
  )
    ? (search.section as SettingsSection)
    : "profile";
  if (section === "profile") return <ProfileSettingsEditor />;
  if (section === "accessibility")
    return (
      <SettingsShell active="accessibility">
        <AccessibilitySettings />
      </SettingsShell>
    );
  if (section === "appearance")
    return (
      <SettingsShell active="appearance">
        <AppearanceSettings />
      </SettingsShell>
    );
  return <OtherSettingsPage section={section} />;
}

function OtherSettingsPage({ section }: { section: SettingsSection }) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const { data: games = [] } = useGames();
  const { data: favorites = [] } = useFavoriteGames(userId);
  const [gameToAdd, setGameToAdd] = useState<string>("");

  const favoritesMutation = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorite-games", userId] }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar os jogos."),
  });

  function move(index: number, delta: number) {
    const next = [...favorites];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    favoritesMutation.mutate(() => favoriteGamesService.reorder(next.map((f) => f.id)));
  }

  const availableGames = games.filter((g) => !favorites.some((f) => f.game_id === g.id));

  return (
    <SettingsShell active={section}>
      {section === "account" && <AccountSettings />}
      {(["games", "privacy", "system"] as string[]).includes(section) && (
        <DesktopPermissions mode={section as "games" | "privacy" | "system"} />
      )}
      <div className="max-w-3xl">
        {/* ------------------------------------------------------- editor */}
        <div className="space-y-6">
          {/* ----------------------------------------------- favorite games */}
          {section === "favorites" && (
            <section className="glass-panel p-6">
              <h2 className="mb-1 text-base font-semibold">Jogos favoritos</h2>
              <p className="text-muted-foreground mb-4 text-xs">
                Até {MAX_FAVORITE_GAMES} jogos, na ordem que você definir.
              </p>
              <ul className="space-y-2">
                {favorites.map((fav, index) => (
                  <li
                    key={fav.id}
                    className="bg-surface border-border flex items-center gap-2 rounded-lg border p-2"
                  >
                    <Gamepad2 className="text-primary h-4 w-4" />
                    <span className="flex-1 truncate text-sm">{fav.game?.name}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Subir"
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Descer"
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Remover"
                      onClick={() =>
                        favoritesMutation.mutate(() => favoriteGamesService.remove(fav.id))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              {favorites.length < MAX_FAVORITE_GAMES && (
                <div className="mt-3 flex gap-2">
                  <Select value={gameToAdd} onValueChange={setGameToAdd}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Adicionar jogo" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGames.map((game) => (
                        <SelectItem key={game.id} value={game.id}>
                          {game.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!gameToAdd}
                    onClick={() => {
                      favoritesMutation.mutate(() =>
                        favoriteGamesService.add(userId!, gameToAdd, favorites.length),
                      );
                      setGameToAdd("");
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* -------------------------------------------------------- preview */}
      </div>
    </SettingsShell>
  );
}
