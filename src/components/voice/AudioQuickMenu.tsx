import { useId, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Headphones,
  Mic,
  Settings2,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAudioSettings } from "@/hooks/audio-settings-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { GlobalVolumeSlider } from "./GlobalVolumeSlider";
import "../settings/audio-settings.css";

export function AudioQuickMenu({
  kind,
  children,
  onSettings,
}: {
  kind: "input" | "output";
  children: ReactNode;
  onSettings: () => void;
}) {
  const group = useId();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const { settings, devices, update, refreshDevices, supportsOutputSelection } = useAudioSettings();
  const input = kind === "input";
  const list = input ? devices.microphones : devices.outputs;
  const selected = (input ? settings.inputDeviceId : settings.outputDeviceId) || "default";
  const label = input ? "Dispositivo de entrada" : "Dispositivo de saída";
  const Icon = input ? Mic : Headphones;
  const allowed = input || supportsOutputSelection;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refreshDevices();
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={12}
        className="audio-quick-menu"
        aria-label={input ? "Menu do microfone" : "Menu do fone"}
      >
        <Popover>
          <PopoverTrigger className="audio-quick-row" disabled={!allowed}>
            <Icon size={20} />
            <span>
              <strong>{label}</strong>
              <small>
                {selected === "default"
                  ? "Padrão do sistema"
                  : list.find((d) => d.deviceId === selected)?.label || "Dispositivo indisponível"}
              </small>
            </span>
            <ChevronRight size={16} />
          </PopoverTrigger>
          <PopoverContent
            side={mobile ? "top" : "right"}
            align={mobile ? "center" : "start"}
            collisionPadding={12}
            sideOffset={10}
            className="audio-device-menu"
            aria-label={label}
          >
            <p className="audio-menu-caption">{input ? "MICROFONES" : "SAÍDAS DE ÁUDIO"}</p>
            <div role="radiogroup" aria-label={label}>
              {[
                { deviceId: "default", label: "Padrão do sistema" },
                ...list.filter((d) => d.deviceId !== "default"),
              ].map((d) => (
                <label
                  data-selected={selected === d.deviceId}
                  className="audio-device-option"
                  key={d.deviceId}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{d.label}</strong>
                    <small>
                      {d.deviceId === "default"
                        ? "Acompanha o sistema operacional"
                        : input
                          ? "Microfone"
                          : "Alto-falantes / fone"}
                    </small>
                  </span>
                  <input
                    type="radio"
                    name={group}
                    value={d.deviceId}
                    checked={selected === d.deviceId}
                    onChange={() =>
                      update(
                        input
                          ? { inputDeviceId: d.deviceId === "default" ? null : d.deviceId }
                          : { outputDeviceId: d.deviceId === "default" ? null : d.deviceId },
                      )
                    }
                  />
                </label>
              ))}
            </div>
            {!list.length && (
              <p className="audio-hint">
                Os nomes ficam disponíveis após autorizar o microfone. Use o teste nas configurações
                de voz.
              </p>
            )}
          </PopoverContent>
        </Popover>
        {input && (
          <div className="audio-quick-profile">
            <SlidersHorizontal size={19} />
            <span>
              <strong>Modo de entrada</strong>
              <small>{settings.inputMode === "ptt" ? "Push to Talk" : "Microfone aberto"}</small>
            </span>
            <select
              aria-label="Modo de entrada"
              value={settings.inputMode}
              onChange={(e) => update({ inputMode: e.target.value === "ptt" ? "ptt" : "open" })}
            >
              <option value="open">Aberto</option>
              <option value="ptt">PTT</option>
            </select>
          </div>
        )}
        {!allowed && (
          <p className="audio-hint">Este navegador utiliza a saída do sistema operacional.</p>
        )}
        {selected !== "default" && !list.some((d) => d.deviceId === selected) && (
          <p role="status" className="audio-hint">
            Dispositivo indisponível. Selecione outro ou use o padrão do sistema.
          </p>
        )}
        <GlobalVolumeSlider
          label={input ? "Volume de entrada" : "Volume de saída"}
          value={input ? settings.inputVolume : settings.outputVolume}
          onChange={(value) => update(input ? { inputVolume: value } : { outputVolume: value })}
        />
        <button
          type="button"
          className="audio-settings-link"
          onClick={() => {
            setOpen(false);
            onSettings();
          }}
        >
          <Settings2 size={19} />
          Configurações de voz
          <ExternalLink size={13} />
        </button>
      </PopoverContent>
    </Popover>
  );
}
