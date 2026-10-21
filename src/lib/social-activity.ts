export interface SocialRoom {
  id: string;
  kind: "server" | "group";
  name: string;
  context: string;
  userIds: string[];
}

export interface RoomAccess {
  viewerMember: boolean;
  canView: boolean;
  canConnect: boolean;
  members: string[];
}

/** Presence is an observation, never an authorization decision. Fail closed. */
export async function authorizeSocialRooms(
  viewerId: string | undefined,
  rooms: SocialRoom[],
  check: (room: SocialRoom, viewerId: string) => Promise<RoomAccess>,
): Promise<SocialRoom[]> {
  if (!viewerId) return [];
  const checked = await Promise.all(
    rooms.map(async (room) => {
      try {
        const access = await check(room, viewerId);
        if (access.viewerMember !== true || access.canView !== true || access.canConnect !== true)
          return null;
        const members = new Set(access.members);
        const userIds = [...new Set(room.userIds)].filter((id) => members.has(id));
        return userIds.length ? { ...room, userIds } : null;
      } catch {
        return null;
      }
    }),
  );
  return checked.filter((room): room is SocialRoom => room !== null);
}

export function visibleSocialRooms(rooms: SocialRoom[], visibleFriends: Set<string>) {
  // Counts and avatars use the same visible subset; invisible users are not exposed indirectly.
  return rooms
    .map((room) => ({ ...room, userIds: room.userIds.filter((id) => visibleFriends.has(id)) }))
    .filter((room) => room.userIds.length > 0);
}
