import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowDown, ArrowUp, Gamepad2, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { STATUS_EMOJI, STATUS_LABEL, StatusDot } from "@/components/app/StatusDot";
import { BadgeChips } from "@/components/gamer/BadgeChips";
import { XpBar } from "@/components/gamer/XpBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  useFavoriteGames,
  useGames,
  useMyGamePresence,
  usePreferences,
  useUserBadges,
  useUserXp,
} from "@/hooks/use-gamer";
import { profileImagesService, type ImageBucket } from "@/services/profile-images";
import {
  favoriteGamesService,
  gamePresenceService,
  MAX_FAVORITE_GAMES,
  preferencesService,
} from "@/services/gamer";
import { profilesService } from "@/services/profiles";
import type { AccentColor, TransparencyLevel, UserStatus } from "@/types";

export const Route = createFileRoute("/_authenticated/settings_/profile")({
  head: () => ({
    meta: [
      { title: "Perfil gamer — SecureChat" },
      {
        name: "description",
        content:
          "Personalize seu perfil gamer no SecureChat: avatar, banner, bio, status, jogos favoritos e tema neon.",
      },
      { property: "og:title", content: "Perfil gamer — SecureChat" },
      {
        property: "og:description",
        content: "Avatar, banner, bio, jogos favoritos, XP, badges e personalização visual.",
      },
    ],
  }),
  component: ProfileSettingsPage,
});

