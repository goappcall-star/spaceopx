import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Hash,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMMUNITY_CATEGORIES, validateCommunityPayload } from "@/lib/community-validation";
import { cn } from "@/lib/utils";
import type { Channel, Server } from "@/types";
import type { CommunityCategory, CommunityPayload, CommunitySettings } from "@/types/community";

const STEPS = ["Sua comunidade", "Regras", "Boas-vindas", "Segurança", "Identidade", "Revisão"];
const selectClass = "border-border bg-surface h-11 w-full rounded-lg border px-3 text-sm";
interface Props {
  server: Server;
  channels: Channel[];
  initial: CommunitySettings | null;
  busy: boolean;
  canSubmit: boolean;
  conflict?: boolean;
  canEditProfile?: boolean;
  onSubmit: (payload: CommunityPayload, revision: number) => void;
  onCancel: () => void;
  onEditProfile: () => void;
}

export function CommunityActivationWizard({
  server,
  channels,
  initial,
  busy,
  canSubmit,
  conflict = false,
  onSubmit,
  onCancel,
  onEditProfile,
  canEditProfile = true,
}: Props) {
  const [step, setStep] = useState(0);
  const [rules, setRules] = useState(
    () => initial?.rules.map((r) => ({ ...r })) ?? [{ id: crypto.randomUUID(), text: "" }],
  );
  const [welcome, setWelcome] = useState(initial?.welcome_channel_id ?? "");
  const [category, setCategory] = useState(initial?.category_slug ?? "");
  const [interests, setInterests] = useState(initial?.interests.join(", ") ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const available = channels.filter(
    (c) => c.server_id === server.id && (c.type === "text" || c.type === "announcement"),
  );
  const selectedChannel = available.find((c) => c.id === welcome);
  const editing = initial?.enabled === true;
  function payload(): CommunityPayload {
    return {
      rules,
      welcome_channel_id: welcome,
      category_slug: category as CommunityCategory,
      interests: interests
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    };
  }
  function validateStep() {
    if (step === 1) {
      if (rules.some((rule) => !rule.text.trim() || Array.from(rule.text.trim()).length > 1000))
        throw Error("Preencha cada regra com até 1.000 caracteres.");
    }
    if (step === 2 && !selectedChannel)
      throw Error("Selecione um canal de texto ou avisos disponível neste servidor.");
    if (step === 4) validateCommunityPayload(payload());
  }
  function next() {
    try {
      validateStep();
      setError("");
      setStep((n) => Math.min(n + 1, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confira os campos.");
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (step !== 5) {
      next();
      return;
    }
    if (!confirmed || busy || !canSubmit || conflict) return;
    try {
      if (!selectedChannel) throw Error("O canal de boas-vindas não está mais disponível.");
      onSubmit(validateCommunityPayload(payload()), initial?.revision ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confira os campos.");
    }
  }
  return (
    <form onSubmit={submit} className="space-y-6" aria-label="Assistente de comunidade">
      <div className="border-border bg-surface rounded-2xl border p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <Logo compact />
          <div>
            <p className="text-muted-foreground text-xs">Comunidades LobbyX</p>
            <h3 className="text-lg font-semibold">
              {editing
                ? "Configurar comunidade"
                : initial
                  ? "Reativar comunidade"
                  : "Um novo espaço para o seu squad"}
            </h3>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          {server.name} continua sendo o mesmo servidor. Seus canais, mensagens, membros, cargos e
          convites ficam preservados.
        </p>
      </div>
      <nav aria-label="Etapas da ativação">
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={step === i ? "step" : undefined}
              className={cn(
                "border-border rounded-lg border p-2 text-center",
                i === step && "border-primary/60 bg-primary/10",
              )}
            >
              <span
                className={cn(
                  "mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  i <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-elevated text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="text-[11px]">{label}</span>
            </li>
          ))}
        </ol>
      </nav>
      <p className="text-muted-foreground text-xs" role="status">
        Etapa {step + 1} de 6 · {STEPS[step]}
      </p>
      {conflict && (
        <p role="alert" className="border-warning/40 bg-warning/10 rounded-xl border p-3 text-sm">
          A configuração foi alterada em outra sessão. Feche este rascunho e reabra a configuração
          atual antes de salvar.
        </p>
      )}
      <div className="min-h-52 space-y-4">
        {step === 0 && (
          <>
            <h4 className="font-semibold">Organização com a identidade do seu servidor</h4>
            <p className="text-muted-foreground text-sm">
              Comece pelas regras, pelo canal de boas-vindas e pelos interesses que representam sua
              comunidade.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Users, title: "Mesmo squad", text: "Membros e cargos continuam no lugar." },
                {
                  icon: ShieldCheck,
                  title: "Gestão explícita",
                  text: "Somente proprietário e cargos autorizados.",
                },
                {
                  icon: LockKeyhole,
                  title: "Privacidade preservada",
                  text: "Ativar não publica seu servidor.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="border-border bg-surface rounded-xl border p-4">
                  <Icon className="text-primary mb-3 h-5 w-5" />
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{text}</p>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              A ativação pode ser desfeita mantendo a configuração para uma futura reativação.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <h4 className="font-semibold">Regras claras para todos</h4>
            <p className="text-muted-foreground text-sm">
              Adicione de 1 a 20 regras. Configure o aceite obrigatório nas opções de boas-vindas.
            </p>
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div key={rule.id} className="border-border bg-surface rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Label htmlFor={`community-rule-${rule.id}`}>Regra {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={busy || rules.length === 1}
                      aria-label={`Remover regra ${index + 1}`}
                      onClick={() => setRules((current) => current.filter((r) => r.id !== rule.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    id={`community-rule-${rule.id}`}
                    value={rule.text}
                    disabled={busy}
                    maxLength={2000}
                    rows={2}
                    onChange={(e) =>
                      setRules((current) =>
                        current.map((r) => (r.id === rule.id ? { ...r, text: e.target.value } : r)),
                      )
                    }
                    placeholder="Escreva uma regra da comunidade"
                  />
                  <p className="text-muted-foreground mt-1 text-right text-[11px]">
                    {Array.from(rule.text).length}/1.000
                  </p>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy || rules.length >= 20}
              onClick={() =>
                setRules((current) => [...current, { id: crypto.randomUUID(), text: "" }])
              }
            >
              <Plus className="h-4 w-4" />
              Adicionar regra
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <h4 className="font-semibold">Onde receber sua comunidade</h4>
            <p className="text-muted-foreground text-sm">
              Escolha um canal de texto ou de avisos existente. A ativação não cria nem duplica
              canais e não muda suas permissões.
            </p>
            <Label htmlFor="community-welcome">Canal de boas-vindas</Label>
            <select
              id="community-welcome"
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
              className={selectClass}
              disabled={busy || !available.length}
            >
              <option value="">Selecione um canal</option>
              {welcome && !selectedChannel && (
                <option value={welcome} disabled>
                  Canal indisponível — escolha outro
                </option>
              )}
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  # {c.name}
                </option>
              ))}
            </select>
            {!available.length && (
              <p role="alert" className="text-warning text-sm">
                Nenhum canal elegível está disponível. Crie um canal de texto nas opções existentes
                do servidor e retorne ao assistente.
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              As permissões atuais continuam decidindo quais membros podem visualizar esse canal.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <h4 className="font-semibold">Segurança sem mudanças silenciosas</h4>
            <ul className="border-border divide-border divide-y rounded-xl border text-sm">
              {[
                server.visibility === "private"
                  ? "Servidor privado: ingresso continua por convite."
                  : "Visibilidade atual preservada: sem inclusão automática na descoberta.",
                "Nenhum cargo recebe autorização nova pela ativação.",
                "Regras atuais de mensagens, convites e moderação continuam valendo.",
                "Somente o proprietário pode delegar a gestão a cargos específicos.",
              ].map((text) => (
                <li key={text} className="flex gap-2 p-3">
                  <ShieldCheck className="text-primary h-4 w-4 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">
              Onboarding obrigatório, cargos escolhíveis e descoberta terão validação própria nas
              próximas fases. Essas proteções não são simuladas por esta tela.
            </p>
          </>
        )}
        {step === 4 && (
          <>
            <h4 className="font-semibold">A identidade do seu servidor</h4>
            <div className="border-border bg-surface overflow-hidden rounded-xl border">
              {server.banner_url && (
                <img src={server.banner_url} alt="" className="h-24 w-full object-cover" />
              )}
              <div className="flex items-center gap-3 p-4">
                {server.icon_url && (
                  <img src={server.icon_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{server.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {server.description || "Sem descrição no perfil atual do servidor."}
                  </p>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="link"
              onClick={onEditProfile}
              disabled={busy || !canEditProfile}
            >
              Editar identidade no perfil do servidor
            </Button>
            <p className="text-muted-foreground text-xs">
              Ao abrir o perfil, o rascunho deste assistente será descartado. Nome, descrição, ícone
              e banner não serão sobrescritos pela ativação.
            </p>
            <div className="space-y-2">
              <Label htmlFor="community-category">Categoria da comunidade</Label>
              <select
                id="community-category"
                className={selectClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as CommunityCategory)}
                disabled={busy}
              >
                <option value="">Selecione uma categoria</option>
                {COMMUNITY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="community-interests">Interesses</Label>
              <Input
                id="community-interests"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                disabled={busy}
                placeholder="Ex.: jogos, coop, tecnologia"
                maxLength={400}
              />
              <p className="text-muted-foreground text-xs">
                Até 10 interesses separados por vírgula, com 2 a 30 caracteres cada. Opcional.
              </p>
            </div>
          </>
        )}
        {step === 5 && (
          <>
            <h4 className="font-semibold">Revise antes de {editing ? "salvar" : "ativar"}</h4>
            <dl className="border-border bg-surface grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Servidor</dt>
                <dd className="mt-1 font-medium">{server.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Boas-vindas</dt>
                <dd className="mt-1 flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  {selectedChannel?.name ?? "Canal indisponível"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Categoria</dt>
                <dd className="mt-1">
                  {COMMUNITY_CATEGORIES.find((c) => c.value === category)?.label}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Interesses</dt>
                <dd className="mt-1 break-words">{interests.trim() || "Nenhum selecionado"}</dd>
              </div>
            </dl>
            <ol className="space-y-2">
              {rules.map((rule, index) => (
                <li key={rule.id} className="bg-surface rounded-lg p-3 text-sm">
                  <span className="text-primary mr-2 font-semibold">{index + 1}.</span>
                  <span className="whitespace-pre-wrap break-words">{rule.text}</span>
                </li>
              ))}
            </ol>
            <p className="border-primary/25 bg-primary/5 rounded-xl border p-3 text-sm">
              O mesmo servidor será mantido, sem alterar mensagens, canais, membros, cargos,
              convites, XP ou privacidade. A descoberta pública continua desligada.
            </p>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={busy}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                {editing
                  ? "Confirmo estas alterações na configuração da comunidade."
                  : "Quero ativar a Comunidade LobbyX neste servidor, mantendo os dados e a privacidade atuais."}
              </span>
            </label>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setStep((n) => n - 1);
                setConfirmed(false);
                setError("");
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          {step < 5 ? (
            <Button type="button" onClick={next} disabled={busy}>
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={busy || !canSubmit || !confirmed || conflict}>
              {busy
                ? "Salvando…"
                : editing
                  ? "Salvar configuração"
                  : initial
                    ? "Reativar comunidade"
                    : "Ativar comunidade"}
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
