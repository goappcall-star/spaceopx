import { createVoiceProvider, type RemoteMedia } from "../../src/services/voice";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean) {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > 12000) throw Error("Conexão não completou");
    await pause(25);
  }
}
async function run() {
  const results: Record<string, unknown> = {
    realWebRTC: true,
    realMicrophone: false,
    repeatOffers: new URLSearchParams(location.search).has("repeat-offers"),
  };
  const NativePeer = RTCPeerConnection;
  const originalCapture = navigator.mediaDevices.getUserMedia;
  const context = new AudioContext();
  const providers: ReturnType<typeof createVoiceProvider>[] = [];
  const streams: MediaStream[] = [];
  const playbacks: HTMLAudioElement[] = [];
  try {
    await context.resume();
    window.RTCPeerConnection = class extends NativePeer {
      constructor() {
        super({ iceServers: [] });
      }
    };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const oscillator = context.createOscillator();
        const destination = context.createMediaStreamDestination();
        oscillator.frequency.value = 440;
        oscillator.connect(destination);
        oscillator.start();
        streams.push(destination.stream);
        return destination.stream;
      },
    });
    for (const room of ["call-private-test", "server-voice-test"]) {
      const peers = [createVoiceProvider(), createVoiceProvider()];
      providers.push(...peers);
      const received: Record<string, RemoteMedia>[] = [{}, {}];
      const states = ["", ""];
      for (let i = 0; i < 2; i++) {
        await peers[i]!.setNoiseSuppression("off");
        await peers[i]!.connect(room, i === 0 ? "alice" : "bob", {
          onStateChange: (state) => {
            states[i] = state;
          },
          onRemoteMedia: (media) => {
            received[i] = media;
          },
        });
      }
      peers[0]!.syncPeers(["bob"]);
      peers[1]!.syncPeers(["alice"]);
      results.stage = `${room}: conexão`;
      await until(
        () =>
          states.every((state) => state === "connected") &&
          !!received[0]!["bob"]?.audio &&
          !!received[1]!["alice"]?.audio,
      );
      for (let i = 0; i < 2; i++) {
        results.stage = `${room}: áudio recebido por ${i}`;
        const remote = received[i]![i === 0 ? "bob" : "alice"]!.audio!;
        const playback = document.createElement("audio");
        playback.srcObject = remote;
        playback.volume = 0;
        document.body.append(playback);
        playbacks.push(playback);
        await playback.play();
        const source = context.createMediaStreamSource(remote);
        const analyser = context.createAnalyser();
        source.connect(analyser);
        const sink = context.createGain();
        sink.gain.value = 0;
        analyser.connect(sink);
        sink.connect(context.destination);
        const buffer = new Float32Array(analyser.fftSize);
        await until(() => {
          analyser.getFloatTimeDomainData(buffer);
          return buffer.some((value) => Math.abs(value) > 0.01);
        });
        source.disconnect();
        analyser.disconnect();
        sink.disconnect();
      }
      results[room] = "PASS: connected + áudio recebido nas duas direções";
      await Promise.all(peers.map((peer) => peer.disconnect()));
    }
    results.status = "PASS";
  } catch (error) {
    results.status = "FAIL";
    results.error = String(error);
    results.connections = providers.map((provider) =>
      [
        ...(
          provider as unknown as {
            peers: Map<
              string,
              { pc: RTCPeerConnection; transceivers: { mic: RTCRtpTransceiver | null } }
            >;
          }
        ).peers.values(),
      ].map((peer) => ({
        signaling: peer.pc.signalingState,
        connection: peer.pc.connectionState,
        ice: peer.pc.iceConnectionState,
        candidates: peer.pc.localDescription?.sdp.match(/a=candidate:.*/g) ?? [],
        outgoingAudio: Boolean(peer.transceivers.mic?.sender.track),
      })),
    );
  } finally {
    await Promise.all(providers.map((peer) => peer.disconnect()));
    streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    playbacks.forEach((playback) => {
      playback.pause();
      playback.srcObject = null;
      playback.remove();
    });
    await context.close();
    window.RTCPeerConnection = NativePeer;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: originalCapture,
    });
    document.getElementById("progress")!.textContent = String(results.status);
    document.getElementById("result")!.textContent = JSON.stringify(results, null, 2);
  }
}
document.getElementById("start")!.onclick = () => {
  void run();
};
