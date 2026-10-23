import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RemoteAudio } from "../../src/components/voice/RemoteAudio";
import { PlaybackFixture } from "./playback-fixture";
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function Harness() {
  const [media, setMedia] = useState(
    {} as React.ContextType<typeof PlaybackFixture>["remoteMedia"],
  );
  const [deafened, setDeafened] = useState(false);
  const [result, setResult] = useState("Pronto. Sem microfone, sem Supabase, sem produção.");
  async function run() {
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      await context.resume();
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        destination = context.createMediaStreamDestination();
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      setMedia({
        remote: { audio: destination.stream, camera: null, screen: null, screenAudio: null },
      });
      await wait(700);
      const audio = document.querySelector("audio")!;
      if (
        audio.srcObject !== destination.stream ||
        audio.paused ||
        audio.volume !== 1 ||
        audio.muted
      )
        throw Error("Player não reproduz no volume normal");
      const t = audio.currentTime;
      await wait(500);
      if (audio.currentTime <= t) throw Error("Player parado");
      setDeafened(true);
      await wait(100);
      if (Number(audio.volume) !== 0) throw Error("Deafen não silenciou");
      setDeafened(false);
      await wait(100);
      if (Number(audio.volume) !== 1) throw Error("Reativação não restaurou áudio");
      setMedia({});
      await wait(100);
      if (audio.srcObject !== null) throw Error("Player não liberou stream");
      destination.stream.getTracks().forEach((t) => t.stop());
      oscillator.stop();
      setResult(
        "PASS: player real reproduziu stream sintético, mute/reativação e limpeza. Sem validação de alto-falantes físicos.",
      );
    } catch (error) {
      setResult("FAIL: " + String(error));
    } finally {
      setMedia({});
      if (context) await context.close();
    }
  }
  return (
    <>
      <h1>Reprodução de áudio da sala — teste isolado</h1>
      <button onClick={() => void run()}>Testar reprodução</button>
      <pre>{result}</pre>
      <PlaybackFixture.Provider
        value={{
          remoteMedia: media,
          volumes: {},
          deafened,
          restrictions: {},
          activeServerId: "isolated-test",
          outputVolume: 100,
        }}
      >
        <RemoteAudio />
      </PlaybackFixture.Provider>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
