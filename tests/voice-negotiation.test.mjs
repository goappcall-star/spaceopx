import test from "node:test";
import assert from "node:assert/strict";
import { loadVoiceProvider } from "./audio/pipeline-fixture.mjs";

function fixture(environment = {}) {
  const sent = [];
  class Stream {
    getTracks() {
      return [];
    }
  }
  class Connection {
    signalingState = "stable";
    connectionState = "new";
    remoteDescription = null;
    localDescription = null;
    operations = Promise.resolve();
    queue(action) {
      const result = this.operations.then(action);
      this.operations = result.catch(() => {});
      return result;
    }
    getTransceivers() {
      return [];
    }
    addTransceiver() {
      return { sender: { replaceTrack: async () => {} } };
    }
    setRemoteDescription(description) {
      return this.queue(() => {
        if (description.type === "answer" && this.signalingState !== "have-local-offer")
          throw new Error("answer in wrong state");
        this.remoteDescription = description;
        this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable";
      });
    }
    setLocalDescription() {
      return this.queue(() => {
        const type = this.signalingState === "have-remote-offer" ? "answer" : "offer";
        this.localDescription = {
          type,
          sdp: "local",
          toJSON() {
            return { type, sdp: this.sdp };
          },
        };
        this.signalingState = type === "answer" ? "stable" : "have-local-offer";
      });
    }
    async addIceCandidate() {}
    close() {
      this.closed = true;
    }
  }
  const provider = loadVoiceProvider(
    {},
    {
      MediaStream: Stream,
      RTCPeerConnection: Connection,
      ...environment,
    },
  );
  provider.userId = "alice";
  provider.signaling = { send: async ({ payload }) => sent.push(payload) };
  const signal = (data) =>
    provider.onSignal({ from: "bob", from_session: "bob-session", to: provider.userId, ...data });
  return { provider, signal, sent };
}

test("A repeated initial offer cannot turn the receiver's answer into a new offer", async () => {
  const { provider, signal, sent } = fixture();
  const description = { type: "offer", sdp: "initial" };
  await Promise.all([signal({ description }), signal({ description })]);
  assert.equal(provider.peers.get("bob").pc.signalingState, "stable");
  assert.ok(sent.length > 0);
  assert.ok(sent.every((payload) => payload.description?.type === "answer"));
});

function recoveryFixture() {
  const timers = new Map();
  let nextId = 0;
  const f = fixture({
    setTimeout(callback) {
      timers.set(++nextId, callback);
      return nextId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  return { ...f, timers };
}

test("An empty Presence snapshot does not tear down established audio and recovery cancels removal", () => {
  const { provider, timers } = recoveryFixture();
  const peer = provider.createPeer("bob");
  peer.createdAt = Date.now() - 60000;
  peer.state = "connected";
  provider.syncPeers([]);
  assert.equal(peer.pc.closed, undefined);
  assert.equal(timers.size, 1);
  provider.syncPeers([]);
  assert.equal(timers.size, 1);
  provider.syncPeers(["bob"]);
  assert.equal(timers.size, 0);
  assert.equal(provider.peers.get("bob"), peer);
});

test("Continuous absence eventually removes the peer instead of retaining abandoned connections", () => {
  const { provider, timers } = recoveryFixture();
  const peer = provider.createPeer("bob");
  provider.syncPeers([]);
  const callback = [...timers.values()][0];
  timers.clear();
  callback();
  assert.equal(peer.pc.closed, true);
  assert.equal(provider.peers.has("bob"), false);
});

test("Explicit departure closes immediately and cancels pending Presence recovery", async () => {
  const { provider, signal, timers } = recoveryFixture();
  const peer = provider.createPeer("bob");
  provider.syncPeers([]);
  await signal({ bye: true });
  assert.equal(peer.pc.closed, true);
  assert.equal(provider.peers.has("bob"), false);
  assert.equal(timers.size, 0);
});

test("Signaling closure and resubscription keep an established media connection active", async () => {
  let notify;
  const channel = {
    on() {
      return this;
    },
    subscribe(callback) {
      notify = callback;
      callback("SUBSCRIBED");
      return this;
    },
    send: async () => "ok",
  };
  const { provider } = fixture({
    navigator: {
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [], getAudioTracks: () => [] }),
      },
    },
    require(id) {
      if (id === "@/services/performance/monitor")
        return {
          registerProbe: () => () => {},
          collectionGeneration: () => 0,
          recordMetric: () => {},
          metrics: { enabled: false },
        };
      if (id === "@/integrations/supabase/client")
        return { supabase: { channel: () => channel, removeChannel: async () => {} } };
      return {};
    },
  });
  provider.startSpeakingDetection = async () => {};
  const states = [];
  await provider.connect("room", "alice", { onStateChange: (state) => states.push(state) });
  const peer = provider.createPeer("bob");
  peer.state = "connected";
  notify("CLOSED");
  assert.equal(states.at(-1), "connected");
  notify("SUBSCRIBED");
  assert.equal(states.at(-1), "connected");
  assert.equal(provider.peers.get("bob"), peer);
  peer.state = "disconnected";
  notify("CLOSED");
  assert.equal(states.at(-1), "reconnecting");
});

