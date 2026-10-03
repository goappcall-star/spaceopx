export const CALL_GRACE_MS = 30_000;

/** A repeated leave event must not extend the deadline. Cancel on every exit. */
export function createCallGracePeriod(onExpire: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deadline: number | null = null;
  return {
    start() {
      if (deadline !== null) return deadline;
      deadline = Date.now() + CALL_GRACE_MS;
      timer = setTimeout(() => { timer = null; deadline = null; onExpire(); }, CALL_GRACE_MS);
      return deadline;
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      deadline = null;
    },
  };
}