const USERNAME_RE = /^[a-z0-9_.]{3,32}$/;
const STATUSES: UserStatus[] = ["online", "idle", "dnd", "offline"];
const ACCENTS: { value: AccentColor; label: string }[] = [
  { value: "neon_cyan", label: "Ciano" },
  { value: "neon_blue", label: "Azul" },
  { value: "neon_purple", label: "Roxo" },
  { value: "neon_green", label: "Verde" },
  { value: "neon_orange", label: "Laranja" },
  { value: "neon_red", label: "Vermelho" },
];
const TRANSPARENCIES: TransparencyLevel[] = ["none", "low", "medium", "high"];
const TRANSPARENCY_LABEL: Record<TransparencyLevel, string> = {
  none: "Sem transparência",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

function ProfileSettingsPage() {
  const { profile, user, refreshProfile } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const { data: games = [] } = useGames();
  const { data: favorites = [] } = useFavoriteGames(userId);
  const { data: presence } = useMyGamePresence(userId);
  const { data: xp } = useUserXp(userId);
  const { data: badges = [] } = useUserBadges(userId);
  const { data: prefs } = usePreferences(userId);

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    custom_status: "",
    avatar_url: "",
    banner_url: "",
    status: "online" as UserStatus,
  });
  const [gameToAdd, setGameToAdd] = useState<string>("");

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name,
      username: profile.username,
      bio: profile.bio ?? "",
      custom_status: profile.custom_status ?? "",
      avatar_url: profile.avatar_url ?? "",
      banner_url: profile.banner_url ?? "",
      status: profile.status,
    });
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: () =>
      profilesService.update(userId!, {
        display_name: form.display_name,
        username: form.username,
        bio: form.bio,
        custom_status: form.custom_status,
        avatar_url: form.avatar_url,
        banner_url: form.banner_url,
        status: form.status,
      }),
    onSuccess: async () => {
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Perfil atualizado.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("profiles_username_key")
          ? "Este username já está em uso."
          : "Não foi possível salvar o perfil.",
      );
    },
  });

  const uploadImage = useMutation({
    mutationFn: async ({ bucket, file }: { bucket: ImageBucket; file: File }) => ({
      bucket,
      url: await profileImagesService.upload(bucket, userId!, file),
    }),
    onSuccess: ({ bucket, url }) => {
      setForm((f) => (bucket === "avatars" ? { ...f, avatar_url: url } : { ...f, banner_url: url }));
      toast.success("Imagem enviada. Salve para aplicar.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha no upload da imagem."),
  });

  const favoritesMutation = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorite-games", userId] }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar os jogos."),
  });

  const presenceMutation = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["game-presence", userId] }),
    onError: () => toast.error("Não foi possível atualizar o jogo atual."),
  });

  const prefsMutation = useMutation({
    mutationFn: (update: Parameters<typeof preferencesService.save>[1]) =>
      preferencesService.save(userId!, { ...prefs, ...update }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["preferences", userId] }),
    onError: () => toast.error("Não foi possível salvar a personalização."),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!USERNAME_RE.test(form.username.trim().toLowerCase())) {
      toast.error("Username inválido: 3-32 caracteres, minúsculas, números, _ ou .");
      return;
    }
    if (!form.display_name.trim()) {
      toast.error("Informe um nome de exibição.");
      return;
    }
    saveProfile.mutate();
  }

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
    <main className="bg-hero-glow min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/app">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o app
          </Link>
        </Button>

        <h1 className="text-2xl font-semibold">Perfil gamer</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sua identidade no SecureChat. XP, níveis e badges são concedidos pelo sistema.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ------------------------------------------------------- editor */}
          <div className="space-y-6">
            <section className="glass-panel p-6">
              <h2 className="mb-4 text-base font-semibold">Identidade</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => avatarInput.current?.click()}
                    disabled={uploadImage.isPending}
                  >
                    <Upload className="mr-2 h-4 w-4" /> Enviar avatar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => bannerInput.current?.click()}
                    disabled={uploadImage.isPending}
                  >
                    <Upload className="mr-2 h-4 w-4" /> Enviar banner
                  </Button>
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage.mutate({ bucket: "avatars", file });
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={bannerInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage.mutate({ bucket: "banners", file });
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Nome de exibição</Label>
                    <Input
                      id="display_name"
                      value={form.display_name}
                      onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      className="font-mono"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    maxLength={300}
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    placeholder="Conte quem você é nas partidas..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom_status">Status personalizado</Label>
                  <div className="flex gap-2">
                    <Input
                      id="custom_status"
                      maxLength={120}
                      value={form.custom_status}
                      onChange={(e) => setForm((f) => ({ ...f, custom_status: e.target.value }))}
                      placeholder="Jogando com a tropa 🎮"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setForm((f) => ({ ...f, custom_status: "" }))}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status online</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, status: value as UserStatus }))
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_EMOJI[status]} {STATUS_LABEL[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? "Salvando..." : "Salvar perfil"}
                </Button>
              </form>
            </section>

            {/* ------------------------------------------------ game presence */}
            <section className="glass-panel p-6">
              <h2 className="mb-1 text-base font-semibold">Jogo atual</h2>
              <p className="text-muted-foreground mb-4 text-xs">
                Seleção manual. Integrações com plataformas externas chegam depois.
              </p>
              {presence?.status === "playing" && presence.game && (
                <p className="text-primary mb-3 flex items-center gap-2 text-sm">
                  <Gamepad2 className="h-4 w-4" /> Jogando {presence.game.name}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Select
                  value={presence?.game_id ?? ""}
                  onValueChange={(value) =>
                    presenceMutation.mutate(() =>
                      gamePresenceService.set(userId!, value, "playing"),
                    )
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Escolher jogo" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((game) => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!presence?.game_id || presenceMutation.isPending}
                  onClick={() =>
                    presenceMutation.mutate(() =>
                      gamePresenceService.set(userId!, presence!.game_id!, "playing"),
                    )
                  }
                >
                  Começar jogo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={presenceMutation.isPending}
                  onClick={() => presenceMutation.mutate(() => gamePresenceService.stop(userId!))}
                >
                  Parar jogo
                </Button>
              </div>
            </section>

            {/* ----------------------------------------------- favorite games */}
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

            {/* ------------------------------------------------ personalization */}
            <section className="glass-panel p-6">
              <h2 className="mb-4 text-base font-semibold">Personalização visual</h2>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Cor de destaque</Label>
                  <div className="flex flex-wrap gap-2">
                    {ACCENTS.map((accent) => (
                      <button
                        key={accent.value}
                        type="button"
                        data-accent={accent.value}
                        aria-label={accent.label}
                        aria-pressed={prefs?.accent_color === accent.value}
                        onClick={() => prefsMutation.mutate({ accent_color: accent.value })}
                        className={`bg-brand-gradient h-9 w-9 rounded-lg transition-transform hover:scale-110 ${
                          prefs?.accent_color === accent.value ? "ring-foreground ring-2" : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <ToggleRow
                  label="Glow neon"
                  checked={prefs?.glow_enabled ?? true}
                  onChange={(v) => prefsMutation.mutate({ glow_enabled: v })}
                />
                <ToggleRow
                  label="Animações"
                  checked={prefs?.animations_enabled ?? true}
                  onChange={(v) => prefsMutation.mutate({ animations_enabled: v })}
                />
                <ToggleRow
                  label="Sons de interface"
                  checked={prefs?.sounds_enabled ?? false}
                  onChange={(v) => prefsMutation.mutate({ sounds_enabled: v })}
                />

                <div className="space-y-2">
                  <Label htmlFor="transparency">Transparência</Label>
                  <Select
                    value={prefs?.transparency_level ?? "medium"}
                    onValueChange={(value) =>
                      prefsMutation.mutate({ transparency_level: value as TransparencyLevel })
                    }
                  >
                    <SelectTrigger id="transparency" className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPARENCIES.map((level) => (
                        <SelectItem key={level} value={level}>
                          {TRANSPARENCY_LABEL[level]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          </div>

          {/* -------------------------------------------------------- preview */}
          <aside className="lg:sticky lg:top-10 lg:self-start">
            <div className="glass-panel overflow-hidden">
              <div
                className="bg-brand-gradient h-24 w-full bg-cover bg-center"
                style={form.banner_url ? { backgroundImage: `url(${form.banner_url})` } : undefined}
              />
              <div className="p-5">
                <div className="relative -mt-12 w-fit">
                  <Avatar className="border-surface glow-ring h-20 w-20 border-4">
                    <AvatarImage src={form.avatar_url || undefined} alt="" />
                    <AvatarFallback className="bg-secondary text-lg">
                      {form.display_name.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <StatusDot
                    status={form.status}
                    playing={presence?.status === "playing"}
                    className="border-surface absolute right-1 bottom-1 h-4 w-4 border-2"
                  />
                </div>
                <p className="mt-3 text-lg font-semibold">{form.display_name || "Seu nome"}</p>
                <p className="text-muted-foreground font-mono text-sm">
                  @{form.username || "username"}
                </p>
                {presence?.status === "playing" && presence.game ? (
                  <p className="text-primary mt-2 flex items-center gap-1.5 text-xs">
                    <Gamepad2 className="h-3.5 w-3.5" /> Jogando {presence.game.name}
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-2 text-xs">
                    {STATUS_EMOJI[form.status]} {STATUS_LABEL[form.status]}
                  </p>
                )}
                {form.custom_status && (
                  <p className="text-surface-foreground mt-2 text-sm italic">
                    “{form.custom_status}”
                  </p>
                )}
                {form.bio && <p className="mt-3 text-sm whitespace-pre-wrap">{form.bio}</p>}

                <div className="mt-5">
                  <XpBar xp={xp?.xp ?? 0} level={xp?.level ?? 1} />
                </div>

                <h3 className="text-muted-foreground mt-5 mb-2 text-xs font-semibold tracking-wider uppercase">
                  Badges
                </h3>
                <BadgeChips badges={badges} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
