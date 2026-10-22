import { ALargeSmall, Contrast, Zap, Focus, Keyboard, Layers } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { AccessibilityPreferences } from "@/lib/accessibility";
import "./accessibility-settings.css";
interface Props {
  preview?: boolean;
  preferences: AccessibilityPreferences;
  systemReduced: boolean;
  storageAvailable?: boolean;
  onChange: (update: Partial<AccessibilityPreferences>) => void;
}
export function AccessibilitySettingsView({
  preview = false,
  preferences: prefs,
  systemReduced,
  storageAvailable = true,
  onChange,
}: Props) {
  const rows = [
    {
      key: "contrast",
      title: "Contraste elevado",
      description:
        "Aumenta o contraste das cores da interface para melhorar a legibilidade de textos, ícones e elementos.",
      Icon: Contrast,
    },
    {
      key: "reducedMotion",
      title: "Redução de movimento",
      description:
        "Diminui ou desativa animações e efeitos de transição para uma experiência mais confortável.",
      Icon: Zap,
    },
    {
      key: "focus",
      title: "Indicadores de foco",
      description:
        "Exibe contornos visíveis ao navegar por teclado, facilitando a identificação do elemento em foco.",
      Icon: Focus,
    },
    {
      key: "keyboard",
      title: "Navegação por teclado",
      description:
        "Permite navegar por toda a interface usando apenas o teclado, com atalhos e foco visível nos elementos.",
      Icon: Keyboard,
    },
    {
      key: "reducedTransparency",
      title: "Redução de transparências",
      description:
        "Diminui efeitos de vidro e transparência na interface para aumentar o contraste e reduzir distrações visuais.",
      Icon: Layers,
    },
  ] as const;
  return (
    <div className="a11y-settings-content">
      <section className="a11y-settings-card" aria-label="Conforto e acessibilidade">
        <div className="a11y-settings-row a11y-text-row">
          <span className="a11y-setting-icon">
            <ALargeSmall size={28} />
          </span>
          <div className="a11y-setting-copy">
            <h2>Tamanho e espaçamento do texto</h2>
            <p>
              Altere o tamanho da fonte e o espaçamento para facilitar a leitura em toda a interface
              do LobbyX.
            </p>
          </div>
          <div
            className="a11y-text-choices"
            role="group"
            aria-label="Tamanho e espaçamento do texto"
          >
            {(
              [
                { value: "compact", label: "Compacto" },
                { value: "normal", label: "Normal" },
                { value: "large", label: "Ampliado" },
              ] as const
            ).map(({ value, label }) => (
              <button
                type="button"
                key={value}
                aria-pressed={prefs.text === value}
                onClick={() => onChange({ text: value })}
              >
                <span aria-hidden="true" className={`a11y-size-${value}`}>
                  Aa
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>
        {rows.map(({ key, title, description, Icon }) => (
          <div className="a11y-settings-row" key={key}>
            <span className={`a11y-setting-icon ${key === "contrast" ? "a11y-icon-green" : ""}`}>
              <Icon size={28} />
            </span>
            <div className="a11y-setting-copy">
              <h2>{title}</h2>
              <p id={`a11y-description-${key}`}>{description}</p>
              {key === "reducedMotion" && systemReduced && (
                <small>
                  Ativa pela preferência do sistema. Essa proteção continua mesmo com a opção local
                  desligada.
                </small>
              )}
              {key === "keyboard" && prefs.keyboard && (
                <small>
                  Use Tab para acessar “Ir para o conteúdo” e “Ir para a navegação”. A navegação
                  básica por Tab permanece disponível com esta opção desligada.
                </small>
              )}
            </div>
            <Switch
              className="a11y-setting-switch"
              aria-label={title}
              aria-describedby={`a11y-description-${key}`}
              checked={prefs[key]}
              onCheckedChange={(value) => onChange({ [key]: value })}
            />
          </div>
        ))}
      </section>
      <p className="a11y-persistence" role="status">
        {preview
          ? "Prévia: ajustes aplicados somente nesta área, sem salvar preferências reais."
          : storageAvailable
            ? "Ajustes aplicados automaticamente e salvos neste dispositivo. Suas preferências de Aparência e Desempenho são preservadas."
            : "O armazenamento não está disponível. Os ajustes estão ativos somente nesta sessão."}
      </p>
    </div>
  );
}
