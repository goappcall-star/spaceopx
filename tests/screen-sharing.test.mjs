import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { loadVoiceProvider } from "./audio/pipeline-fixture.mjs";
test("Explicit screen state clears frozen remote media and restores unchanged tracks on restart", async () => {
  const provider = loadVoiceProvider({});
  const audio = stream([track("audio")]);
  const video = stream([track("video")]);
  const screenAudio = stream([track("audio")]);
  provider.remote.remote = { audio, camera: null, screen: video, screenAudio };
  provider.peers.set("remote", {
    streams: { mic: audio, camera: stream([]), screen: video, screenAudio },
    remoteSessionId: null,
  });
  await provider.onSignal({ from: "remote", to: "*", screenStopped: true });
  assert.equal(provider.remote.remote.screen, null);
  assert.equal(provider.remote.remote.screenAudio, null);
  assert.equal(provider.remote.remote.audio, audio);
  // A delayed RTC unmute/ontrack event must not resurrect the stopped overlay.
  provider.updateRemote("remote", "screen", video);
  provider.updateRemote("remote", "screenAudio", screenAudio);
  assert.equal(provider.remote.remote.screen, null);
  assert.equal(provider.remote.remote.screenAudio, null);
  await provider.onSignal({ from: "remote", to: "*", screenStarted: true, screenHasAudio: true });
  assert.equal(provider.remote.remote.screen, video);
  assert.equal(provider.remote.remote.screenAudio, screenAudio);
  await provider.onSignal({ from: "remote", to: "*", screenStarted: true, screenHasAudio: false });
  assert.equal(provider.remote.remote.screenAudio, null);
});

test("A screen stop from an old session cannot clear the new session's sharing", async () => {
  const provider = loadVoiceProvider({});
  const video = stream([track("video")]);
  provider.remote.remote = { audio: null, camera: null, screen: video, screenAudio: null };
  provider.peers.set("remote", { remoteSessionId: "new-session" });
  await provider.onSignal({
    from: "remote",
    from_session: "old-session",
    to: "*",
    screenStopped: true,
  });
  assert.equal(provider.remote.remote.screen, video);
});
function track(kind) {
  const events = {};
  return {
    kind,
    readyState: "live",
    enabled: true,
    events,
    addEventListener: (event, fn) => (events[event] = fn),
    stop() {
      this.readyState = "ended";
    },
  };
}
function stream(tracks) {
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
  };
}
function fixture(withAudio = true) {
  const video = track("video"),
    audio = track("audio");
  const capture = stream(withAudio ? [video, audio] : [video]);
  let constraints,
    provided = capture;
  const provider = loadVoiceProvider(
    {},
    {
      navigator: {
        mediaDevices: {
          getDisplayMedia: async (options) => {
            constraints = options;
            return provided;
          },
        },
      },
    },
  );
  const sender = (t) => ({
    track: t,
    async replaceTrack(next) {
      this.track = next;
    },
  });
  const mic = track("audio");
  const micSender = sender(mic),
    screen = sender(null),
    screenAudio = sender(null);
  provider.peers.set("remote", {
    transceivers: {
      mic: { sender: micSender },
      camera: null,
      screen: { sender: screen },
      screenAudio: { sender: screenAudio },
    },
  });
  return {
    provider,
    video,
    audio,
    capture,
    mic,
    micSender,
    screen,
    screenAudio,
    constraints: () => constraints,
    setCapture: (value) => (provided = value),
  };
}
test("Screen capture transmits a separate audio track, keeps microphone during mute and clears only screen slots on stop", async () => {
  const f = fixture();
  await f.provider.startScreenShare();
  assert.equal(f.screenAudio.track, f.audio);
  assert.equal(f.screen.track, f.video);
  assert.equal(f.micSender.track, f.mic);
  assert.equal(f.provider.screenShareHasAudio, true);
  assert.equal(f.constraints().audio.restrictOwnAudio, true);
  assert.equal(f.constraints().systemAudio, "include");
  f.provider.setMuted(true);
  assert.equal(f.audio.enabled, true);
  assert.equal(f.micSender.track, f.mic);
  f.provider.setDeafened(true);
  assert.equal(f.audio.enabled, true);
  f.provider.stopScreenShare();
  assert.equal(f.screenAudio.track, null);
  assert.equal(f.screen.track, null);
  assert.equal(f.micSender.track, f.mic);
  assert.equal(f.audio.readyState, "ended");
  assert.equal(f.video.readyState, "ended");
});
test("Video-only capture works and browser stop removes both screen tracks", async () => {
  const f = fixture(false);
  await f.provider.startScreenShare();
  assert.equal(f.screenAudio.track, null);
  assert.equal(f.provider.screenShareHasAudio, false);
  f.video.events.ended();
  assert.equal(f.screen.track, null);
  assert.equal(f.micSender.track, f.mic);
});
test("Screen tracks are available for late peers, and a stale stop event cannot stop a newer capture", async () => {
  const f = fixture();
  await f.provider.startScreenShare();
  assert.equal(f.provider.localTrack("screenAudio"), f.audio);
  const old = f.video.events.ended;
  const next = fixture().capture;
  f.setCapture(next);
  await f.provider.startScreenShare();
  old();
  assert.equal(f.provider.screenStream, next);
});
test("Capture finishing after leaving releases every returned track", async () => {
  const f = fixture();
  let resolve;
  f.provider.peers.clear();
  const pending = new Promise((r) => (resolve = r));
  const provider = loadVoiceProvider(
    {},
    { navigator: { mediaDevices: { getDisplayMedia: () => pending } } },
  );
  const start = provider.startScreenShare();
  provider.disposed = true;
  resolve(f.capture);
  await assert.rejects(start, { name: "AbortError" });
  assert.equal(f.audio.readyState, "ended");
  assert.equal(f.video.readyState, "ended");
});
test("Both audio sources share local volume and deafen policy without altering transmitted tracks", () => {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/lib/audio-volume.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports },
  );
  const volume = exports.receivedAudioVolume;
  assert.equal(volume(50, 80, false), 0.4);
  assert.equal(volume(100, 100, true), 0);
  assert.equal(volume(200, 200, false), 1);
  assert.equal(volume(NaN, NaN, false), 1);
  assert.equal(volume(-1, 100, false), 0);
});
