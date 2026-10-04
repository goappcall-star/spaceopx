import { rolldown } from "rolldown";
import { buildAudioWorklet } from "./build-audio-worklet.mjs";
import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
await buildAudioWorklet();
const root = process.cwd();
const bundle = await rolldown({
  input: "tests/audio/browser-harness.ts",
  plugins: [
    {
      name: "audio-test-aliases",
      resolveId(id) {
        if (id === "@/integrations/supabase/client")
          return path.resolve("tests/audio/supabase-fixture.ts");
        if (id.startsWith("@/")) return path.resolve("src", id.slice(2) + ".ts");
      },
    },
  ],
});
const result = await bundle.generate({ format: "esm" });
await bundle.close();
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    let body, type;
    if (url.pathname === "/") {
      type = "text/html";
      body =
        '<!doctype html><meta charset="utf-8"><title>LobbyX audio tests</title><style>body{background:#0b1019;color:#def;font:16px monospace;padding:32px}pre{white-space:pre-wrap}</style><h1>LobbyX — testes de áudio</h1><button id="start">Iniciar teste</button><p id="progress">Pronto: áudio de teste, sem acesso ao microfone.</p><pre id="result"></pre><script type="module" src="/harness.js"></script>';
    } else if (url.pathname === "/harness.js") {
      type = "text/javascript";
      body = result.output[0].code;
    } else {
      const location =
        url.pathname === "/speech.wav"
          ? path.resolve(root, "tests/audio/speech.wav")
          : path.resolve(root, "public", "." + url.pathname);
      if (!location.startsWith(root + path.sep)) throw Error("Forbidden");
      body = await readFile(location);
      type = url.pathname.endsWith(".wav") ? "audio/wav" : "text/javascript";
    }
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
server.listen(5179, "127.0.0.1", () => console.log("Audio harness: http://127.0.0.1:5179/"));
