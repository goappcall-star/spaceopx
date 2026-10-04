// RNNoise uses 480 samples of 16-bit-scaled PCM at 48 kHz. WebAudio supplies
// normalized floats in render quanta. A fixed 512-sample FIFO avoids jitter
// as 480 is not divisible by the current 128-sample WebAudio quantum.
export class RnnoiseFrameBuffer {
  constructor(state) {
    this.state = state;
    this.frame = new Float32Array(480);
    this.queue = new Float32Array(4096);
    this.inputSize = 0;
    this.read = 0;
    this.write = 512;
    this.queued = 512;
    this.frames = 0;
  }

  process(input, output) {
    if (input.length > 512 || input.length !== output.length) throw new Error("Unsupported audio quantum");
    for (let i = 0; i < input.length; i++) {
      this.frame[this.inputSize++] = input[i] * 32768;
      if (this.inputSize === 480) {
        this.state.processFrame(this.frame);
        this.frames++;
        for (let j = 0; j < 480; j++) {
          this.queue[this.write] = this.frame[j] / 32768;
          this.write = (this.write + 1) % this.queue.length;
        }
        this.queued += 480;
        this.inputSize = 0;
      }
    }
    if (this.queued < output.length) throw new Error("Audio FIFO underrun");
    for (let i = 0; i < output.length; i++) {
      output[i] = this.queue[this.read];
      this.read = (this.read + 1) % this.queue.length;
    }
    this.queued -= output.length;
  }

  destroy() {
    this.state.destroy();
    this.frame.fill(0);
    this.queue.fill(0);
  }
}
