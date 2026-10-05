import type { ReactNode } from "react";
export const member = {
  id: "member",
  server_id: "fixture",
  user_id: "peer",
  nickname: null,
  joined_at: "2026-10-05",
  profile: { id: "peer", display_name: "Amigo", username: "amigo", avatar_url: null },
  roles: [{ id: "member-role", name: "MEMBER", position: 1, color: "#8899aa" }],
};
export const server = { id: "fixture", owner_id: "me", name: "Servidor de teste" };
export function useAuth() {
  return { user: { id: "me" } };
}
export function useOptionalCall() {
  return { startCall: async () => {} };
}
export function useVoice() {
  return { volumes: {}, hiddenVideos: {}, setUserVolume: () => {}, setVideoHidden: () => {} };
}
export function useRelationship() {
  return { data: { state: "friends", friendshipId: "friend" } };
}
export function useServerRoles() {
  return { data: member.roles };
}
export function useAdminMutation() {
  return { mutate: () => {}, isPending: false };
}
export function useProfileDialog() {
  return { openProfile: () => {} };
}
export function QuickProfile({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
