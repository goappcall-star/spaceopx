import { useState, type ReactNode, type CSSProperties } from "react";
import {
  Palette,
  Eye,
  Sun,
  Moon,
  Monitor,
  WandSparkles,
  Layers,
  Blend,
  Zap,
  Play,
  PanelsTopLeft,
  ChartNoAxesColumnIncreasing,
  Gauge,
  Leaf,
  Sparkles,
  Home,
  List,
  Settings,
  Mic,
  Headphones,
  Volume2,
  Search,
  Users,
  Gamepad2,
  ChevronDown,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  APPEARANCE_ACCENTS,
  APPEARANCE_QUALITIES,
  appearancePreviewPolicy,
  type AppearancePreferences,
} from "@/lib/appearance-settings";
import type { ThemeMode } from "@/lib/theme";
import type { VisualQuality } from "@/lib/visual-quality";
import "./appearance-settings.css";

interface Props {
  preferences: AppearancePreferences;
  theme: ThemeMode;
  effectiveTheme: "light" | "dark";
  quality: VisualQuality;
  reducedMotion: boolean;
  disabled?: boolean;
  error?: string | undefined;
  feedback?: string | undefined;
  monitor?: ReactNode;
  onPreference: (update: Partial<AppearancePreferences>) => void;
  onTheme: (mode: ThemeMode) => void;
  onQuality: (quality: VisualQuality) => void;
}
export function AppearanceSettingsView({
  preferences: prefs,
  theme,
  effectiveTheme,
  quality,
  reducedMotion,
  disabled,
  error,
  feedback,
  monitor,
  onPreference,
  onTheme,
  onQuality,
}: Props) {
  const policy = appearancePreviewPolicy(prefs, quality, reducedMotion);
  const [sampleMuted, setSampleMuted] = useState(false),
    [sampleDeafened, setSampleDeafened] = useState(false),
    [sampleVolume, setSampleVolume] = useState(60),
    [sampleOnlineOnly, setSampleOnlineOnly] = useState(false);
  const previewStyle = {
    "--appearance-accent": policy.accent,
    "--appearance-alpha": policy.alpha,
  } as CSSProperties;
  return (
    <div className="appearance-page-content">
      <div className="appearance-page-grid">
        <div className="appearance-main-column">
          <section className="appearance-panel">
            <header>
              <span className="appearance-heading-icon">
                <Palette size={23} />
              </span>
              <div>
                <h2>Personalização visual</h2>
                <p>Ajuste o tema, cores e efeitos visuais da interface.</p>
              </div>
            </header>
            <fieldset disabled={disabled} className="appearance-controls">
              <legend className="sr-only">Personalização visual</legend>
              <div className="appearance-control-column">
                <div className="appearance-control-section">
                  <h3>
                    <Sun size={19} />
                    Tema
                  </h3>
                  <div className="appearance-choice-row">
                    {(
                      [
                        { value: "dark", label: "Escuro", Icon: Moon },
                        { value: "light", label: "Claro", Icon: Sun },
                        { value: "system", label: "Automático", Icon: Monitor },
                      ] as const
                    ).map(({ value, label, Icon }) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={theme === value}
                        onClick={() => onTheme(value)}
                      >
                        <Icon size={16} />
                        {label}
                      </button>
                    ))}
                  </div>
                  <p>Define o tema geral da interface. Automático acompanha o tema do sistema.</p>
                </div>
                <div className="appearance-control-section">
                  <h3>
                    <WandSparkles size={19} />
                    Cor de destaque
                  </h3>
                  <div className="appearance-swatches">
                    {APPEARANCE_ACCENTS.map((accent) => (
                      <button
                        type="button"
                        key={accent.value}
                        aria-label={accent.label}
                        title={accent.label}
                        aria-pressed={prefs.accent_color === accent.value}
                        style={{
                          background: `linear-gradient(135deg, ${accent.color}, ${accent.color}bb)`,
                        }}
                        onClick={() => onPreference({ accent_color: accent.value })}
                      />
                    ))}
                  </div>
                  <p>
                    Define a cor de destaque utilizada em botões, seleções e elementos da interface.
                  </p>
                </div>
                <div className="appearance-control-section">
                  <h3>
                    <Layers size={19} />
                    Densidade da interface
                  </h3>
                  <div className="appearance-choice-row appearance-density">
                    {[
                      { name: "Compacta", description: "Mais conteúdo" },
                      { name: "Normal", description: "Equilíbrio ideal" },
                      { name: "Confortável", description: "Mais espaçamento" },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.name}
                        disabled
                        aria-pressed={item.name === "Normal"}
                      >
                        <div>
                          {item.name}
                          <small>{item.description}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p>
                    Densidade ajustável ainda indisponível. O espaçamento padrão do LobbyX é
                    preservado.
                  </p>
                </div>
                <div className="appearance-control-section">
                  <h3>
                    <Blend size={19} />
                    Transparência
                  </h3>
                  <div className="appearance-choice-row appearance-transparency">
                    {(
                      [
                        { value: "none", label: "Nenhuma" },
                        { value: "low", label: "Baixa" },
                        { value: "medium", label: "Média" },
                        { value: "high", label: "Alta" },
                      ] as const
                    ).map(({ value, label }) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={prefs.transparency_level === value}
                        onClick={() => onPreference({ transparency_level: value })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p>Controla o nível de transparência das janelas e painéis.</p>
                </div>
              </div>
              <div className="appearance-effects-column">
                <label className="appearance-toggle">
                  <Zap size={20} />
                  <span>
                    <strong>Glow neon</strong>
                    <small>Adiciona um brilho sutil nos elementos em destaque.</small>
                  </span>
                  <Switch
                    aria-label="Glow neon"
                    checked={prefs.glow_enabled}
                    onCheckedChange={(value) => onPreference({ glow_enabled: value })}
                  />
                </label>
                <label className="appearance-toggle">
                  <Play size={20} />
                  <span>
                    <strong>Animações da interface</strong>
                    <small>Deixa a navegação mais fluida e dinâmica.</small>
                  </span>
                  <Switch
                    aria-label="Animações da interface"
                    checked={prefs.animations_enabled}
                    onCheckedChange={(value) => onPreference({ animations_enabled: value })}
                  />
                </label>
                <label className="appearance-toggle">
                  <PanelsTopLeft size={20} />
                  <span>
                    <strong>Animações das molduras</strong>
                    <small>Ativa os efeitos das molduras do avatar e perfil.</small>
                  </span>
                  <Switch
                    aria-label="Animações das molduras"
                    checked={prefs.frame_animations_enabled}
                    onCheckedChange={(value) => onPreference({ frame_animations_enabled: value })}
                  />
                </label>
                <div
                  className="appearance-component-preview appearance-demo"
                  style={previewStyle}
                  data-theme={effectiveTheme}
                  data-glow={policy.glow}
                  data-motion={policy.animations}
                  data-frames={policy.frames}
                >
                  <h3>
                    <Eye size={18} />
                    Prévia de componentes
                  </h3>
                  <p>Exemplos ilustrativos com suas configurações.</p>
                  <div className="appearance-demo-buttons">
                    <button
                      type="button"
                      className="appearance-demo-primary"
                      onClick={() => setSampleOnlineOnly((value) => !value)}
                    >
                      Botão principal
                    </button>
                    <button type="button" onClick={() => setSampleOnlineOnly(false)}>
                      Botão secundário
                    </button>
                  </div>
                  <div className="appearance-demo-channel">
                    <Volume2 size={16} />
                    <span>Canal de voz</span>
                    <input
                      type="range"
                      aria-label="Volume de demonstração"
                      min={0}
                      max={100}
                      value={sampleVolume}
                      onChange={(event) =>
                        setSampleVolume(Math.max(0, Math.min(100, Number(event.target.value))))
                      }
                    />
                  </div>
                  <div className="appearance-demo-user">
                    <span className="appearance-sample-avatar">L</span>
                    <div>
                      <strong>Lunaris</strong>
                      <small>Exemplo de perfil</small>
                    </div>
                    <button
                      type="button"
                      aria-label="Microfone da demonstração"
                      aria-pressed={sampleMuted}
                      onClick={() => setSampleMuted((value) => !value)}
                    >
                      <Mic size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Fone da demonstração"
                      aria-pressed={sampleDeafened}
                      onClick={() => setSampleDeafened((value) => !value)}
                    >
                      <Headphones size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </fieldset>
          </section>
          <section className="appearance-panel appearance-performance">
            <header>
              <span className="appearance-heading-icon">
                <ChartNoAxesColumnIncreasing size={24} />
              </span>
              <div>
                <h2>Desempenho</h2>
                <p>Ajuste os recursos visuais para computadores mais fracos.</p>
              </div>
              <div className="appearance-monitor-link">{monitor}</div>
            </header>
            <fieldset disabled={disabled}>
              <legend className="sr-only">Desempenho</legend>
              <label className="appearance-toggle">
                <Gauge size={20} />
                <span>
                  <strong>Modo Desempenho</strong>
                  <small>Reduz efeitos visuais e animações para melhorar o desempenho.</small>
                </span>
                <Switch
                  aria-label="Modo Desempenho"
                  checked={quality !== "normal"}
                  onCheckedChange={(value) => onQuality(value ? "optimized" : "normal")}
                />
              </label>
              <div className="appearance-control-section">
                <h3>
                  <Monitor size={19} />
                  Nível visual
                </h3>
                <div className="appearance-choice-row appearance-quality">
                  {APPEARANCE_QUALITIES.map(({ value, label, description }) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={quality === value}
                      onClick={() => onQuality(value)}
                    >
                      {value === "normal" ? (
                        <Sparkles size={18} />
                      ) : value === "optimized" ? (
                        <Leaf size={18} />
                      ) : (
                        <Zap size={18} />
                      )}
                      <div>
                        {label}
                        <small>{description}</small>
                      </div>
                    </button>
                  ))}
                </div>
                <p>
                  Otimizado congela molduras e reduz blur e brilhos. Desempenho Máximo também
                  elimina transições e animações da interface.
                </p>
                <p>
                  Salvo neste dispositivo. As preferências de personalização são preservadas. O
                  nível “Elevado” ainda não existe nesta versão.
                </p>
              </div>
            </fieldset>
          </section>
        </div>
        <aside className="appearance-panel appearance-preview-panel">
          <header>
            <span className="appearance-heading-icon">
              <Eye size={23} />
            </span>
            <div>
              <h2>Pré-visualização</h2>
              <p>Veja como o LobbyX ficará com essas configurações.</p>
            </div>
          </header>
          <div
            className="appearance-preview-stage appearance-demo"
            style={previewStyle}
            data-theme={effectiveTheme}
            data-glow={policy.glow}
            data-motion={policy.animations}
            data-frames={policy.frames}
          >
            <div className="appearance-mini-app">
              <div className="appearance-mini-title">
                <img src="/lobbyx-logo.png" alt="" />
                <strong>LobbyX</strong>
                <span>— □ ×</span>
              </div>
              <div className="appearance-mini-body">
                <div className="appearance-mini-rail" aria-hidden="true">
                  <Home />
                  <List />
                  <Users />
                  <Settings />
                </div>
                <div className="appearance-mini-friends">
                  <header>
                    <strong>Amigos</strong>
                    <Search size={17} />
                  </header>
                  <button
                    type="button"
                    className="appearance-sample-filter"
                    aria-pressed={sampleOnlineOnly}
                    onClick={() => setSampleOnlineOnly((value) => !value)}
                  >
                    {sampleOnlineOnly ? "Somente online" : "Todos os amigos"}
                    <ChevronDown size={14} />
                  </button>
                  {[
                    { name: "Lunaris", status: "Online", color: "#8deb5b" },
                    { name: "Kael", status: "Em jogo", color: "#a475ff" },
                    { name: "Mizu", status: "Ausente", color: "#ffbc52" },
                    { name: "Nyx", status: "Online", color: "#8deb5b" },
                    { name: "Zarek", status: "Em call", color: "#a475ff" },
                  ]
                    .filter((friend) => !sampleOnlineOnly || friend.status === "Online")
                    .map((friend, index) => (
                      <div className="appearance-mini-friend" key={friend.name}>
                        <span
                          className="appearance-sample-avatar"
                          style={{
                            background: `linear-gradient(145deg, ${friend.color}66, #151225)`,
                          }}
                        >
                          {friend.name.slice(0, 1)}
                        </span>
                        <div>
                          <strong>{friend.name}</strong>
                          <small>
                            <i style={{ background: friend.color }} />
                            {friend.status}
                          </small>
                        </div>
                        {index === 0 && <Gamepad2 size={16} />}
                      </div>
                    ))}
                  <small className="appearance-fixture-caption">
                    Interface ilustrativa · perfis fictícios
                  </small>
                </div>
              </div>
              <div className="appearance-mini-hotbar">
                <span className="appearance-sample-avatar">L</span>
                <div>
                  <strong>Lunaris</strong>
                  <small>
                    {sampleDeafened
                      ? "Fone silenciado"
                      : sampleMuted
                        ? "Microfone silenciado"
                        : "Disponível"}
                  </small>
                </div>
                <button
                  type="button"
                  aria-label="Microfone na prévia"
                  aria-pressed={sampleMuted}
                  onClick={() => setSampleMuted((value) => !value)}
                >
                  <Mic size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Fone na prévia"
                  aria-pressed={sampleDeafened}
                  onClick={() => setSampleDeafened((value) => !value)}
                >
                  <Headphones size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="appearance-preview-tip">
            <Sparkles size={24} />
            <div>
              <strong>A pré-visualização é interativa</strong>
              <p>
                Altere as configurações ao lado para ver as mudanças em tempo real. Os controles de
                demonstração não afetam suas chamadas.
              </p>
            </div>
          </div>
        </aside>
      </div>
      {error && (
        <p role="alert" className="appearance-error">
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="appearance-feedback">
          {feedback}
        </p>
      )}
    </div>
  );
}