test("A repeated answer is harmless and distinct renegotiation still succeeds", async () => {
  const { provider, signal } = fixture();
  provider.userId = "zara";
  const peer = provider.createPeer("bob");
  await peer.pc.onnegotiationneeded();
  const description = { type: "answer", sdp: "answer-1" };
  await Promise.all([signal({ description }), signal({ description })]);
  assert.equal(peer.pc.signalingState, "stable");
  await signal({ description: { type: "offer", sdp: "new-offer" } });
  assert.equal(peer.pc.signalingState, "stable");
  assert.equal(peer.pc.remoteDescription.sdp, "new-offer");
});

test("A prolonged Presence outage cannot close connected WebRTC audio; dead ICE still cleans up", () => {
  const { provider, timers } = recoveryFixture();
  const peer = provider.createPeer("bob");
  peer.pc.connectionState = "connected";
  peer.pc.iceConnectionState = "connected";
  peer.state = "connected";
  provider.syncPeers([]);
  for (let i = 0; i < 8; i++) {
    const fn = [...timers.values()][0];
    timers.clear();
    fn();
    assert.equal(peer.pc.closed, undefined);
    assert.equal(provider.peers.get("bob"), peer);
  }
  peer.pc.connectionState = "disconnected";
  peer.pc.iceConnectionState = "disconnected";
  const fn = [...timers.values()][0];
  timers.clear();
  fn();
  assert.equal(peer.pc.closed, true);
  assert.equal(provider.peers.has("bob"), false);
});

test("Late signaling from a retired session cannot replace the current participant", async () => {
  const { provider, signal } = fixture();
  await signal({ hello: true });
  const first = provider.peers.get("bob");
  await signal({ hello: true, from_session: "new-session" });
  const current = provider.peers.get("bob");
  assert.notEqual(first, current);
  assert.equal(first.pc.closed, true);
  for (const payload of [
    { hello: true },
    { description: { type: "offer", sdp: "old" } },
    { candidate: { candidate: "old" } },
    { bye: true },
  ])
    await signal(payload);
  assert.equal(provider.peers.get("bob"), current);
  assert.equal(current.pc.closed, undefined);
  await signal({ bye: true, from_session: "new-session" });
  assert.equal(provider.peers.has("bob"), false);
  provider.syncPeers(["bob"]);
  assert.equal(provider.peers.has("bob"), false, "cached occupancy cannot undo an explicit bye");
  await signal({ hello: true, from_session: "new-session" });
  assert.equal(provider.peers.has("bob"), false);
  await signal({ hello: true, from_session: "return-session" });
  assert.equal(provider.peers.has("bob"), true, "a genuine new session can return immediately");
});
