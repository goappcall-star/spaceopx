import { isIllustratedFrame } from "@/lib/illustrated-frames";
import { VisualBanner } from "@/components/ui/static-image";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { AVATAR_FRAMES, normalizeAvatarFrame, type AvatarFrameId } from "@/lib/avatar-frames";
import {
  PROFILE_COSMETICS,
  NAMEPLATE_COSMETICS,
  normalizeProfileCosmetic,
  type ProfileCosmeticId,
} from "@/lib/profile-cosmetics";
import { ProfileFrameDecoration } from "@/components/gamer/ProfileCosmetics";
import { nameplateStyle } from "@/lib/profile-cosmetics";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ProfileCosmeticPicker({
  kind,
  value,
  onChange,
  name,
  avatar,
  banner,
}: {
  value: string;
  name: string;
  avatar: string;
  banner: string;
} & (
  | { kind: "avatar"; onChange: (value: AvatarFrameId) => void }
  | { kind: "nameplate" | "frame"; onChange: (value: ProfileCosmeticId) => void }
)) {
  const [open, setOpen] = useState(false);
  const normalize = kind === "avatar" ? normalizeAvatarFrame : normalizeProfileCosmetic;
  const [selected, setSelected] = useState<ProfileCosmeticId | AvatarFrameId>(normalize(value));
  const label =
    kind === "avatar"
      ? "Moldura do avatar"
      : kind === "nameplate"
        ? "Placa de identificação"
        : "Moldura do perfil";
  const options =
    kind === "avatar"
      ? AVATAR_FRAMES
      : kind === "nameplate"
        ? NAMEPLATE_COSMETICS
        : PROFILE_COSMETICS;
  const choice = options.find((item) => item.id === selected) ?? options[0];
  const currentChoice = options.find((item) => item.id === normalize(value)) ?? options[0];
  const face = (
    <Avatar
      frame={kind === "avatar" ? normalizeAvatarFrame(selected) : "default"}
      className="h-12 w-12 shrink-0"
    >
      <AvatarImage src={avatar || undefined} alt="" />
      <AvatarFallback>{(name || "LX").slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-muted-foreground text-xs mt-1">{currentChoice.name}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          aria-label={`Alterar ${label.toLowerCase()}`}
          onClick={() => {
            setSelected(normalize(value));
            setOpen(true);
          }}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Alterar
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogTitle>Alterar {label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Escolha um estilo e veja a prévia. Todos os estilos estão disponíveis.
          </DialogDescription>
          <div className="grid gap-6 sm:grid-cols-2">
            <div
              className="grid max-h-[52dvh] grid-cols-2 content-start gap-3 overflow-y-auto pr-1"
              aria-label={`Estilos de ${label.toLowerCase()}`}
            >
              {options.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected === item.id}
                  onClick={() => setSelected(item.id)}
                  className={`relative rounded-xl border p-3 text-left transition-colors ${selected === item.id ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-hover"}`}
                >
                  <div
                    className="relative h-20 overflow-hidden rounded-lg bg-surface-elevated"
                    style={kind === "nameplate" ? nameplateStyle(item.id) : undefined}
                  >
                    {kind === "frame" && (
                      <ProfileFrameDecoration value={item.id} animated={false} compact />
                    )}
                    {kind === "avatar" ? (
                      <div className="flex h-full items-center justify-center">
                        <Avatar frame={normalizeAvatarFrame(item.id)} className="h-12 w-12">
                          <AvatarImage src={avatar || undefined} alt="" />
                          <AvatarFallback>{(name || "LX").slice(0, 2)}</AvatarFallback>
                        </Avatar>
                      </div>
                    ) : (
                      <>
                        <span className="absolute left-3 top-6 h-6 w-6 rounded-full bg-muted" />
                        <span className="absolute left-12 right-3 top-8 h-2 rounded-full bg-muted" />
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-semibold">{item.name}</p>
                  {selected === item.id && (
                    <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Prévia</p>
              {kind === "nameplate" ? (
                <div className="rounded-xl border border-border bg-surface p-3 space-y-3">
                  <div className="h-10 rounded-lg bg-muted/30" />
                  <div
                    className="flex items-center gap-3 rounded-lg p-2"
                    style={nameplateStyle(selected)}
                  >
                    {face}
                    <p className="min-w-0 truncate font-semibold">{name || "Seu nome"}</p>
                  </div>
                  <div className="h-10 rounded-lg bg-muted/30" />
                </div>
              ) : (
                <div
                  className="relative rounded-2xl bg-surface overflow-visible border border-border mx-4 my-5"
                  style={
                    kind === "frame" && isIllustratedFrame(selected)
                      ? { marginTop: 40, marginBottom: 40 }
                      : undefined
                  }
                >
                  {kind === "frame" && <ProfileFrameDecoration value={selected} />}
                  <VisualBanner
                    src={banner}
                    className="h-24 rounded-t-2xl bg-brand-gradient bg-cover bg-center"
                  />
                  <div className="p-5">
                    <div className="-mt-10 relative">{face}</div>
                    <p className="mt-4 font-semibold break-words">{name || "Seu nome"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Seu perfil, com a sua identidade.
                    </p>
                    <Button type="button" className="mt-5 w-full" tabIndex={-1}>
                      Botão exemplo
                    </Button>
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                <p className="font-semibold text-sm">{choice.name}</p>
                <p className="mt-2 text-xs text-muted-foreground">{choice.description}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (kind === "avatar") onChange(normalizeAvatarFrame(selected));
                else onChange(normalizeProfileCosmetic(selected));
                setOpen(false);
              }}
            >
              Aplicar estilo
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Salve o perfil para confirmar as alterações.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
