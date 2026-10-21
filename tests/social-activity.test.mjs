import test from "node:test";
import assert from "node:assert/strict";
import { authorizeSocialRooms, visibleSocialRooms } from "../src/lib/social-activity.ts";

const room = {
  id: "private-channel",
  kind: "server",
  name: "Private",
  context: "shared-server",
  userIds: ["friend", "friend", "outsider"],
};
const allowed = { viewerMember: true, canView: true, canConnect: true, members: ["friend"] };

test("Social calls require membership AND visibility AND permission to connect", async () => {
  for (const flag of ["viewerMember", "canView", "canConnect"]) {
    const result = await authorizeSocialRooms("viewer", [room], async () => ({
      ...allowed,
      [flag]: false,
    }));
    assert.deepEqual(result, [], flag);
  }
  assert.deepEqual(await authorizeSocialRooms("viewer", [room], async () => allowed), [
    { ...room, userIds: ["friend"] },
  ]);
});

test("No session, membership removal, errors and unknown access fail closed", async () => {
  let requested = false;
  assert.deepEqual(
    await authorizeSocialRooms(undefined, [room], async () => {
      requested = true;
      return allowed;
    }),
    [],
  );
  assert.equal(requested, false);
  assert.deepEqual(
    await authorizeSocialRooms("viewer", [room], async () => {
      throw new Error("Network down");
    }),
    [],
  );
  assert.deepEqual(
    await authorizeSocialRooms("viewer", [room], async () => ({ ...allowed, members: [] })),
    [],
  );
  assert.deepEqual(
    await authorizeSocialRooms("viewer", [room], async () => ({ ...allowed, canView: null })),
    [],
  );
});

test("Groups use the same access gate and do not trust arbitrary presence IDs", async () => {
  const group = { ...room, kind: "group", id: "shared-group" };
  assert.deepEqual(
    await authorizeSocialRooms("viewer", [group], async () => ({
      ...allowed,
      viewerMember: false,
    })),
    [],
  );
  assert.deepEqual(await authorizeSocialRooms("viewer", [group], async () => allowed), [
    { ...group, userIds: ["friend"] },
  ]);
});

test("A failed private room does not hide a separately authorized room", async () => {
  const other = { ...room, id: "other-channel" };
  const result = await authorizeSocialRooms("viewer", [room, other], async (r) => {
    if (r.id === room.id) throw new Error("Forbidden");
    return allowed;
  });
  assert.deepEqual(
    result.map((r) => r.id),
    [other.id],
  );
});

test("Invisible/offline/nonfriend users cannot leak through counts or avatars", () => {
  const rooms = [{ ...room, userIds: ["friend", "invisible", "nonfriend"] }];
  assert.deepEqual(visibleSocialRooms(rooms, new Set(["friend"])), [
    { ...room, userIds: ["friend"] },
  ]);
  assert.deepEqual(visibleSocialRooms(rooms, new Set()), []);
  assert.equal(rooms[0].userIds.length, 3, "do not mutate provider occupancy");
});

test("Revoking access removes a previously visible room", async () => {
  assert.equal((await authorizeSocialRooms("viewer", [room], async () => allowed)).length, 1);
  assert.deepEqual(
    await authorizeSocialRooms("viewer", [room], async () => ({ ...allowed, canConnect: false })),
    [],
  );
});
