import { useState } from "react";
import { VoiceIcon } from "./VoiceIcon";
import { DeviceSettingsDialog } from "./DeviceSettingsDialog";
import { cn } from "@/lib/utils";

/** Headphones and the separate audio settings arrow from the reference. */
export function AudioOutputControl({
  deafened,
  onToggle,
}: {
  deafened: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={cn(
          "flex h-9 items-center justify-center rounded-lg",
          deafened ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={deafened}
          aria-label={deafened ? "Ativar áudio" : "Silenciar áudio"}
          title={deafened ? "Ativar áudio" : "Silenciar áudio"}
          className="flex h-9 w-8 items-center justify-center rounded-md hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <VoiceIcon kind="headphones" off={deafened} className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Configurações de áudio"
          aria-haspopup="dialog"
          aria-expanded={open}
          title="Configurações de áudio"
          className="flex h-9 w-5 items-center justify-center rounded-md hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
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
