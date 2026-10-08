import { Rnnoise } from "@shiguredo/rnnoise-wasm";
import { RnnoiseFrameBuffer } from "./rnnoise-frame-buffer.mjs";

// Embedded WASM/model: no CDN, network microphone audio, SharedArrayBuffer,
// or cross-origin isolation. Executed solely on the audio rendering thread.
let model;
class LobbyXRnnoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.closed = false;
    this.processor = null;
    this.port.onmessage = ({ data }) => {
      if (data?.type === "dispose") {
        this.closed = true;
        this.processor?.destroy();
        this.processor = null;
        this.port.postMessage({ type: "disposed" });
      }
    };
    if (sampleRate !== 48000) {
      this.port.postMessage({ type: "error", message: "RNNoise requires 48 kHz" });
      return;
    }
    model ??= Rnnoise.load().catch((error) => {
      model = null;
      throw error;
    });
    void model
      .then((rnnoise) => {
        if (this.closed) return;
        if (rnnoise.frameSize !== 480) throw new Error("Unexpected RNNoise frame size");
        this.processor = new RnnoiseFrameBuffer(rnnoise.createDenoiseState());
        this.port.postMessage({ type: "ready", bufferDelayMs: 512 / 48 });
      })
      .catch(() =>
        this.port.postMessage({ type: "error", message: "RNNoise initialization failed" }),
      );
  }

  process(inputs, outputs) {
    if (this.closed) return false;
    const output = outputs[0]?.[0];
    const input = inputs[0]?.[0];
    if (!this.processor || !output || !input) return true;
    try {
      this.processor.process(input, output);
    } catch {
      this.closed = true;
      this.processor.destroy();
      this.processor = null;
      this.port.postMessage({ type: "error", message: "RNNoise processing failed" });
      return false;
    }
    return true;
  }
}
registerProcessor("lobbyx-rnnoise-v1", LobbyXRnnoiseProcessor);
