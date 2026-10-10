import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { useVoice } from "@/hooks/use-voice";
import { receivedAudioVolume } from "@/lib/audio-volume";
import { voiceDiagnostic, voiceErrorName } from "@/services/voice-diagnostics";

function AudioSink({
  sinkId,
  stream,
  volume,
  deafened,
  outputId,
  onBlocked,
  unlockToken,
}: {
  sinkId: string;
  stream: MediaStream;
  volume: number;
  deafened: boolean;
  outputId?: string | undefined;
  onBlocked: (sinkId: string, blocked: boolean) => void;
  unlockToken: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  const attemptPlay = useCallback(async () => {
    const el = ref.current;
    if (!el || !el.srcObject) return;
    try {
      await el.play();
      voiceDiagnostic("audio-playback", "player-started");
      onBlocked(sinkId, false);
    } catch (error) {
      voiceDiagnostic("audio-playback", voiceErrorName(error));
      if ((error as DOMException)?.name === "NotAllowedError") onBlocked(sinkId, true);
    }
  }, [onBlocked, sinkId]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      el?.pause();
      if (el) el.srcObject = null;
      onBlocked(sinkId, false);
    };
  }, [onBlocked, sinkId]);

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
    el.volume = receivedAudioVolume(safe, 100, deafened);
  }, [volume, deafened]);

  useEffect(() => {
    const el = ref.current as
      (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el || typeof el.setSinkId !== "function") return;
    void el.setSinkId(outputId ?? "").catch(() => undefined);
  }, [outputId]);

  return <audio ref={ref} autoPlay playsInline />;
}

/** Plays every remote participant's audio, honouring deafen and per-user volume. */
export function RemoteAudio() {
  const { remoteMedia, volumes, deafened, restrictions, activeServerId } = useVoice();
  const { settings } = useAudioSettings();
  const [blocked, setBlocked] = useState(false);
  const [unlockToken, setUnlockToken] = useState(0);
  const blockedSinks = useRef(new Set<string>());
  const reportBlocked = useCallback((sinkId: string, value: boolean) => {
    if (value) blockedSinks.current.add(sinkId);
    else blockedSinks.current.delete(sinkId);
    setBlocked(blockedSinks.current.size > 0);
  }, []);

  return (
    <>
      <div className="sr-only" aria-hidden>
        {Object.entries(remoteMedia).flatMap(([userId, media]) =>
          [media.audio, media.screenAudio].map((stream, index) =>
            stream ? (
              <AudioSink
                key={`${userId}:${index}`}
                sinkId={`${userId}:${index}`}
                stream={stream}
                volume={((volumes[userId] ?? 100) * settings.outputVolume) / 100}
                deafened={
                  deafened ||
                  Boolean(
                    restrictions[`${activeServerId}:${userId}`]?.muted ||
                    restrictions[`${activeServerId}:${userId}`]?.deafened,
                  )
                }
                outputId={settings.outputDeviceId ?? undefined}
                onBlocked={reportBlocked}
                unlockToken={unlockToken}
              />
            ) : null,
          ),
        )}
      </div>
      {blocked && (
        <div className="flex justify-center pb-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
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
