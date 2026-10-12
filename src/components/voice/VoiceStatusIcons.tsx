import { VoiceIcon } from "./VoiceIcon";

export function VoiceStatusIcons({ muted, deafened }: { muted: boolean; deafened: boolean }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
      {(muted || deafened) && (
        <span title="Microfone silenciado" aria-label="Microfone silenciado">
          <VoiceIcon kind="mic" off className="h-3.5 w-3.5" />
        </span>
      )}
      {deafened && (
        <span title="Áudio silenciado" aria-label="Áudio silenciado">
          <VoiceIcon kind="headphones" off className="h-3.5 w-3.5" />
        </span>
      )}
    </span>
  );
}
