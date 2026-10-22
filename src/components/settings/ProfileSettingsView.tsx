import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Crown,
  Eye,
  Paintbrush,
  UserRound,
  Upload,
  RotateCcw,
  Check,
  AtSign,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { VisualBanner } from "@/components/ui/static-image";
import { ProfileFrameDecoration } from "@/components/gamer/ProfileCosmetics";
import { BadgeChips } from "@/components/gamer/BadgeChips";
import { ProfileCosmeticPicker } from "./ProfileCosmeticPicker";
import { useMediaAnimations } from "@/hooks/use-visual-quality";
import { nameplateStyle } from "@/lib/profile-cosmetics";
import {
  sameProfileDraft,
  validateProfileDraft,
  type ProfileDraft,
  type ProfileFiles,
} from "@/lib/profile-editor";
import { validateImage } from "@/lib/profile-image";
import type { UserBadge } from "@/types";
import "./profile-settings.css";

function useFilePreview(file: File | null, fallback: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return file ? url : fallback;
}
interface Props {
  initial: ProfileDraft;
  username: string;
  xp: { level: number; current: number; need: number; percent: number } | null;
  badges: UserBadge[];
  badgesUnavailable?: boolean;
  onSave: (draft: ProfileDraft, files: ProfileFiles) => Promise<ProfileDraft>;
  onCancel: () => void;
  unavailable?: string | undefined;
  notice?: ReactNode;
}
export function ProfileSettingsView({
  initial,
  username,
  xp,
  badges,
  badgesUnavailable,
  onSave,
  onCancel,
  unavailable,
  notice,
}: Props) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [files, setFiles] = useState<ProfileFiles>({ avatar: null, banner: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const avatarInput = useRef<HTMLInputElement>(null),
    bannerInput = useRef<HTMLInputElement>(null);
  const dirty = !sameProfileDraft(draft, saved) || !!files.avatar || !!files.banner;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!dirtyRef.current) {
      setSaved(initial);
      setDraft(initial);
    }
  }, [initial]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const avatar = useFilePreview(files.avatar, draft.avatar_url),
    banner = useFilePreview(files.banner, draft.banner_url);
  const animate = useMediaAnimations() && draft.frame_animations_enabled;
  function patch<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((old) => ({ ...old, [key]: value }));
    setFeedback("");
  }
  function reset() {
    if (pending.current) return;
    setDraft(initial);
    setSaved(initial);
    setFiles({ avatar: null, banner: null });
    setError("");
    setFeedback("Alterações descartadas. Perfil salvo restaurado.");
  }
  function selectImage(kind: keyof ProfileFiles, file: File | undefined) {
    if (!file || pending.current) return;
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setFeedback("");
    setFiles((old) => ({ ...old, [kind]: file }));
  }
  async function save() {
    if (pending.current || unavailable || !dirty) return;
    try {
      validateProfileDraft(draft, initial);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const result = await onSave(draft, files);
      if (!mounted.current) return;
      setSaved(result);
      setDraft(result);
      setFiles({ avatar: null, banner: null });
      setFeedback("Alterações salvas.");
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="profile-settings-content">
      {notice}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || !!unavailable} className="profile-editor-grid">
          <div className="profile-editor-column">
            <section className="profile-editor-card profile-identity">
              <header>
                <span className="profile-card-icon">
                  <UserRound size={22} />
                </span>
                <h2>Identidade</h2>
                <p>Essas informações são exibidas para outros jogadores.</p>
              </header>
              <div className="profile-identity-fields">
                <div>
                  <label htmlFor="profile-display-name">Nome de exibição</label>
                  <Input
                    id="profile-display-name"
                    value={draft.display_name}
                    maxLength={Math.max(32, initial.display_name.length)}
                    onChange={(event) => patch("display_name", event.target.value)}
                  />
                  <small>{Array.from(draft.display_name).length}/32</small>
                </div>
                <div>
                  <label htmlFor="profile-username">Username</label>
                  <div className="profile-username">
                    <AtSign size={17} />
                    <Input id="profile-username" value={username} readOnly />
                  </div>
                  <p>Seu username é permanente.</p>
                </div>
                <div className="profile-bio-field">
                  <label htmlFor="profile-bio">Bio</label>
                  <Textarea
                    id="profile-bio"
                    value={draft.bio}
                    rows={3}
                    maxLength={Math.max(160, initial.bio.length)}
                    placeholder="Conte um pouco sobre você e nas partidas..."
                    onChange={(event) => patch("bio", event.target.value)}
                  />
                  <small>{Array.from(draft.bio).length}/160</small>
                </div>
              </div>
            </section>
            <section className="profile-editor-card profile-appearance">
              <header>
                <span className="profile-card-icon profile-icon-purple">
                  <Paintbrush size={22} />
                </span>
                <h2>Aparência do perfil</h2>
                <p>Personalize seu visual na comunidade.</p>
              </header>
              <div className="profile-appearance-grid">
                <div className="profile-image-control">
                  <div>
                    <h3>Avatar</h3>
                    <p>Imagem que representa você.</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => avatarInput.current?.click()}
                    >
                      <Upload size={15} />
                      Alterar
                    </Button>
                  </div>
                  <Avatar className="profile-control-avatar">
                    <AvatarImage src={avatar || undefined} alt="" />
                    <AvatarFallback>{draft.display_name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="profile-image-control">
                  <div>
                    <h3>Banner do perfil</h3>
                    <p>Imagem de capa do seu perfil.</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => bannerInput.current?.click()}
                    >
                      <Upload size={15} />
                      Alterar
                    </Button>
                  </div>
                  <VisualBanner src={banner} className="profile-control-banner" />
                </div>
                <ProfileCosmeticPicker
                  compact
                  kind="avatar"
                  value={draft.avatar_frame}
                  name={draft.display_name}
                  avatar={avatar}
                  banner={banner}
                  onChange={(value) => patch("avatar_frame", value)}
                />
                <ProfileCosmeticPicker
                  compact
                  kind="nameplate"
                  value={draft.nameplate}
                  name={draft.display_name}
                  avatar={avatar}
                  banner={banner}
                  onChange={(value) => patch("nameplate", value)}
                />
                <ProfileCosmeticPicker
                  compact
                  kind="frame"
                  value={draft.profile_frame}
                  name={draft.display_name}
                  avatar={avatar}
                  banner={banner}
                  onChange={(value) => patch("profile_frame", value)}
                />
                <div className="profile-animation-control">
                  <div>
                    <h3>Animações das molduras</h3>
                    <p>Ativa efeitos visuais nas molduras do avatar e perfil.</p>
                  </div>
                  <Switch
                    aria-label="Animações das molduras"
                    checked={draft.frame_animations_enabled}
                    onCheckedChange={(value) => patch("frame_animations_enabled", value)}
                  />
                </div>
              </div>
              <input
                ref={avatarInput}
                aria-label="Enviar avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => {
                  selectImage("avatar", event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <input
                ref={bannerInput}
                aria-label="Enviar banner"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => {
                  selectImage("banner", event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </section>
          </div>
          <aside
            className="profile-editor-card profile-preview-panel"
            aria-label="Pré-visualização do perfil"
          >
            <header>
              <span className="profile-card-icon profile-icon-lime">
                <Eye size={23} />
              </span>
              <div>
                <h2>Pré-visualização</h2>
                <p>Veja como seu perfil ficará para os outros jogadores.</p>
              </div>
            </header>
            <div className="profile-live-card" data-frame-animations={animate}>
              <ProfileFrameDecoration value={draft.profile_frame} animated={animate} />
              <VisualBanner src={banner} className="profile-live-banner" />
              <button
                className="profile-banner-upload"
                type="button"
                aria-label="Alterar banner na prévia"
                onClick={() => bannerInput.current?.click()}
              >
                <Upload size={18} />
              </button>
              <div className="profile-live-body">
                <button
                  type="button"
                  aria-label="Alterar avatar na prévia"
                  className="profile-live-avatar-button"
                  onClick={() => avatarInput.current?.click()}
                >
                  <Avatar frame={draft.avatar_frame} className="profile-live-avatar">
                    <AvatarImage src={avatar || undefined} alt="" />
                    <AvatarFallback>{draft.display_name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                </button>
                <div className="profile-live-name" style={nameplateStyle(draft.nameplate)}>
                  <h3>{draft.display_name || "Seu nome"}</h3>
                  {badges.some((badge) => badge.badge?.slug === "FOUNDER") && (
                    <Crown size={20} className="profile-founder" aria-label="Badge fundador" />
                  )}
                </div>
                <p className="profile-live-username">@{username}</p>
                {draft.bio && <p className="profile-live-bio">{draft.bio}</p>}
                <div className="profile-live-xp">
                  {xp ? (
                    <>
                      <div>
                        <strong>
                          <Zap size={17} /> LEVEL {xp.level}
                        </strong>
                        <span>
                          {xp.current} / {xp.need} XP
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Progresso do nível"
                        aria-valuemin={0}
                        aria-valuemax={xp.need}
                        aria-valuenow={xp.current}
                      >
                        <span style={{ width: `${xp.percent}%` }} />
                      </div>
                    </>
                  ) : (
                    <p>XP indisponível no momento.</p>
                  )}
                </div>
                <h4>BADGES</h4>
                {badgesUnavailable ? (
                  <p>Badges indisponíveis no momento.</p>
                ) : (
                  <BadgeChips badges={badges} />
                )}
              </div>
            </div>
          </aside>
        </fieldset>
        <footer className="profile-save-footer">
          <div>
            <Button variant="outline" type="button" disabled={busy || !dirty} onClick={reset}>
              <RotateCcw size={17} />
              Restaurar padrão
            </Button>
            <p>Remove todas as alterações feitas nesta página.</p>
          </div>
          <div>
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => {
                reset();
                onCancel();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="profile-save-button"
              disabled={busy || !dirty || !!unavailable}
            >
              <Check size={18} />
              {busy ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </footer>
        {(error || unavailable) && (
          <p className="profile-editor-error" role="alert">
            {error || unavailable}
          </p>
        )}
        {feedback && (
          <p className="profile-editor-feedback" role="status">
            {feedback}
          </p>
        )}
      </form>
    </div>
  );
}
