export type CallSound = "enter" | "leave";

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
