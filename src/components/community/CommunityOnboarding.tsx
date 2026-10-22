import { CommunityActions, CommunityNotice } from "./CommunityUI";
import { useState } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { CommunityExperience, OnboardingInput } from "@/types/community-experience";
import type { Channel, Role } from "@/types";
export function CommunityOnboarding({
  data,
  channels,
  roles,
  onSave,
  onClose,
  conflict = false,
}: {
  data: CommunityExperience;
  channels: Channel[];
  roles: Role[];
  onSave: (input: OnboardingInput) => Promise<void>;
  onClose: () => void;
  conflict?: boolean;
}) {
  const cfg = data.experience;
  const steps = [
    cfg.welcome_enabled && "welcome",
    cfg.rules_enabled && "rules",
    cfg.interests_enabled && "interests",
    cfg.channels_enabled && "channels",
    cfg.roles_enabled && "roles",
    "review",
  ].filter(Boolean) as string[];
  const [step, setStep] = useState(0),
    [accept, setAccept] = useState(data.progress?.accepted_revision === data.rules_revision),
    [interests, setInterests] = useState(
      data.progress?.interests.filter((i) => data.interests.includes(i)) ?? [],
    ),
    [selected, setSelected] = useState(
      data.progress?.selected_roles.filter((id) => cfg.role_ids.includes(id)) ?? [],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const current = steps[step],
    last = step === steps.length - 1;
  const toggle = (values: string[], v: string) =>
    values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
  async function save(complete: boolean, advance: boolean) {
    setError("");
    setBusy(true);
    try {
      await onSave({
        accept: cfg.rules_enabled && accept,
        interests: cfg.interests_enabled ? interests : [],
        roles: cfg.roles_enabled ? selected : [],
        complete,
      });
      if (complete || !advance) onClose();
      else setStep((s) => s + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    welcome: "Bem-vindo ao seu novo espaço",
    rules: "Regras para uma boa convivência",
    interests: "O que aproxima você do squad?",
    channels: "Encontre sua próxima conversa",
    roles: "Escolha como participar",
    review: "Tudo pronto para começar",
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="community-ui max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {labels[current!]}
        </DialogTitle>
        <DialogDescription>
          Boas-vindas · etapa {step + 1} de {steps.length}. Você pode salvar e continuar depois.
        </DialogDescription>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Progresso">
          {steps.map((s, i) => (
            <li key={s} className="community-step" aria-current={i === step ? "step" : undefined}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs">
                {i < step ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span>
                {
                  {
                    welcome: "Boas-vindas",
                    rules: "Regras",
                    interests: "Interesses",
                    channels: "Canais",
                    roles: "Cargos",
                    review: "Concluir",
                  }[s]
                }
              </span>
            </li>
          ))}
        </ol>
        {conflict && (
          <p role="alert" className="text-sm text-destructive">
            As configurações mudaram. Feche e reabra as boas-vindas para revisar a versão atual.
          </p>
        )}
        {current === "welcome" && (
          <div className="community-section flex items-start gap-4">
            <img src="/lobbyx-logo.png" alt="" className="h-12 w-12 shrink-0" />
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed">
              {cfg.welcome_text || "Bem-vindo à comunidade!"}
            </p>
          </div>
        )}
        {current === "rules" && (
          <div className="space-y-4">
            <ol className="space-y-2">
              {data.rules.map((r, i) => (
                <li key={r.id} className="community-choice whitespace-pre-wrap break-words text-sm">
                  <span className="mr-2 text-primary">{i + 1}.</span>
                  {r.text}
                </li>
              ))}
            </ol>
            <label className="community-choice text-sm">
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
                disabled={busy}
                className="mt-1 accent-primary"
              />
              <span>
                Li e aceito as regras da revisão {data.rules_revision}
                {cfg.rules_required ? " (obrigatório para concluir)" : " (opcional)"}.
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              O aceite obrigatório vale para conclusão e, para novos membros, envio de mensagens e
              reações. A voz mantém as permissões existentes.
            </p>
          </div>
        )}
        {current === "interests" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Opcional. Escolha os assuntos que você quer compartilhar.
            </p>
            <div className="flex flex-wrap gap-2">
              {data.interests.map((i) => (
                <button
                  key={i}
                  aria-pressed={interests.includes(i)}
                  onClick={() => setInterests(toggle(interests, i))}
                  className="community-choice text-sm"
                >
                  {i}
                </button>
              ))}
            </div>
            {!data.interests.length && <p className="text-sm">Nenhum interesse configurado.</p>}
          </div>
        )}
        {current === "channels" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Você encontrará estes canais na lateral após concluir ou salvar.
            </p>
            {channels
              .filter((c) => cfg.featured_channels.includes(c.id))
              .map((c) => (
                <div key={c.id} className="rounded-xl border border-border p-3 text-sm">
                  # {c.name}
                </div>
              ))}
            {!channels.some((c) => cfg.featured_channels.includes(c.id)) && (
              <p className="text-sm">Nenhuma sugestão de canal disponível.</p>
            )}
          </div>
        )}
        {current === "roles" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Opcional. Apenas cargos permitidos pela administração, revalidados no servidor ao
              concluir.
            </p>
            {roles
              .filter((r) => cfg.role_ids.includes(r.id))
              .map((r) => (
                <label key={r.id} className="community-choice text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => setSelected(toggle(selected, r.id))}
                    className="accent-primary"
                  />
                  {r.name}
                </label>
              ))}
            {!roles.some((r) => cfg.role_ids.includes(r.id)) && (
              <p className="text-sm">Nenhum cargo disponível para escolha.</p>
            )}
          </div>
        )}
        {current === "review" && (
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm">
            <Check className="h-6 w-6 text-primary" />
            <p>
              {cfg.rules_enabled
                ? accept
                  ? "Regras aceitas."
                  : "Você ainda não aceitou as regras."
                : "Etapa de regras desativada."}
            </p>
            <p>
              {interests.length} interesses e {selected.length} cargos escolhidos.
            </p>
            <p className="text-muted-foreground">
              Cargos serão atribuídos somente ao concluir. Remover uma escolha depois não remove
              cargos que você já possui.
            </p>
          </div>
        )}
        {error && <CommunityNotice tone="error">{error}</CommunityNotice>}
        <CommunityActions>
          <Button
            variant="ghost"
            disabled={busy || conflict}
            onClick={() => void save(false, false)}
          >
            Salvar e sair
          </Button>
          {step > 0 && (
            <Button variant="outline" disabled={busy} onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
          )}
          <Button
            className="ml-auto"
            disabled={
              busy || conflict || (cfg.rules_required && !accept && (last || current === "rules"))
            }
            onClick={() => void save(last, true)}
          >
            {busy ? "Salvando…" : last ? "Concluir" : "Continuar"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CommunityActions>
      </DialogContent>
    </Dialog>
  );
}
