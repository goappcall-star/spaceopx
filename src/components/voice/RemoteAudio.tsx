import { useEffect, useRef } from "react";

import { useAudioSettings } from "@/hooks/use-audio-settings";
import { useVoice } from "@/hooks/use-voice";

function AudioSink({
  stream,
  volume,
  deafened,
  outputId,
}: {
  stream: MediaStream;
  volume: number;
  deafened: boolean;
  outputId?: string | undefined;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [stream]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = deafened ? 0 : Math.min(1, volume / 100);
  }, [volume, deafened]);

  useEffect(() => {
    const el = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el || !outputId || typeof el.setSinkId !== "function") return;
    void el.setSinkId(outputId).catch(() => undefined);
  }, [outputId]);

  return <audio ref={ref} autoPlay />;
}

/** Plays every remote participant's audio, honouring deafen and per-user volume. */
export function RemoteAudio() {
  const { remoteMedia, volumes, deafened } = useVoice();
  const { settings } = useAudioSettings();

  return (
    <div className="sr-only" aria-hidden>
      {Object.entries(remoteMedia).map(([userId, media]) =>
        media.audio ? (
          <AudioSink
            key={userId}
            stream={media.audio}
            volume={((volumes[userId] ?? 100) * settings.outputVolume) / 100}
            deafened={deafened}
            outputId={settings.outputDeviceId ?? undefined}
          />
        ) : null,
      )}
    </div>
  );
}
