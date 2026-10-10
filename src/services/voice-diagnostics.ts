/** Explicit local opt-in. No uploads, identities, media, SDP or candidate addresses. */
let emitted = 0;
export function voiceDiagnostic(stage: string, outcome = "start") {
  try {
    if (
      typeof window === "undefined" ||
      new URLSearchParams(window.location.search).get("voiceDiagnostics") !== "1"
    )
      return;
    if (emitted++ >= 500) return;
    console.info(
      "[LobbyX Voice] " +
        JSON.stringify({
          at: new Date().toISOString(),
          stage,
          outcome,
        }),
    );
  } catch {
    /* Diagnostics must not interrupt calls. */
  }
}

export function voiceStage(stage: string) {
  voiceDiagnostic(stage);
  const timer =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("voiceDiagnostics") === "1"
      ? setTimeout(() => voiceDiagnostic(stage, "pending-15s"), 15000)
      : undefined;
  return (outcome = "complete") => {
    if (timer !== undefined) clearTimeout(timer);
    voiceDiagnostic(stage, outcome);
  };
}

export function voiceErrorName(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  return [
    "NotAllowedError",
    "NotFoundError",
    "NotReadableError",
    "AbortError",
    "TimeoutError",
    "SecurityError",
    "InvalidStateError",
    "OperationError",
    "TypeError",
  ].includes(name)
    ? name
    : "Error";
}
