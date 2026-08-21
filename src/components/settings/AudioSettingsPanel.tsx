import { Mic, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useAudioSettings, keyLabel } from "@/hooks/use-audio-settings";
import { cn } from "@/lib/utils";

const DEFAULT_VALUE = "__default__";

function LevelMeter({ level }: { level: number }) {
  return (
    <div className="bg-surface-elevated h-2 w-full overflow-hidden rounded-full">
      <div
        className="bg-primary h-full rounded-full transition-[width] duration-75"
        style={{ width: `${Math.min(100, Math.round(level * 100))}%` }}
      />
    </div>
  );
}

/** Input/output hardware, volumes and input mode — persisted in user preferences. */
export function AudioSettingsPanel({ compact = false }: { compact?: boolean }) {
  const { settings, update, devices, refreshDevices, supportsOutputSelection } = useAudioSettings();
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [capturingKey, setCapturingKey] = useState(false);
  const testRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => () => testRef.current?.stop(), []);

  const stopTest = useCallback(() => {
    testRef.current?.stop();
    testRef.current = null;
    setTesting(false);
    setLevel(0);
  }, []);

  const startTest = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: settings.inputDeviceId ? { deviceId: { exact: settings.inputDeviceId } } : true,
      });
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = settings.inputVolume / 100;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(gain);
      gain.connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        let peak = 0;
        for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128));
        setLevel(Math.min(1, peak / 60));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      testRef.current = {
        stop: () => {
          cancelAnimationFrame(raf);
          stream.getTracks().forEach((track) => track.stop());
          void ctx.close().catch(() => undefined);
        },
      };
      setTesting(true);
      void refreshDevices();
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  }, [settings.inputDeviceId, settings.inputVolume, refreshDevices]);

  const testOutput = useCallback(async () => {
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const dest = ctx.createMediaStreamDestination();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 440;
      gain.gain.value = 0.15 * (settings.outputVolume / 100);
      osc.connect(gain);
      gain.connect(dest);
      const el = document.createElement("audio") as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
      };
      el.srcObject = dest.stream;
      el.autoplay = true;
      if (settings.outputDeviceId && typeof el.setSinkId === "function")
        await el.setSinkId(settings.outputDeviceId).catch(() => undefined);
      osc.start();
      await el.play().catch(() => undefined);
      setTimeout(() => {
        osc.stop();
        el.srcObject = null;
        void ctx.close().catch(() => undefined);
      }, 900);
    } catch {
      toast.error("Não foi possível reproduzir o som de teste.");
    }
  }, [settings.outputDeviceId, settings.outputVolume]);

  useEffect(() => {
    if (!capturingKey) return;
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.code === "Escape") {
        setCapturingKey(false);
        return;
      }
      update({ pttKey: event.code });
      setCapturingKey(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [capturingKey, update]);

  return (
    <div className={cn("space-y-8", compact && "space-y-6")}>
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Mic className="text-primary h-4 w-4" />
          <h3 className="text-sm font-semibold tracking-wide uppercase">Entrada</h3>
        </div>

        <div className="space-y-1.5">
          <Label>Microfone</Label>
          <Select
            value={settings.inputDeviceId ?? DEFAULT_VALUE}
            onValueChange={(value) =>
              update({ inputDeviceId: value === DEFAULT_VALUE ? null : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Microfone padrão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_VALUE}>Microfone padrão</SelectItem>
              {devices.microphones.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {devices.microphones.length === 0 && (
            <p className="text-muted-foreground text-[11px]">
              Autorize o microfone (ou inicie um teste) para listar os dispositivos.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Volume de entrada</Label>
            <span className="text-muted-foreground font-mono text-xs">{settings.inputVolume}%</span>
          </div>
          <Slider
            value={[settings.inputVolume]}
            min={0}
            max={200}
            step={5}
            onValueChange={([value]) => update({ inputVolume: value ?? 100 })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => (testing ? stopTest() : void startTest())}>
              {testing ? "Parar teste" : "🎙️ Testar microfone"}
            </Button>
          </div>
          <LevelMeter level={testing ? level : 0} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Volume2 className="text-primary h-4 w-4" />
          <h3 className="text-sm font-semibold tracking-wide uppercase">Saída</h3>
        </div>

        <div className="space-y-1.5">
          <Label>Saída de áudio</Label>
          <Select
            disabled={!supportsOutputSelection}
            value={settings.outputDeviceId ?? DEFAULT_VALUE}
            onValueChange={(value) =>
              update({ outputDeviceId: value === DEFAULT_VALUE ? null : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Saída padrão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_VALUE}>Saída padrão</SelectItem>
              {devices.outputs.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!supportsOutputSelection && (
            <p className="text-muted-foreground text-[11px]">
              Este navegador usa a saída definida pelo sistema operacional.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Volume de saída</Label>
            <span className="text-muted-foreground font-mono text-xs">
              {settings.outputVolume}%
            </span>
          </div>
          <Slider
            value={[settings.outputVolume]}
            min={0}
            max={200}
            step={5}
            onValueChange={([value]) => update({ outputVolume: value ?? 100 })}
          />
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => void testOutput()}>
          🔊 Testar saída
        </Button>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide uppercase">Modo de entrada</h3>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "open", label: "Microfone aberto" },
              { value: "ptt", label: "Push to Talk" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => update({ inputMode: option.value })}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm transition-all",
                settings.inputMode === option.value
                  ? "border-primary/50 bg-primary/15 text-primary glow-soft"
                  : "border-border bg-surface-elevated text-surface-foreground hover:bg-surface-hover",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {settings.inputMode === "ptt" && (
          <div className="space-y-1.5">
            <Label>Tecla de ativação</Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCapturingKey(true)}
              className="font-mono"
            >
              {capturingKey ? "Pressione uma tecla…" : keyLabel(settings.pttKey)}
            </Button>
            <p className="text-muted-foreground text-[11px]">
              Mantenha a tecla pressionada para transmitir. Solte para silenciar.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
