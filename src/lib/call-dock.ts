export type CallDockTarget = "voice" | "call";
export function activeVoiceCall(state: string) {
  return ["connecting", "connected", "reconnecting"].includes(state);
}
export function activePrivateCall(status: string) {
  return ["outgoing", "connecting", "active", "reconnecting", "waiting"].includes(status);
}
export function resolveCallDockTarget(
  voice: boolean,
  status: string,
  preferred: CallDockTarget,
): CallDockTarget | null {
  const call = activePrivateCall(status);
  if (preferred === "voice" && voice) return "voice";
  if (call) return "call";
  return voice ? "voice" : null;
}
export interface DockParticipant {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarFrame?: string | undefined;
}
export function uniqueDockParticipants(people: DockParticipant[]) {
  return [...new Map(people.map((person) => [person.id, person])).values()];
}
