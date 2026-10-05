import { createVoiceProvider, type RemoteMedia } from "../../src/services/voice";
import { receivedAudioVolume } from "../../src/lib/audio-volume";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const output = document.getElementById("result")!;
const progress = document.getElementById("progress")!;
async function until(test: () => boolean, label: string) {
  const start = performance.now();
  while (!test()) {
    if (performance.now() - start > 15000) throw Error(label);
    await pause(30);
  }
}
function check(value: unknown, label: string) {
  if (!value) throw Error(label);
}
async function run() {
  const providers: ReturnType<typeof createVoiceProvider>[] = [];
  const contexts: AudioContext[] = [];
  const captures: MediaStream[] = [];
  const playbacks: HTMLAudioElement[] = [];
  const results: Record<string, unknown> = {
    browser: navigator.userAgent,
    realWebRTC: true,
    realMicrophoneRequested: false,
    externalSignaling: false,
  };
  const nativePeer = RTCPeerConnection;
  const originalMic = navigator.mediaDevices.getUserMedia;
  const originalScreen = navigator.mediaDevices.getDisplayMedia;
  let drawing: ReturnType<typeof setInterval> | undefined;
  try {
    window.RTCPeerConnection = class extends nativePeer {
      constructor() {
        super({ iceServers: [] });
      }
    };
    const context = new AudioContext({ sampleRate: 48000 });
    contexts.push(context);
    await context.resume();
    function tone(frequency: number) {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        destination = context.createMediaStreamDestination();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.12;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      captures.push(destination.stream);
      return destination.stream;
    }
    const queue = [tone(440), tone(660), tone(880)];
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const stream = queue.shift();
        if (!stream) throw Error("Unexpected microphone capture");
        return stream;
      },
    });
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const draw = canvas.getContext("2d")!;
    drawing = setInterval(() => {
      draw.fillStyle = `hsl(${Date.now() % 360},60%,50%)`;
      draw.fillRect(0, 0, 160, 90);
    }, 40);
    let includeAudio = false;
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: async (options: DisplayMediaStreamOptions) => {
        check(!!options.audio, "Audio must be requested from capture");
        const stream = canvas.captureStream(15);
        if (includeAudio) stream.addTrack(tone(1100).getAudioTracks()[0]!);
        captures.push(stream);
        return stream;
      },
    });
    const sender = createVoiceProvider(),
      receiver = createVoiceProvider();
    providers.push(sender, receiver);
    let remote: RemoteMedia | undefined, lateRemote: RemoteMedia | undefined;
    await sender.setNoiseSuppression("off");
    await receiver.setNoiseSuppression("off");
    progress.textContent = "Conectando dois participantes com WebRTC real…";
    await sender.connect("screen-test", "sender", {});
    await receiver.connect("screen-test", "receiver", {
      onRemoteMedia: (media) => {
        remote = media["sender"];
      },
    });
    sender.syncPeers(["receiver"]);
    receiver.syncPeers(["sender"]);
    await until(
      () => !!remote?.audio?.getAudioTracks().some((track) => !track.muted),
      "Microphone did not reach receiver",
    );
    const receiveContext = new AudioContext({ sampleRate: 48000 });
    contexts.push(receiveContext);
    await receiveContext.resume();
    function meter(stream: MediaStream) {
      const source = receiveContext.createMediaStreamSource(stream),
        analyser = receiveContext.createAnalyser(),
        sink = receiveContext.createGain();
      analyser.fftSize = 2048;
      sink.gain.value = 0;
      source.connect(analyser);
      analyser.connect(sink);
      sink.connect(receiveContext.destination);
      return analyser;
    }
    async function rms(analyser: AnalyserNode) {
      const samples = new Float32Array(analyser.fftSize);
      let sum = 0,
        count = 0;
      for (let i = 0; i < 25; i++) {
        analyser.getFloatTimeDomainData(samples);
        for (const x of samples) {
          sum += x * x;
          count++;
        }
        await pause(15);
      }
      return Math.sqrt(sum / count);
    }
    const micMeter = meter(remote!.audio!);
    await pause(300);
    // Chromium starts its receive graph through the playback sink used by the app.
    const playback = document.createElement("audio");
    playback.srcObject = remote!.audio!;
    playback.volume = 0;
    document.body.append(playback);
    playbacks.push(playback);
    await playback.play();
    let measuredMic = await rms(micMeter);
    const audioStart = performance.now();
    while (measuredMic < 0.01 && performance.now() - audioStart < 8000)
      measuredMic = await rms(micMeter);
    results["initialMicrophoneRms"] = measuredMic;
    results["audioContextState"] = context.state;
    results["audioClock"] = context.currentTime;
    const internal = sender as unknown as {
      micStream: MediaStream;
      audioPipeline: { context: AudioContext; stream: MediaStream };
      peers: Map<string, { pc: RTCPeerConnection }>;
    };
    results["pipelineState"] = internal.audioPipeline.context.state;
    results["localRawMicRms"] = await rms(meter(internal.micStream));
    results["localProcessedMicRms"] = await rms(meter(internal.audioPipeline.stream));
    results["peerState"] = internal.peers.get("receiver")!.pc.connectionState;
    const stats = await internal.peers.get("receiver")!.pc.getStats();
    const audioStats: unknown[] = [];
    stats.forEach((stat) => {
      if (stat.type === "outbound-rtp" && stat.kind === "audio")
        audioStats.push({ packetsSent: stat.packetsSent, bytesSent: stat.bytesSent });
    });
    results["sentAudioPackets"] = audioStats;
    const receiverInternal = receiver as unknown as {
      peers: Map<string, { pc: RTCPeerConnection }>;
    };
    const receivedStats: unknown[] = [];
    (await receiverInternal.peers.get("sender")!.pc.getStats()).forEach((stat) => {
      if (stat.type === "inbound-rtp" && stat.kind === "audio")
        receivedStats.push({
          packetsReceived: stat.packetsReceived,
          totalAudioEnergy: stat.totalAudioEnergy,
          totalSamplesReceived: stat.totalSamplesReceived,
        });
    });
    results["receivedAudioStats"] = receivedStats;
    check(measuredMic > 0.01, "Received microphone is silent");
    results["twoParticipantMicrophone"] = "PASS";
    await sender.startScreenShare();
    await until(() => !!remote?.screen, "Video-only sharing did not reach receiver");
    check(!sender.screenShareHasAudio, "Video-only capture incorrectly advertises audio");
    results["videoOnly"] = "PASS";
    sender.stopScreenShare();
    includeAudio = true;
    await sender.startScreenShare();
    await until(
      () => !!remote?.screenAudio && !!remote.screen,
      "Audio/video screen sharing did not arrive",
    );
    const screenMeter = meter(remote!.screenAudio!);
    await pause(300);
    check((await rms(screenMeter)) > 0.01, "Screen track arrived but carried no sound");
    check((await rms(micMeter)) > 0.01, "Microphone disappeared during sharing");
    results["screenAudioAndMicSimultaneously"] = "PASS";
    sender.setMuted(true);
    await pause(300);
    check((await rms(micMeter)) < 0.005, "Muted microphone still audible");
    check((await rms(screenMeter)) > 0.01, "Microphone mute incorrectly silenced sharing");
    sender.setMuted(false);
    results["muteIndependentOfScreen"] = "PASS";
    check(receivedAudioVolume(70, 80, true) === 0, "Deafen did not silence playback");
    check(receivedAudioVolume(50, 80, false) === 0.4, "Individual volume incorrect");
    results["deafenAndIndividualVolumePolicy"] = "PASS";
    const late = createVoiceProvider();
    providers.push(late);
    await late.setNoiseSuppression("off");
    progress.textContent = "Validando entrada durante compartilhamento…";
    await late.connect("screen-test", "late", {
      onRemoteMedia: (media) => {
        lateRemote = media["sender"];
      },
    });
    sender.syncPeers(["receiver", "late"]);
    receiver.syncPeers(["sender", "late"]);
    late.syncPeers(["sender", "receiver"]);
    await until(
      () => !!lateRemote?.screenAudio && !!lateRemote.screen && !!lateRemote.audio,
      "Late participant did not receive all tracks",
    );
    check(
      (await rms(meter(lateRemote!.screenAudio!))) > 0.01,
      "Late participant's screen audio is silent",
    );
    results["lateParticipantReceivesScreenAudioVideoAndMic"] = "PASS";
    sender.stopScreenShare();
    await until(
      () => !remote?.screen && !lateRemote?.screen,
      "Screen did not disappear after stopping",
    );
    await pause(500);
    check((await rms(micMeter)) > 0.01, "Stopping screen sharing ended microphone");
    check((await rms(screenMeter)) < 0.005, "Screen audio continued after stopping");
    results["stopKeepsCallAndMicrophone"] = "PASS";
    results["status"] = "PASS";
  } catch (error) {
    results["status"] = "FAIL";
    results["error"] = String(error);
  } finally {
    if (drawing) clearInterval(drawing);
    await Promise.all(providers.map((provider) => provider.disconnect()));
    for (const playback of playbacks) {
      playback.pause();
      playback.srcObject = null;
      playback.remove();
    }
    for (const stream of captures) stream.getTracks().forEach((track) => track.stop());
    await Promise.all(contexts.map((context) => context.close()));
    window.RTCPeerConnection = nativePeer;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: originalMic,
    });
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: originalScreen,
    });
    results["cleanup"] = "Complete";
    progress.textContent = String(results["status"]);
    output.textContent = JSON.stringify(results, null, 2);
  }
}
document.getElementById("start")!.onclick = () => {
  void run();
};
