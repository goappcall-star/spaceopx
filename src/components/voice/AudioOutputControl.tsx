import { useState } from "react";
import { AudioQuickMenu } from "./AudioQuickMenu";
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
  boxed = false,
  onToggle,
}: {
  kind: "mic" | "headphones";
  off: boolean;
  pressed: boolean;
  label: string;
  settingsLabel: string;
  active?: boolean;
  compact?: boolean;
  boxed?: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={cn(
          "flex items-center justify-center",
          boxed ? "h-11 gap-0.5" : "h-9 rounded-lg",
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
            "flex items-center justify-center focus-visible:outline-2 focus-visible:outline-primary",
            boxed
              ? cn(
                  "h-11 w-11 rounded-xl border transition-colors",
                  pressed
                    ? "border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25"
                    : active
                      ? "border-primary/50 bg-primary/15 text-primary glow-soft hover:bg-primary/25"
                      : "border-border bg-surface-elevated text-surface-foreground hover:bg-surface-hover hover:text-foreground",
                )
              : cn(
                  "h-9 rounded-md hover:bg-surface-hover hover:text-foreground",
                  compact ? "w-7" : "w-8",
                ),
          )}
        >
          <VoiceIcon kind={kind} off={off} className="h-[18px] w-[18px]" />
        </button>
        <AudioQuickMenu kind={kind === "mic" ? "input" : "output"} onSettings={() => setOpen(true)}>
          <button
            type="button"
            aria-label={settingsLabel}
            title={settingsLabel}
            className={cn(
              "flex items-center justify-center rounded-md hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary data-[state=open]:bg-primary/10 data-[state=open]:text-primary [&[data-state=open]>svg]:rotate-180",
              boxed ? "h-11" : "h-9",
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
        </AudioQuickMenu>
      </div>
      {open && <DeviceSettingsDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

export function AudioOutputControl({
  deafened,
  onToggle,
  compact = false,
  boxed = false,
}: {
  deafened: boolean;
  onToggle: () => void;
  compact?: boolean;
  boxed?: boolean;
}) {
  return (
    <AudioDeviceControl
      kind="headphones"
      compact={compact}
      boxed={boxed}
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
  boxed = false,
}: {
  muted: boolean;
  off?: boolean;
  active?: boolean;
  label?: string;
  onToggle: () => void;
  compact?: boolean;
  boxed?: boolean;
}) {
  return (
    <AudioDeviceControl
      kind="mic"
      compact={compact}
      boxed={boxed}
      off={off}
      pressed={muted}
      active={active}
      label={label ?? (muted ? "Ativar microfone" : "Silenciar microfone")}
      settingsLabel="Configurações do microfone"
      onToggle={onToggle}
    />
  );
}
