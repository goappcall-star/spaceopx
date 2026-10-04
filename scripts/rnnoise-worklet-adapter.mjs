// This pinned Emscripten build embeds its WASM/model and uses no browser DOM.
// Its web-only environment guard rejects AudioWorkletGlobalScope (which has
// neither Window nor WorkerGlobalScope). Adapt ONLY that guard, preserving the
// actual model and DSP. The same adapted code is exercised by CPU tests.
export function adaptRnnoiseForWorklet(code) {
  const guard = 'typeof window == "object" || typeof WorkerGlobalScope < "u"';
  if (code.split(guard).length !== 2)
    throw Error("RNNoise wrapper changed; review the worklet adapter");
  return code.replace(guard, "true /* embedded WASM supports AudioWorklet */");
}
