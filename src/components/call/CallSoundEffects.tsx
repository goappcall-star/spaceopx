import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useVoice } from "@/hooks/use-voice";
import { useCall } from "@/hooks/use-call";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { createCallSoundTracker, type CallSound } from "@/services/call-sounds";

/** Local playback only: these elements never connect to the outgoing microphone. */
export function CallSoundEffects() {
  const voice = useVoice();
  const call = useCall();
  const { user } = useAuth();
  const { settings } = useAudioSettings();
  const enter = useRef<HTMLAudioElement>(null);
  const leave = useRef<HTMLAudioElement>(null);
  const voiceTracker = useRef(createCallSoundTracker());
  const callTracker = useRef(createCallSoundTracker());
  const playbackQueue = useRef(Promise.resolve());
  const alive = useRef(true);
  const options = useRef(settings);
  options.current = settings;
  useEffect(() => {
    alive.current = true;
    const elements = [enter.current, leave.current];
    return () => {
      alive.current = false;
      elements.forEach((element) => element?.pause());
    };
  }, []);
  const voiceIds = (
    voice.activeChannelId ? (voice.participantsByChannel[voice.activeChannelId] ?? []) : []
  )
    .map((member) => member.user_id)
    .filter((id) => id !== user?.id)
    .sort()
    .join(",");
  const privateRoom = ["active", "reconnecting", "waiting"].includes(call.status)
    ? `private:${call.groupConversationId ?? call.peer?.id ?? "call"}`
    : null;
  const privateIds = (
    call.groupConversationId
      ? call.participants.map((member) => member.id)
      : call.status === "waiting"
        ? []
        : call.peer
          ? [call.peer.id]
          : []
  )
    .filter((id) => id !== user?.id)
    .sort()
    .join(",");
  // Keep the room stable while reconnecting; connecting alone does not announce a successful entry.
  const privateSession = call.status === "connecting" ? undefined : privateRoom;
  const previousPrivate = useRef<string | null>(null);
  useEffect(() => {
    const room = privateSession === undefined ? previousPrivate.current : privateSession;
    previousPrivate.current = room;
    const sounds: CallSound[] = [
      ...voiceTracker.current(
        voice.activeChannelId,
        voice.connectionState === "connected",
        voiceIds ? voiceIds.split(",") : [],
      ),
      ...callTracker.current(
        room,
        ["active", "waiting"].includes(call.status),
        privateIds ? privateIds.split(",") : [],
      ),
    ];
    if (!settings.callSoundsEnabled || voice.deafened || settings.outputVolume <= 0) return;
    for (const sound of sounds) {
      const element = sound === "enter" ? enter.current : leave.current;
      if (!element) continue;
      playbackQueue.current = playbackQueue.current
        .catch(() => undefined)
        .then(async () => {
          if (!alive.current || !options.current.callSoundsEnabled) return;
          const sink = element as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
          if (sink.setSinkId)
            await sink.setSinkId(options.current.outputDeviceId ?? "").catch(() => undefined);
          element.volume = Math.max(0, Math.min(1, options.current.outputVolume / 100)) * 0.35;
          element.currentTime = 0;
          // Autoplay failures must never prevent a call from opening or closing.
          await element.play().catch(() => undefined);
        });
    }
  }, [
    voice.activeChannelId,
    voice.connectionState,
    voiceIds,
    privateSession,
    privateIds,
    call.status,
    settings.callSoundsEnabled,
    settings.outputVolume,
    voice.deafened,
  ]);
  return (
    <div hidden aria-hidden="true">
      <audio ref={enter} src="/sounds/call-enter.wav" preload="auto" />
      <audio ref={leave} src="/sounds/call-leave.wav" preload="auto" />
    </div>
  );
}
