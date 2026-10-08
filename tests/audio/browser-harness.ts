import { createVoiceProvider } from "../../src/services/voice";
import { MicrophoneAudioPipeline } from "../../src/services/audio-processing";

const output = document.getElementById("result")!;
const progress = document.getElementById("progress")!;
const results: Record<string, unknown> = { browser: navigator.userAgent };
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
}
async function until(predicate: () => boolean, timeout = 10000) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > timeout) throw new Error("Wait timeout");
    await pause(25);
  }
}
async function rms(analyser: AnalyserNode, seconds = 0.6) {
  const samples = new Float32Array(analyser.fftSize);
  let sum = 0,
    count = 0;
  const start = performance.now();
  while (performance.now() - start < seconds * 1000) {
    analyser.getFloatTimeDomainData(samples);
    for (const x of samples) {
      sum += x * x;
      count++;
    }
    await pause(10);
  }
  return Math.sqrt(sum / count);
}

async function main() {
  const contexts: AudioContext[] = [];
  const providers: ReturnType<typeof createVoiceProvider>[] = [];
  try {
    progress.textContent = "Captura sintética → pipeline real → WebRTC real → receptor";
    // Never request real microphone access or contact a STUN/Supabase service.
    const NativePeer = RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePeer {
      constructor() {
        super({ iceServers: [] });
      }
    };
    const inputContext = new AudioContext({ sampleRate: 48000 });
    contexts.push(inputContext);
    await inputContext.resume();
    const inputDestination = inputContext.createMediaStreamDestination();
    const noise = inputContext.createBuffer(1, 48000 * 3, 48000);
    let seed = 101;
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      data[i] = (seed / 2147483648 - 1) * 0.035;
    }
    const noiseSource = inputContext.createBufferSource();
    noiseSource.buffer = noise;
    noiseSource.loop = true;
    noiseSource.connect(inputDestination);
    noiseSource.start();
    const silent = inputContext.createMediaStreamDestination();
    const streams = [inputDestination.stream, silent.stream];
    const constraints: MediaTrackConstraints[] = [];
    const captureTrack = inputDestination.stream.getAudioTracks()[0]!;
    const realApply = captureTrack.applyConstraints.bind(captureTrack);
    captureTrack.applyConstraints = async (value) => {
      constraints.push(value ?? {});
      await realApply(value);
    };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const stream = streams.shift();
        if (!stream) throw new Error("Unexpected capture");
        return stream;
      },
    });
    const sender = createVoiceProvider(),
      receiver = createVoiceProvider();
    providers.push(sender, receiver);
    const statuses: import("../../src/services/audio-processing").NoiseProcessingStatus[] = [];
    let remote: MediaStream | null = null;
    await sender.setNoiseSuppression("off");
    await receiver.setNoiseSuppression("off");
    await sender.connect("test", "sender", {
      onNoiseProcessingChange: (status) => statuses.push(status),
    });
    await receiver.connect("test", "receiver", {
      onRemoteMedia: (media) => {
        remote = media["sender"]?.audio ?? null;
      },
    });
    sender.syncPeers(["receiver"]);
    receiver.syncPeers(["sender"]);
    await until(() => !!remote?.getAudioTracks().length);
    const senderInternal = sender as unknown as {
      audioPipeline: MicrophoneAudioPipeline;
      peers: Map<string, { transceivers: { mic: RTCRtpTransceiver } }>;
    };
    const pipeline = senderInternal.audioPipeline as MicrophoneAudioPipeline;
    const peer = senderInternal.peers.get("receiver");
    const transmitted = peer.transceivers.mic.sender.track as MediaStreamTrack;
    check(
      transmitted === pipeline.stream.getAudioTracks()[0],
      "Sender must use the pipeline destination track",
    );
    check(transmitted !== captureTrack, "Sender must never transmit the raw microphone");
    const receiverContext = new AudioContext({ sampleRate: 48000 });
    contexts.push(receiverContext);
    await receiverContext.resume();
    const receiveSource = receiverContext.createMediaStreamSource(remote!);
    const receiveAnalyser = receiverContext.createAnalyser();
    receiveAnalyser.fftSize = 2048;
    const silentGain = receiverContext.createGain();
    silentGain.gain.value = 0;
    receiveSource.connect(receiveAnalyser);
    receiveAnalyser.connect(silentGain);
    silentGain.connect(receiverContext.destination);
    await pause(500);
    const rawNoise = await rms(receiveAnalyser);
    progress.textContent = "Medindo RNNoise no áudio recebido pela conexão WebRTC…";
    const loadStart = performance.now();
    await sender.setNoiseSuppression("advanced");
    results["loadMs"] = performance.now() - loadStart;
    check(statuses.at(-1)?.effective === "advanced", "Real RNNoise model must initialize");
    check(
      peer.transceivers.mic.sender.track === transmitted,
      "Changing mode must retain the transmitted track",
    );
    check(
      constraints.at(-1)?.noiseSuppression === false,
      "Advanced must not double-process native suppression",
    );
    await pause(800);
    const filteredNoise = await rms(receiveAnalyser);
    const noiseReductionDb = 20 * Math.log10(rawNoise / Math.max(1e-10, filteredNoise));
    check(
      rawNoise > 0.005 && noiseReductionDb > 6,
      "Receiver must hear significantly reduced noise",
    );
    results["noise"] = {
      rawRms: rawNoise,
      advancedRms: filteredNoise,
      reductionDb: noiseReductionDb,
    };

    const speech = await inputContext.decodeAudioData(
      await (await fetch("/speech.wav")).arrayBuffer(),
    );
    const speechSource = inputContext.createBufferSource();
    speechSource.buffer = speech;
    speechSource.loop = true;
    const speechGain = inputContext.createGain();
    speechGain.gain.value = 0.8;
    speechSource.connect(speechGain);
    speechGain.connect(inputDestination);
    speechSource.start();
    await pause(500);
    const speechAdvanced = await rms(receiveAnalyser, 1.2);
    await sender.setNoiseSuppression("off");
    await pause(400);
    const speechOff = await rms(receiveAnalyser, 1.2);
    check(speechAdvanced > filteredNoise * 3, "Speech must survive the advanced processing");
    const speechAttenuationDb = 20 * Math.log10(speechOff / speechAdvanced);
    check(speechAttenuationDb < 12, "Speech must not be destroyed");
    results["speech"] = {
      offRms: speechOff,
      advancedRms: speechAdvanced,
      attenuationDb: speechAttenuationDb,
      fixture: "FSDD 0_jackson_0.wav",
    };
    sender.setInputGain(0);
    await pause(250);
    check(
      (await rms(receiveAnalyser)) < 0.0001,
      "Input volume zero must silence transmitted audio",
    );
    sender.setInputGain(100);
    await sender.setNoiseSuppression("advanced");
    await pause(300);
    sender.setMuted(true);
    await pause(250);
    check(
      !transmitted.enabled && (await rms(receiveAnalyser)) < 0.0001,
      "Mute must silence processed audio and its delayed tail",
    );
    sender.setMuted(false);
    await pause(200);
    check(
      transmitted.enabled && (await rms(receiveAnalyser)) > 0.001,
      "Unmute must restore processed audio",
    );

    // Reconnect a different capture stream through the actual device-switch path.
    const switched = inputContext.createMediaStreamDestination();
    speechGain.connect(switched);
    noiseSource.connect(switched);
    streams.push(switched.stream);
    await sender.setDevices({ microphoneId: "test-microphone-2" });
    check(captureTrack.readyState === "ended", "Old microphone must be stopped");
    check(
      peer.transceivers.mic.sender.track === transmitted,
      "Microphone replacement must preserve the processed sender track",
    );
    check(
      statuses.at(-1)?.effective === "advanced",
      "Device replacement must reinitialize RNNoise",
    );
    await pause(400);
    check(
      (await rms(receiveAnalyser)) > 0.001,
      "Receiver must still receive audio after microphone switch",
    );
    const stats = await peer.pc.getStats();
    const outbound = [...stats.values()].find(
      (stat) => stat.type === "outbound-rtp" && stat.kind === "audio",
    );
    check(outbound?.packetsSent > 0, "Actual audio RTP packets must be transmitted");
    results["transport"] = {
      rawTrackId: captureTrack.id,
      processedTrackId: transmitted.id,
      senderTrackId: peer.transceivers.mic.sender.track.id,
      packetsSent: outbound.packetsSent,
      bytesSent: outbound.bytesSent,
      stableTrackAcrossModesAndDevices: true,
    };

    // Fail the module in a fresh context, proving fallback does not silence RTP.
    const prototype = Object.getPrototypeOf(pipeline.context.audioWorklet);
    const originalAddModule = prototype.addModule;
    prototype.addModule = () => Promise.reject(new Error("Simulated unavailable model"));
    const fallback = new MicrophoneAudioPipeline(() => undefined);
    fallback.attachMicrophone(switched.stream);
    let fallbackStatus:
      import("../../src/services/audio-processing").NoiseProcessingStatus | undefined;
    // Keep the same public code path; event captured via independent instance.
    const fallback2 = new MicrophoneAudioPipeline((status) => {
      fallbackStatus = status;
    });
    fallback2.attachMicrophone(switched.stream);
    await fallback2.setMode("advanced");
    check(
      fallbackStatus?.fallback && fallbackStatus.effective === "standard",
      "Load failure must automatically use Standard",
    );
    check((await rms(fallback2.analyser)) > 0.001, "Fallback must keep producing live audio");
    await fallback.dispose();
    await fallback2.dispose();
    prototype.addModule = originalAddModule;
    results["fallback"] = "Model failure → Standard; audio remains live";

    const context = pipeline.context;
    const rawSwitchedTrack = switched.stream.getAudioTracks()[0]!;
    await sender.disconnect();
    await receiver.disconnect();
    check(
      context.state === "closed" &&
        transmitted.readyState === "ended" &&
        rawSwitchedTrack.readyState === "ended",
      "Disconnect must close context and stop raw/processed tracks",
    );
    check(
      senderInternal.audioPipeline === null && peer.pc.connectionState === "closed",
      "Disconnect must release pipeline and peer resources",
    );
    results["cleanup"] = "AudioContext closed; microphone and processed tracks ended; peers closed";
    results["passed"] = true;
    progress.textContent =
      "PASS: processamento, transmissão, modos, microfone, volume, mute, fallback e limpeza";
  } finally {
    await Promise.allSettled(providers.map((provider) => provider.disconnect()));
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
}
document.getElementById("start")!.addEventListener(
  "click",
  () => {
    (document.getElementById("start") as HTMLButtonElement).disabled = true;
    void main()
      .catch((error) => {
        results["passed"] = false;
        results["error"] = error.stack;
        progress.textContent = "FAIL";
      })
      .finally(() => {
        output.textContent = JSON.stringify(results, null, 2);
        document.title = results["passed"] ? "LobbyX audio tests PASS" : "LobbyX audio tests FAIL";
      });
  },
  { once: true },
);
