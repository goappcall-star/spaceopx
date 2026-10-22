import { useState } from "react";
import { Mic, Headphones, ChevronDown } from "lucide-react";
import { AudioSettingsPanel } from "@/components/settings/AudioSettingsPanel";
import { AudioQuickMenu } from "@/components/voice/AudioQuickMenu";
import {
  AudioSettingsContext,
  DEFAULT_AUDIO_SETTINGS,
  type AudioSettings,
} from "@/hooks/audio-settings-context";
import { clampGlobalVolume } from "@/lib/audio-volume";
import { Button } from "@/components/ui/button";
import type { MediaDeviceList } from "@/services/voice";

const fixture: MediaDeviceList = {
  cameras: [],
  microphones: [
    { deviceId: "h858", label: "H858 Wireless headset" },
    { deviceId: "steam", label: "Steam Streaming Microphone" },
    { deviceId: "controller", label: "Wireless Controller" },
    { deviceId: "droid", label: "DroidCam Virtual Audio" },
  ],
  outputs: [
    { deviceId: "h858-out", label: "H858 Wireless headset" },
    { deviceId: "speakers", label: "Alto-falantes do monitor" },
  ],
};

export function AudioPreview() {
  const [settings, setSettings] = useState<AudioSettings>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lobbyx-audio-preview-only") || "null");
      return {
        ...DEFAULT_AUDIO_SETTINGS,
        ...saved,
        inputVolume: clampGlobalVolume(saved?.inputVolume),
        outputVolume: clampGlobalVolume(saved?.outputVolume),
      };
    } catch {
      return DEFAULT_AUDIO_SETTINGS;
    }
  });
  const [devices, setDevices] = useState(fixture);
  const [real, setReal] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [session, setSession] = useState(1);
  const [visible, setVisible] = useState(true);
  const update = (patch: Partial<AudioSettings>) =>
    setSettings((old) => {
      const next = {
        ...old,
        ...patch,
        inputVolume: clampGlobalVolume(patch.inputVolume ?? old.inputVolume),
        outputVolume: clampGlobalVolume(patch.outputVolume ?? old.outputVolume),
      };
      localStorage.setItem("lobbyx-audio-preview-only", JSON.stringify(next));
      return next;
    });
  const refreshDevices = async () => {
    if (!real || !navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    const list = (kind: MediaDeviceKind) =>
      all
        .filter((d) => d.kind === kind && d.deviceId)
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Dispositivo ${i + 1}` }));
    setDevices({ microphones: list("audioinput"), outputs: list("audiooutput"), cameras: [] });
  };
  return (
    <AudioSettingsContext.Provider
      value={{
        settings,
        update,
        devices,
        refreshDevices,
        supportsOutputSelection: "setSinkId" in HTMLMediaElement.prototype,
        loaded: true,
        noiseProcessing: {},
        reportNoiseProcessing: () => {},
        sessionKey: `fixture-${session}`,
      }}
    >
      <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
        <p className="rounded-xl border border-primary/30 p-3 text-xs text-muted-foreground">
          Prévia local isolada. Nomes de dispositivos são fictícios inicialmente. Preferências
          salvas apenas neste navegador, sem conta ou chamadas reais. O teste de microfone é real e
          só inicia ao clicar; use fones.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setReal(true);
              update({ inputDeviceId: null, outputDeviceId: null });
            }}
          >
            Usar dispositivos deste computador
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSession((s) => s + 1)}>
            Simular troca de conta
          </Button>
          <Button variant="outline" size="sm" onClick={() => setVisible(!visible)}>
            {visible ? "Fechar configurações" : "Abrir configurações"}
          </Button>
        </div>
        <div
          className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-3"
          aria-label="Demonstração dos controles rápidos"
        >
          <button
            type="button"
            aria-label="Alternar mute na demonstração"
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
            className="rounded-xl border border-border p-3"
          >
            <Mic size={18} />
          </button>
          <AudioQuickMenu
            kind="input"
            onSettings={() => {
              setVisible(true);
              document.getElementById("audio-preview-panel")?.scrollIntoView({ block: "start" });
            }}
          >
            <button type="button" aria-label="Menu do microfone" className="rounded-lg p-2">
              <ChevronDown size={14} />
            </button>
          </AudioQuickMenu>
          <button
            type="button"
            aria-label="Alternar fone na demonstração"
            aria-pressed={deafened}
            onClick={() => setDeafened(!deafened)}
            className="rounded-xl border border-border p-3"
          >
            <Headphones size={18} />
          </button>
          <AudioQuickMenu
            kind="output"
            onSettings={() => {
              setVisible(true);
              document.getElementById("audio-preview-panel")?.scrollIntoView({ block: "start" });
            }}
          >
            <button type="button" aria-label="Menu do fone" className="rounded-lg p-2">
              <ChevronDown size={14} />
            </button>
          </AudioQuickMenu>
          <span className="text-xs text-muted-foreground">
            Setas: menus reais · botões de mute: simulação
          </span>
        </div>
        <div id="audio-preview-panel">{visible && <AudioSettingsPanel />}</div>
      </div>
    </AudioSettingsContext.Provider>
  );
}
