import { Mic, Volume2, AudioLines, Keyboard, Zap, Square, Play, Headphones } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NoiseModeSelect, NoiseProcessingFeedback } from "@/components/voice/NoiseModeSelect";
import { AudioDeviceSelect } from "@/components/voice/AudioDeviceSelect";
import { GlobalVolumeSlider } from "@/components/voice/GlobalVolumeSlider";
import { useAudioSettings, keyLabel } from "@/hooks/audio-settings-context";
import { useMicrophoneTest } from "@/hooks/use-microphone-test";
import { cn } from "@/lib/utils";
import "./audio-settings.css";

function LevelMeter({ level, active }: { level: number; active: boolean }) {
  const value = Math.max(0, Math.min(100, Math.round(level * 100)));
  return (
    <div
      className="audio-level-meter"
      role="meter"
      aria-label="Nível do microfone"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={active ? value : 0}
    >
      {Array.from({ length: 48 }, (_, i) => (
        <i key={i} data-lit={active && value > (i * 100) / 48} />
      ))}
    </div>
  );
}

/** Shared by WEB, Desktop and the in-call dialog. All hardware preferences use one context. */
export function AudioSettingsPanel({ compact = false }: { compact?: boolean }) {
  const { settings, update, devices, refreshDevices, supportsOutputSelection } = useAudioSettings();
  const test = useMicrophoneTest();
  const [capturingKey, setCapturingKey] = useState(false);
  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);
  useEffect(() => {
    if (!capturingKey) return;
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.code !== "Escape") update({ pttKey: event.code });
      setCapturingKey(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [capturingKey, update]);

  return (
    <div className={cn("audio-settings-panel", compact && "audio-settings-compact")}>
      <header className="audio-page-heading">
        <span>Configurações</span>
        <h2>Voz e áudio</h2>
        <p>Seu microfone, sua saída de som e o jeito de conversar.</p>
      </header>
      <section className="audio-section">
        <div className="audio-section-heading">
          <div className="audio-section-icon">
            <AudioLines size={24} />
          </div>
          <div>
            <h3>Supressão de ruído</h3>
            <p>Reduza ruídos de fundo nas chamadas de servidores e privadas.</p>
          </div>
          <div className="audio-heading-select">
            <NoiseModeSelect id="noise-suppression" />
          </div>
        </div>
        <p className="audio-section-note">
          A avançada processa sua voz neste dispositivo. Pode reduzir ruídos de fundo, mas outras
          vozes ainda podem ser ouvidas.
        </p>
        <NoiseProcessingFeedback />
      </section>
      <section className="audio-section audio-input-section">
        <div className="audio-section-heading">
          <div className="audio-section-icon audio-icon-lime">
            <Mic size={24} />
          </div>
          <div>
            <h3>Entrada de áudio</h3>
            <p>Selecione e ajuste seu microfone.</p>
          </div>
          <div className="audio-heading-device">
            <AudioDeviceSelect kind="input" />
          </div>
        </div>
        {!devices.microphones.length && (
          <p className="audio-hint">
            Inicie o teste e autorize o microfone para identificar seus dispositivos.
          </p>
        )}
        <GlobalVolumeSlider
          label="Volume de entrada"
          value={settings.inputVolume}
          onChange={(inputVolume) => update({ inputVolume })}
        />
        <div className="audio-test-area" data-active={test.testing}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={test.testing}
            onClick={() => (test.testing ? test.stop() : void test.start())}
          >
            {test.testing ? <Square size={15} /> : <Mic size={15} />}
            {test.testing ? "Parar teste" : "Testar microfone"}
          </Button>
          <div className="audio-test-meter">
            <LevelMeter level={test.level} active={test.testing} />
            <p role="status">
              {test.starting
                ? "Aguardando permissão ou preparando o dispositivo…"
                : test.testing
                  ? "Retorno ativo · sua voz está sendo reproduzida na saída selecionada."
                  : "Teste desligado. Use fones para evitar eco e microfonia."}
            </p>
          </div>
        </div>
        {test.borrowed && (
          <p className="audio-hint">
            Usando o áudio da chamada. Mute e Push to Talk continuam valendo: ative o microfone ou
            segure sua tecla para ouvir o retorno.
          </p>
        )}
        {test.testing && (
          <p className="audio-hint">
            O volume de saída também controla o retorno. O teste para ao fechar esta tela ou trocar
            dispositivos.
          </p>
        )}
        {test.error && (
          <p role="alert" className="audio-error">
            {test.error}
          </p>
        )}
      </section>
      <section className="audio-section">
        <div className="audio-section-heading">
          <div className="audio-section-icon">
            <Volume2 size={24} />
          </div>
          <div>
            <h3>Saída de áudio</h3>
            <p>Escolha onde você quer ouvir.</p>
          </div>
          <div className="audio-heading-device">
            <AudioDeviceSelect kind="output" />
          </div>
        </div>
        {!supportsOutputSelection && (
          <p className="audio-hint">
            Este navegador utiliza a saída definida no sistema operacional.
          </p>
        )}
        <GlobalVolumeSlider
          label="Volume de saída"
          value={settings.outputVolume}
          onChange={(outputVolume) => update({ outputVolume })}
        />
        <div className="audio-speaker-test">
          <Button type="button" variant="outline" size="sm" onClick={() => void test.testOutput()}>
            <Play size={14} />
            Testar saída
          </Button>
          <span>Reproduz um som curto na saída selecionada.</span>
        </div>
        <div className="audio-call-sounds">
          <Label htmlFor="call-sounds">Efeitos sonoros de chamadas e controles de áudio</Label>
          <Switch
            id="call-sounds"
            checked={settings.callSoundsEnabled}
            onCheckedChange={(callSoundsEnabled) => update({ callSoundsEnabled })}
          />
        </div>
      </section>
      <section className="audio-section">
        <div className="audio-section-heading">
          <div className="audio-section-icon audio-icon-lime">
            <Zap size={24} />
          </div>
          <div>
            <h3>Modo de entrada</h3>
            <p>Escolha como seu microfone será ativado nas chamadas.</p>
          </div>
        </div>
        <div className="audio-input-modes" role="radiogroup" aria-label="Modo de entrada">
          {(
            [
              {
                value: "open",
                label: "Microfone aberto",
                hint: "Seu microfone fica sempre ativo.",
                icon: Mic,
              },
              {
                value: "ptt",
                label: "Push to Talk",
                hint: "Aperte uma tecla para falar.",
                icon: Keyboard,
              },
            ] as const
          ).map(({ value, label, hint, icon: Icon }) => (
            <label
              className="audio-input-mode"
              key={value}
              data-selected={settings.inputMode === value}
            >
              <Icon size={22} />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
              <input
                type="radio"
                name="voice-input-mode"
                value={value}
                checked={settings.inputMode === value}
                onChange={() => update({ inputMode: value })}
              />
            </label>
          ))}
        </div>
        {settings.inputMode === "ptt" && (
          <div className="audio-ptt-key">
            <Label>Tecla de ativação</Label>
            <Button type="button" variant="outline" onClick={() => setCapturingKey(true)}>
              {capturingKey ? "Pressione uma tecla… (Esc cancela)" : keyLabel(settings.pttKey)}
            </Button>
            <p>Mantenha pressionada para transmitir. Solte para silenciar.</p>
          </div>
        )}
      </section>
      <p className="audio-footer">
        <Headphones size={14} />
        Volumes globais limitados a 100%, sem amplificação adicional.
      </p>
    </div>
  );
}
