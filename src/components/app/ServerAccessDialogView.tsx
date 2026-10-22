import { useEffect, useRef, useState } from "react";
import {
  UsersRound,
  Link2,
  Gamepad2,
  Monitor,
  GraduationCap,
  Palette,
  Shapes,
  Globe2,
  LockKeyhole,
  ImagePlus,
  ArrowRight,
  Check,
  Layers3,
  MessageCircle,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CommunityNotice } from "@/components/community/CommunityUI";
import {
  extractServerInviteCode,
  validateServerIcon,
  validateServerSetup,
  type ServerSetupDraft,
} from "@/lib/server-access";
import type { InvitePreview } from "@/types";
import "./server-access.css";

const themes = [
  { value: "gaming", label: "Gaming", icon: Gamepad2 },
  { value: "technology", label: "Tecnologia", icon: Monitor },
  { value: "study", label: "Estudos", icon: GraduationCap },
  { value: "art", label: "Arte", icon: Palette },
  { value: "other", label: "Outro", icon: Shapes },
] as const;
export type ServerAccessMode = "create" | "join";
export interface ServerAccessViewProps {
  open: boolean;
  initialMode?: ServerAccessMode;
  onOpenChange: (open: boolean) => void;
  onCreate: (draft: ServerSetupDraft) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onPreview: (code: string) => Promise<InvitePreview | null>;
}

