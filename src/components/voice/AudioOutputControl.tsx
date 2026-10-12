import { useState } from "react";
import { VoiceIcon } from "./VoiceIcon";
import { DeviceSettingsDialog } from "./DeviceSettingsDialog";
import { cn } from "@/lib/utils";

/** Shared split control keeps the same settings arrow for input and output. */
function AudioDeviceControl({
  kind,
  off,
  pressed,
  label,
  settingsLabel,
  active = false,
  compact = false,
  onToggle,
}: {
  kind: "mic" | "headphones";
  off: boolean;
  pressed: boolean;
  label: string;
  settingsLabel: string;
  active?: boolean;
  compact?: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={cn(
          "flex h-9 items-center justify-center rounded-lg",
          pressed ? "text-destructive" : active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={pressed}
          aria-label={label}
          title={label}
          className={cn(
            "flex h-9 items-center justify-center rounded-md hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary",
            compact ? "w-7" : "w-8",
          )}
        >
          <VoiceIcon kind={kind} off={off} className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={settingsLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={settingsLabel}
          className={cn(
            "flex h-9 items-center justify-center rounded-md hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary",
            compact ? "w-3.5" : "w-5",
          )}
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" aria-hidden="true">
            <path
              d="m2.5 4.5 3.5 3.5 3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {open && <DeviceSettingsDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

export function AudioOutputControl({
  deafened,
  onToggle,
  compact = false,
}: {
  deafened: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <AudioDeviceControl
      kind="headphones"
      compact={compact}
      off={deafened}
      pressed={deafened}
      label={deafened ? "Ativar áudio" : "Silenciar áudio"}
      settingsLabel="Configurações de áudio"
      onToggle={onToggle}
    />
  );
}

export function AudioInputControl({
  muted,
  off = muted,
  active = false,
  label,
  onToggle,
  compact = false,
}: {
  muted: boolean;
  off?: boolean;
  active?: boolean;
  label?: string;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <AudioDeviceControl
      kind="mic"
      compact={compact}
      off={off}
      pressed={muted}
      active={active}
      label={label ?? (muted ? "Ativar microfone" : "Silenciar microfone")}
      settingsLabel="Configurações do microfone"
      onToggle={onToggle}
    />
  );
}
