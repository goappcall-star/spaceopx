/** Browsers may leave getUserMedia pending while a permission prompt is unanswered. */
export function requestMicrophone(request: () => Promise<MediaStream>, timeoutMs = 30000) {
  let settled = false;
  let rejectPending: (error: unknown) => void = () => {};
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<MediaStream>((resolve, reject) => {
    rejectPending = reject;
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new DOMException("Microphone permission did not respond in time", "TimeoutError"));
    }, timeoutMs);
    Promise.resolve()
      .then(() => (settled ? null : request()))
      .then(
        (stream) => {
          if (!stream) return;
          if (settled) {
            // Native permission requests cannot be aborted. Release any late grant.
            for (const track of stream.getTracks()) {
              try {
                track.stop();
              } catch {
                /* Attempt to release all late tracks. */
              }
            }
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(stream);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        },
      );
  });
  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPending(new DOMException("Voice session ended", "AbortError"));
    },
  };
}
