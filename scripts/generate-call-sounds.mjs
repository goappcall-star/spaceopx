import { mkdirSync, writeFileSync } from "node:fs";
// Original short two-note cues, mono PCM. No external samples or downloads.
mkdirSync("public/sounds", { recursive: true });
for (const [name, notes] of [
  ["enter", [660, 880]],
  ["leave", [660, 440]],
]) {
  const rate = 22050,
    seconds = 0.28,
    samples = Math.ceil(rate * seconds);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const time = i / rate,
      note = time < 0.14 ? 0 : 1,
      local = time - note * 0.14;
    const envelope = local < 0.12 ? Math.sin((Math.PI * local) / 0.12) ** 2 : 0;
    const phase = 2 * Math.PI * notes[note] * local;
    wav.writeInt16LE(
      Math.round(32767 * 0.24 * envelope * (Math.sin(phase) + 0.12 * Math.sin(phase * 2))),
      44 + i * 2,
    );
  }
  writeFileSync(`public/sounds/call-${name}.wav`, wav);
}
