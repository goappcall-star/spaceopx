import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { useVoice } from "@/hooks/use-voice";

function AudioSink({
  stream,
  volume,
  deafened,
  outputId,
  onBlocked,
  unlockToken,
}: {
  stream: MediaStream;
  volume: number;
  deafened: boolean;
  outputId?: string | undefined;
  onBlocked: (blocked: boolean) => void;
  unlockToken: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  const attemptPlay = useCallback(async () => {
    const el = ref.current;
    if (!el || !el.srcObject) return;
    try {
      await el.play();
      onBlocked(false);
    } catch (error) {
      if ((error as DOMException)?.name === "NotAllowedError") onBlocked(true);
    }
  }, [onBlocked]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = false;
    void attemptPlay();
  }, [stream, attemptPlay, unlockToken]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const safe = Number.isFinite(volume) ? volume : 100;
    el.volume = deafened ? 0 : Math.max(0, Math.min(1, safe / 100));
  }, [volume, deafened]);

  useEffect(() => {
    const el = ref.current as
      | (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (!el || !outputId || typeof el.setSinkId !== "function") return;
    void el.setSinkId(outputId).catch(() => undefined);
  }, [outputId]);

  return <audio ref={ref} autoPlay playsInline />;
}

/** Plays every remote participant's audio, honouring deafen and per-user volume. */
export function RemoteAudio() {
  const { remoteMedia, volumes, deafened } = useVoice();
  const { settings } = useAudioSettings();
  const [blocked, setBlocked] = useState(false);
  const [unlockToken, setUnlockToken] = useState(0);

  return (
    <>
      <div className="sr-only" aria-hidden>
        {Object.entries(remoteMedia).map(([userId, media]) =>
          media.audio ? (
            <AudioSink
              key={userId}
              stream={media.audio}
              volume={((volumes[userId] ?? 100) * settings.outputVolume) / 100}
              deafened={deafened}
              outputId={settings.outputDeviceId ?? undefined}
              onBlocked={setBlocked}
              unlockToken={unlockToken}
            />
          ) : null,
        )}
      </div>
      {blocked && (
        <div className="flex justify-center pb-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBlocked(false);
              setUnlockToken((value) => value + 1);
            }}
          >
            Ativar áudio da sala
          </Button>
        </div>
      )}
    </>
  );
}
