import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useVoice } from "@/hooks/use-voice";
import { useCall } from "@/hooks/use-call";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import {
  subscribeRemoteScreenSounds,
  createCallSoundTracker,
  createScreenShareSoundTracker,
  createAudioControlSoundTracker,
  isAudioControlSound,
  type CallSound,
} from "@/services/call-sounds";

/** Local playback only: these elements never connect to the outgoing microphone. */
export function CallSoundEffects() {
  const voice = useVoice();
  const call = useCall();
  const { user } = useAuth();
  const { settings } = useAudioSettings();
  const enter = useRef<HTMLAudioElement>(null);
  const leave = useRef<HTMLAudioElement>(null);
  const screenStop = useRef<HTMLAudioElement>(null);
  const screenStart = useRef<HTMLAudioElement>(null);
  const micMute = useRef<HTMLAudioElement>(null);
  const micUnmute = useRef<HTMLAudioElement>(null);
  const deafen = useRef<HTMLAudioElement>(null);
  const undeafen = useRef<HTMLAudioElement>(null);
  const voiceTracker = useRef(createCallSoundTracker());
  const callTracker = useRef(createCallSoundTracker());
  const voiceScreenTracker = useRef(createScreenShareSoundTracker());
  const privateScreenTracker = useRef(createScreenShareSoundTracker());
  const voiceControlTracker = useRef(createAudioControlSoundTracker());
  const privateControlTracker = useRef(createAudioControlSoundTracker());
  const playbackQueue = useRef(Promise.resolve());
  const alive = useRef(true);
  const options = useRef(settings);
  options.current = settings;
  const deafened = useRef(voice.deafened);
  deafened.current = voice.deafened;
  useEffect(() => {
    alive.current = true;
    const elements = [
      enter.current,
      leave.current,
      screenStart.current,
      screenStop.current,
      micMute.current,
      micUnmute.current,
      deafen.current,
      undeafen.current,
    ];
    return () => {
      alive.current = false;
      elements.forEach((element) => element?.pause());
    };
  }, []);
  const playSound = useCallback((sound: CallSound) => {
    // Control confirmations remain audible when incoming call audio is deafened.
    const controlCue = isAudioControlSound(sound);
    if (
      !options.current.callSoundsEnabled ||
      options.current.outputVolume <= 0 ||
      (deafened.current && !controlCue)
    )
      return;
    const element = {
      enter: enter.current,
      leave: leave.current,
      "screen-start": screenStart.current,
      "screen-stop": screenStop.current,
      "mic-mute": micMute.current,
      "mic-unmute": micUnmute.current,
      deafen: deafen.current,
      undeafen: undeafen.current,
    }[sound];
    if (!element) return;
    playbackQueue.current = playbackQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (
          !alive.current ||
          !options.current.callSoundsEnabled ||
          (deafened.current && !controlCue)
        )
          return;
        const sink = element as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
        if (sink.setSinkId)
          await sink.setSinkId(options.current.outputDeviceId ?? "").catch(() => undefined);
        if (
          !alive.current ||
          !options.current.callSoundsEnabled ||
          (deafened.current && !controlCue)
        )
          return;
        element.volume = Math.max(0, Math.min(1, options.current.outputVolume / 100)) * 0.35;
        element.currentTime = 0;
        // Autoplay failures must never prevent a call from opening or closing.
        await element.play().catch(() => undefined);
      });
  }, []);
  useEffect(() => subscribeRemoteScreenSounds(playSound), [playSound]);
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
  const voiceSharing = voice.screenOn && !!voice.localScreen;
  const privateSharing = call.screenOn && !!call.localScreen;
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
      ...voiceScreenTracker.current(voiceSharing),
      ...privateScreenTracker.current(privateSharing),
      ...voiceControlTracker.current(user?.id ?? null, voice.muted, voice.deafened),
      ...privateControlTracker.current(room, call.muted, false),
    ];
    sounds.forEach(playSound);
  }, [
    playSound,
    voice.activeChannelId,
    voice.connectionState,
    voiceIds,
    privateSession,
    privateIds,
    call.status,
    voiceSharing,
    privateSharing,
    settings.callSoundsEnabled,
    settings.outputVolume,
    voice.deafened,
    voice.muted,
    call.muted,
    user?.id,
  ]);
  return (
    <div hidden aria-hidden="true">
      <audio ref={enter} src="/sounds/call-enter.wav" preload="auto" />
      <audio ref={leave} src="/sounds/call-leave.wav" preload="auto" />
      <audio ref={screenStop} src="/sounds/call-screen-stop.wav" preload="auto" />
      <audio ref={screenStart} src="/sounds/call-screen-start.wav" preload="auto" />
      <audio ref={micMute} src="/sounds/call-mic-mute.wav" preload="auto" />
      <audio ref={micUnmute} src="/sounds/call-mic-unmute.wav" preload="auto" />
      <audio ref={deafen} src="/sounds/call-deafen.wav" preload="auto" />
      <audio ref={undeafen} src="/sounds/call-undeafen.wav" preload="auto" />
    </div>
  );
}
