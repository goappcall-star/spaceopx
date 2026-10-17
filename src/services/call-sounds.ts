export type CallSound =
  "enter" | "leave" | "screen-start" | "mic-mute" | "mic-unmute" | "deafen" | "undeafen";

export function isAudioControlSound(sound: CallSound) {
  return ["mic-mute", "mic-unmute", "deafen", "undeafen"].includes(sound);
}

/** One confirmation per state change; deafen takes priority when both change together. */
export function createAudioControlSoundTracker() {
  let previous: { scope: string | null; muted: boolean; deafened: boolean } | undefined;
  return (scope: string | null, muted: boolean, deafened: boolean): CallSound[] => {
    const before = previous;
    previous = { scope, muted, deafened };
    if (!scope || !before || before.scope !== scope) return [];
    if (before.deafened !== deafened) return [deafened ? "deafen" : "undeafen"];
    if (before.muted !== muted) return [muted ? "mic-mute" : "mic-unmute"];
    return [];
  };
}

/** Capture state, rather than clicks or quality changes, drives the local cue. */
export function createScreenShareSoundTracker() {
  let sharing = false;
  return (active: boolean): CallSound[] => {
    const started = active && !sharing;
    sharing = active;
    return started ? ["screen-start"] : [];
  };
}

/** Changes of room membership, rather than speaking or reconnect events, drive the cues. */
export function createCallSoundTracker() {
  let room: string | null = null;
  let entered = false;
  let members = new Set<string>();
  return (nextRoom: string | null, ready: boolean, ids: string[]): CallSound[] => {
    const sounds: CallSound[] = [];
    if (room !== nextRoom) {
      if (entered) sounds.push("leave");
      room = nextRoom;
      entered = false;
      members = new Set();
    }
    if (!room || !ready) return sounds;
    const next = new Set(ids);
    if (!entered) sounds.push("enter");
    else {
      if ([...members].some((id) => !next.has(id))) sounds.push("leave");
      if ([...next].some((id) => !members.has(id))) sounds.push("enter");
    }
    entered = true;
    members = next;
    return sounds;
  };
}

export function readCallSounds(userId: string) {
  try {
    return localStorage.getItem(`lobbyx:call-sounds:${userId}`) !== "off";
  } catch {
    return true;
  }
}
export function saveCallSounds(userId: string, enabled: boolean) {
  try {
    localStorage.setItem(`lobbyx:call-sounds:${userId}`, enabled ? "on" : "off");
  } catch {
    /* Audio preferences remain usable when storage is unavailable. */
  }
}