export function ServerAccessDialogView({
  open,
  initialMode = "create",
  onOpenChange,
  onCreate,
  onJoin,
  onPreview,
}: ServerAccessViewProps) {
  const [mode, setMode] = useState(initialMode),
    [draft, setDraft] = useState<ServerSetupDraft>({
      name: "",
      description: "",
      theme: "gaming",
      visibility: "private",
      iconFile: null,
    }),
    [invite, setInvite] = useState(""),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<InvitePreview | null>(null),
    [image, setImage] = useState("");
  const input = useRef<HTMLInputElement>(null),
    lookupVersion = useRef(0),
    mounted = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!draft.iconFile) {
      setImage("");
      return;
    }
    const url = URL.createObjectURL(draft.iconFile);
    setImage(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.iconFile]);
  function patch<K extends keyof ServerSetupDraft>(key: K, value: ServerSetupDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function switchMode(next: ServerAccessMode) {
    if (busy || checking) return;
    setMode(next);
    setError("");
  }
  async function checkInvite() {
    if (checking || busy) return;
    let code: string;
    try {
      code = extractServerInviteCode(invite);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const version = ++lookupVersion.current;
    setChecking(true);
    setError("");
    setPreview(null);
    try {
      const result = await onPreview(code);
      if (mounted.current && version === lookupVersion.current) {
        if (!result?.valid)
          throw Error("Este convite não está disponível. Peça um novo link ao administrador.");
        setPreview(result);
      }
    } catch (e) {
      if (mounted.current && version === lookupVersion.current)
        setError(e instanceof Error ? e.message : "Não foi possível consultar o convite.");
    } finally {
      if (mounted.current && version === lookupVersion.current) setChecking(false);
    }
  }
  async function submit() {
    if (pending.current || checking) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (mode === "create") await onCreate(validateServerSetup(draft));
      else await onJoin(extractServerInviteCode(invite));
      if (mounted.current) onOpenChange(false);
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy && !checking) onOpenChange(v);
      }}
    >
      <DialogContent className="community-ui server-access-dialog gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="server-access-layout">
          <aside className="server-access-intro">
            <Logo />
            <div>
              <DialogTitle className="text-2xl leading-tight">
                Conecte suas
                <br className="hidden lg:block" /> comunidades
              </DialogTitle>
              <DialogDescription className="mt-3 leading-relaxed">
                Crie seu próprio servidor ou encontre seu lugar em um que já existe.
              </DialogDescription>
            </div>
            <div className="server-access-art" aria-hidden="true">
              <span className="server-access-orbit" />
              <div className="server-access-emblem">
                <UsersRound size={48} />
                <span>
                  <Gamepad2 size={22} />
                </span>
              </div>
            </div>
            <ul className="server-access-benefits">
              {[
                { icon: UsersRound, text: "Reúna sua comunidade" },
                { icon: Layers3, text: "Organize seus canais" },
                { icon: MessageCircle, text: "Jogue e converse junto" },
              ].map(({ icon: Icon, text }) => (
                <li key={text}>
                  <Icon size={17} />
                  {text}
                </li>
              ))}
            </ul>
          </aside>
          <main className="server-access-main">
            <div className="server-access-modes" role="group" aria-label="Criar ou entrar">
              {[
                {
                  value: "create",
                  icon: UsersRound,
                  title: "Criar servidor",
                  hint: "Monte um espaço com a sua identidade.",
                },
                {
                  value: "join",
                  icon: Link2,
                  title: "Entrar em servidor",
                  hint: "Use um convite para encontrar seu squad.",
                },
              ].map(({ value, icon: Icon, title, hint }) => (
                <button
                  type="button"
                  key={value}
                  className="server-access-mode"
                  aria-pressed={mode === value}
                  disabled={busy || checking}
                  onClick={() => switchMode(value as ServerAccessMode)}
                >
                  <span className="server-access-mode-icon">
                    <Icon size={24} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{hint}</small>
                  </span>
                  <span className="server-access-check" aria-hidden="true">
                    {mode === value && <Check size={12} />}
                  </span>
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="server-access-form"
            >
              <div className="server-access-scroll">
                <header className="mb-5">
                  <h2 className="text-lg font-semibold">
                    {mode === "create" ? "Configure seu servidor" : "Seu próximo ponto de encontro"}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {mode === "create"
                      ? "Dê um nome, escolha uma identidade e comece a conversar."
                      : "Cole o convite recebido. A entrada respeita as regras e permissões do servidor."}
                  </p>
                </header>
                {mode === "create" ? (
                  <fieldset disabled={busy} className="space-y-5">
                    <div className="server-access-identity">
                      <div className="space-y-2">
                        <Label htmlFor="setup-icon">Ícone do servidor</Label>
                        <label className="server-access-icon-picker" htmlFor="setup-icon">
                          {image ? (
                            <img src={image} alt="Prévia do ícone do servidor" />
                          ) : (
                            <>
                              <ImagePlus size={28} />
                              <span>Adicionar ícone</span>
                            </>
                          )}
                          <input
                            ref={input}
                            type="file"
                            id="setup-icon"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            aria-label="Enviar ícone do servidor"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const invalid = validateServerIcon(file);
                              if (invalid) {
                                e.target.value = "";
                                setError(invalid);
                                return;
                              }
                              setError("");
                              patch("iconFile", file);
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-muted-foreground">
                          PNG, JPG, WEBP ou GIF · até 4 MB
                        </p>
                        {draft.iconFile && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              patch("iconFile", null);
                              if (input.current) input.current.value = "";
                            }}
                          >
                            Remover ícone
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="setup-name">Nome do servidor</Label>
                          <Input
                            id="setup-name"
                            autoComplete="off"
                            required
                            minLength={2}
                            maxLength={60}
                            placeholder="O nome do seu squad"
                            value={draft.name}
                            onChange={(e) => patch("name", e.target.value)}
                          />
                          <p className="text-right text-[10px] text-muted-foreground">
                            {[...draft.name].length}/60
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="setup-description">
                            Descrição{" "}
                            <span className="font-normal text-muted-foreground">(opcional)</span>
                          </Label>
                          <textarea
                            id="setup-description"
                            rows={2}
                            maxLength={200}
                            placeholder="Conte um pouco sobre o seu servidor…"
                            value={draft.description}
                            onChange={(e) => patch("description", e.target.value)}
                            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          />
                          <p className="text-right text-[10px] text-muted-foreground">
                            {[...draft.description].length}/200
                          </p>
                        </div>
                      </div>
                    </div>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">Categoria / tema</legend>
                      <div className="server-access-themes">
                        {themes.map(({ value, label, icon: Icon }) => (
                          <label key={value} className="server-access-theme">
                            <input
                              type="radio"
                              name="server-theme"
                              value={value}
                              checked={draft.theme === value}
                              onChange={() => patch("theme", value)}
                            />
                            <Icon size={17} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">Visibilidade</legend>
                      <div className="server-access-visibility">
                        {[
                          {
                            value: "public",
                            title: "Público",
                            icon: Globe2,
                            hint: "O Explorar exige publicação separada.",
                          },
                          {
                            value: "private",
                            title: "Privado",
                            icon: LockKeyhole,
                            hint: "Entrada por convite, no seu ritmo.",
                          },
                        ].map(({ value, title, icon: Icon, hint }) => (
                          <label className="server-access-visibility-choice" key={value}>
                            <input
                              type="radio"
                              name="server-visibility"
                              checked={draft.visibility === value}
                              onChange={() => patch("visibility", value as "public" | "private")}
                            />
                            <Icon size={22} />
                            <span>
                              <strong>{title}</strong>
                              <small>{hint}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Seu servidor começa com cargos básicos e o canal #geral. Você pode
                      personalizá-lo depois. Criar um servidor não ativa Comunidade automaticamente.
                    </p>
                  </fieldset>
                ) : (
                  <fieldset disabled={busy} className="space-y-4">
                    <div className="server-access-invite-art">
                      <Link2 size={32} />
                      <div>
                        <strong>Um convite abre a conversa</strong>
                        <p>Peça um link a alguém do servidor e cole abaixo.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setup-invite">Convite, link ou código</Label>
                      <Input
                        id="setup-invite"
                        required
                        autoComplete="off"
                        placeholder="https://lobbyx-nine.vercel.app/invite/…"
                        value={invite}
                        onChange={(e) => {
                          lookupVersion.current++;
                          setChecking(false);
                          setInvite(e.target.value);
                          setPreview(null);
                          setError("");
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Também funciona com o código do convite.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || checking || !invite.trim()}
                      onClick={() => void checkInvite()}
                    >
                      {checking ? "Consultando convite…" : "Ver convite"}
                    </Button>
                    {preview && (
                      <div className="server-access-invite-preview">
                        <UsersRound size={28} />
                        <div>
                          <strong>{preview.server_name}</strong>
                          <p>{preview.server_description || "Um novo espaço para conversar."}</p>
                          <small>
                            {preview.already_member
                              ? "Você já participa deste servidor."
                              : "Convite disponível. As regras são verificadas novamente ao entrar."}
                          </small>
                        </div>
                      </div>
                    )}
                  </fieldset>
                )}
                {error && (
                  <div className="mt-4">
                    <CommunityNotice tone="error">{error}</CommunityNotice>
                  </div>
                )}
              </div>
              <footer className="server-access-actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || checking}
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={busy || checking || (mode === "join" && !invite.trim())}
                >
                  {mode === "create" ? <UsersRound size={16} /> : <Link2 size={16} />}{" "}
                  {busy
                    ? mode === "create"
                      ? "Criando servidor…"
                      : "Entrando…"
                    : mode === "create"
                      ? "Criar servidor"
                      : "Entrar em servidor"}{" "}
                  <ArrowRight size={16} />
                </Button>
              </footer>
            </form>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
