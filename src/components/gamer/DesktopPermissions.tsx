import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gamepad2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  gameElapsed,
  type DesktopActivityState,
  type DesktopPreferenceKey,
} from "@/services/desktop-activity";

export function DesktopPermissions({
  mode = "privacy",
}: {
  mode?: "games" | "privacy" | "system";
}) {
  const [state, setState] = useState<DesktopActivityState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [process, setProcess] = useState("");
  useEffect(() => {
    const api = window.lobbyxDesktop;
    setDesktop(!!api);
    if (!api) return;
    let live = true;
    const read = () =>
      void api
        .activity()
        .then((value) => {
          if (live) setState(value);
        })
        .catch(() => {
          if (live)
            setError("Não foi possível carregar. Reabra as configurações para tentar novamente.");
        });
    read();
    const timer = setInterval(read, 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  async function change(
    key: DesktopPreferenceKey,
    value?: Parameters<NonNullable<Window["lobbyxDesktop"]>["preference"]>[1],
  ) {
    setBusy(true);
    setError("");
    try {
      setState(await window.lobbyxDesktop!.preference(key, value));
      window.dispatchEvent(new Event("lobbyx:activity-changed"));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!desktop)
    return (
      <div className="glass-panel max-w-3xl p-6">
        <h2 className="font-semibold">Disponível no aplicativo para Windows</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          A detecção de jogos e as permissões persistentes são configuradas no aplicativo instalado.
          No navegador, gerencie o microfone e a câmera pelas permissões do site.
        </p>
      </div>
    );
  const game = state?.detectedGame ?? state?.game;
  const permission = (value: boolean | null | undefined) =>
    value === true ? "Permitido" : value === false ? "Bloqueado" : "Ainda não solicitado";
  return (
    <div className="max-w-3xl space-y-8">
      {error && (
        <p
          role="alert"
          className="border-destructive text-destructive rounded-lg border p-4 text-sm"
        >
          {error}
        </p>
      )}
      {!state && <p role="status">Carregando configurações…</p>}
      {mode === "privacy" && (
        <>
          <section>
            <h2 className="mb-6 text-xl font-semibold">O que você compartilha</h2>
            <div className="flex items-start justify-between gap-6">
              <div>
                <h3 id="activity-label" className="font-medium">
                  Compartilhar minha atividade de jogos
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Detecta jogos enquanto o LobbyX está aberto e exibe o nome e o tempo de jogo no
                  seu perfil.
                </p>
              </div>
              <Switch
                aria-labelledby="activity-label"
                checked={state?.enabled ?? false}
                disabled={busy || !state}
                onCheckedChange={(v) => void change("activity", v)}
              />
            </div>
          </section>
          <section className="border-border border-t pt-6">
            <h2 className="mb-2 font-semibold">Sua privacidade</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A lista de processos e o histórico de detecção ficam neste computador. Somente o jogo
              atual e o horário de início são compartilhados. Desativar esta opção interrompe a
              detecção e remove a atividade automática do perfil.
            </p>
            <Link
              to="/settings/profile"
              search={{ section: "games" }}
              className="bg-surface-elevated mt-5 flex items-center gap-3 rounded-xl p-4 hover:opacity-80"
            >
              <Gamepad2 className="text-primary" />
              <div>
                <p className="font-medium">Jogos registrados</p>
                <p className="text-muted-foreground text-sm">
                  Escolha quais jogos podem aparecer no perfil.
                </p>
              </div>
              <span className="ml-auto">→</span>
            </Link>
          </section>
        </>
      )}
      {mode === "games" && (
        <>
          <section>
            <h2 className="mb-4 text-xl font-semibold">Jogo atual</h2>
            <div className="bg-surface-elevated flex items-center gap-4 rounded-xl p-5">
              <Gamepad2 className="text-primary h-9 w-9 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {game?.name ?? (state?.enabled ? "Nenhum jogo detectado" : "Detecção desativada")}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {game
                    ? `Jogando ${gameElapsed(game.startedAt)}`
                    : "Abra um jogo com o LobbyX em execução."}
                </p>
              </div>
              {game && state?.catalog && (
                <Switch
                  aria-label="Compartilhar jogo atual"
                  disabled={busy}
                  checked={
                    state.catalog.find((g) => g.id === (state.detectedGame?.catalogId ?? game.id))
                      ?.enabled ?? false
                  }
                  onCheckedChange={(enabled) =>
                    void change("gameVisibility", {
                      id: state.detectedGame?.catalogId ?? game.id,
                      enabled,
                    })
                  }
                />
              )}
            </div>
            {!state?.enabled && (
              <Button
                className="mt-3"
                variant="outline"
                disabled={busy || !state}
                onClick={() => void change("activity", true)}
              >
                Ativar detecção de jogos
              </Button>
            )}
          </section>
          <section className="border-border border-t pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Jogos registrados</h2>
              <Button
                variant="outline"
                disabled={!state?.catalog || busy}
                onClick={() => setAdding(!adding)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar jogo
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Os controles permitem ou ocultam o compartilhamento de cada jogo neste computador.
            </p>
            {adding && (
              <form
                className="bg-surface-elevated mt-5 space-y-3 rounded-xl p-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await change("addGame", { name, process })) {
                    setName("");
                    setProcess("");
                    setAdding(false);
                  }
                }}
              >
                <label className="block text-sm">
                  Nome do jogo
                  <Input
                    required
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2"
                  />
                </label>
                <label className="block text-sm">
                  Nome do executável (.exe)
                  <Input
                    required
                    placeholder="MeuJogo.exe"
                    value={process}
                    onChange={(e) => setProcess(e.target.value)}
                    className="mt-2"
                  />
                </label>
                <p className="text-muted-foreground text-xs">
                  Use o nome exibido na aba Detalhes do Gerenciador de Tarefas, sem o caminho da
                  pasta.
                </p>
                <Button disabled={busy} type="submit">
                  Adicionar
                </Button>
              </form>
            )}
            <div className="mt-4 divide-y divide-border">
              {state?.catalog?.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {state.detectedGame?.catalogId === item.id
                        ? "Jogando agora"
                        : item.lastPlayed
                          ? `Detectado pela última vez em ${new Date(item.lastPlayed).toLocaleString("pt-BR")}`
                          : "Ainda não detectado neste computador"}
                    </p>
                    {item.id === "aniimo" && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Detecção provisória; executável ainda não confirmado.
                      </p>
                    )}
                  </div>
                  {item.custom && (
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`Remover ${item.name}`}
                      onClick={() => void change("removeGame", item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Switch
                    aria-label={`Compartilhar ${item.name}`}
                    checked={item.enabled}
                    disabled={busy}
                    onCheckedChange={(enabled) =>
                      void change("gameVisibility", { id: item.id, enabled })
                    }
                  />
                </div>
              ))}
            </div>
            {state && !state.catalog && (
              <p className="mt-4 text-sm text-muted-foreground">
                Esta versão instalada ainda não oferece controles individuais. Eles estarão
                disponíveis no próximo instalador atualizado.
              </p>
            )}
          </section>
          <section className="border-border border-t pt-6">
            <label className="block font-medium" htmlFor="league-mode">
              League of Legends e TFT
            </label>
            <p className="text-muted-foreground my-2 text-sm">
              Os dois jogos usam o mesmo executável. Escolha o nome que será exibido.
            </p>
            <select
              id="league-mode"
              className="bg-surface border-border w-full rounded-lg border p-3"
              disabled={busy || !state}
              value={state?.leagueMode ?? "auto"}
              onChange={(e) => void change("leagueMode", e.target.value)}
            >
              <option value="auto">League of Legends / TFT</option>
              <option value="lol">League of Legends</option>
              <option value="tft">Teamfight Tactics</option>
            </select>
          </section>
        </>
      )}
      {mode === "system" && (
        <>
          <section>
            <h2 className="mb-4 text-xl font-semibold">Permissões dos dispositivos</h2>
            <div className="bg-surface-elevated divide-border divide-y rounded-xl px-5">
              <div className="flex justify-between py-4">
                <span>Microfone</span>
                <span className="text-muted-foreground">{permission(state?.microphone)}</span>
              </div>
              <div className="flex justify-between py-4">
                <span>Câmera</span>
                <span className="text-muted-foreground">{permission(state?.camera)}</span>
              </div>
            </div>
            <p className="text-muted-foreground my-4 text-sm">
              As escolhas ficam salvas neste computador. Ao redefinir, o aplicativo pedirá
              autorização no próximo acesso ao dispositivo; uma chamada em andamento não é
              interrompida.
            </p>
            <Button
              variant="outline"
              disabled={busy || !state}
              onClick={() => void change("resetMedia")}
            >
              Redefinir permissões
            </Button>
          </section>
          <section className="border-border border-t pt-6">
            <h2 className="mb-2 font-semibold">Histórico local de jogos</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Limpe as datas de última detecção. Seus jogos registrados e preferências de
              compartilhamento serão mantidos.
            </p>
            <Button
              variant="outline"
              disabled={busy || !state?.catalog}
              onClick={() => void change("clearHistory")}
            >
              Limpar histórico local
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
