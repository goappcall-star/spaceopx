// In-memory signaling only. The tested media uses real RTCPeerConnections.
const rooms = new Map<string, Set<TestChannel>>();
class TestChannel {
  callback: ((message: { payload: unknown }) => void) | null = null;
  constructor(readonly room: string) {}
  on(_kind: string, _filter: unknown, callback: (message: { payload: unknown }) => void) {
    this.callback = callback;
    return this;
  }
  subscribe(callback: (status: string) => void) {
    const peers = rooms.get(this.room) ?? new Set();
    peers.add(this);
    rooms.set(this.room, peers);
    queueMicrotask(() => callback("SUBSCRIBED"));
    return this;
  }
  async send(message: { payload: unknown }) {
    for (const peer of rooms.get(this.room) ?? [])
      if (peer !== this) {
        queueMicrotask(() => peer.callback?.(message));
        if (
          new URLSearchParams(location.search).has("repeat-offers") &&
          (message.payload as { description?: { type?: string } }).description?.type === "offer"
        )
          queueMicrotask(() => peer.callback?.(message));
      }
  }
}
export const supabase = {
  channel: (room: string) => new TestChannel(room),
  async removeChannel(channel: TestChannel) {
    rooms.get(channel.room)?.delete(channel);
  },
};
