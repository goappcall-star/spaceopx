import test from "node:test";
import assert from "node:assert/strict";
import { loadVoiceProvider } from "./audio/pipeline-fixture.mjs";

function fixture() {
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
    close() {}
  }
  const provider = loadVoiceProvider({}, { MediaStream: Stream, RTCPeerConnection: Connection });
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
