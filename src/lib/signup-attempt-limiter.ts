export const SIGNUP_ATTEMPT_LIMIT = 10;
export const SIGNUP_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export type AttemptDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type AttemptLimiter = {
  consume: (key: string, now?: number) => AttemptDecision;
  reset: () => void;
};

type AttemptWindow = {
  count: number;
  resetAt: number;
};

export function createAttemptLimiter(limit: number, windowMs: number): AttemptLimiter {
  const windows = new Map<string, AttemptWindow>();
  let lastSweep = 0;

  function sweepExpired(now: number): void {
    if (now - lastSweep < windowMs) {
      return;
    }
    lastSweep = now;
    for (const [key, window] of windows) {
      if (window.resetAt <= now) {
        windows.delete(key);
      }
    }
  }

  return {
    consume(key, now = Date.now()) {
      sweepExpired(now);

      const current = windows.get(key);
      const window =
        current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
      window.count += 1;
      windows.set(key, window);

      if (window.count <= limit) {
        return { allowed: true };
      }
      return { allowed: false, retryAfterSeconds: Math.ceil((window.resetAt - now) / 1000) };
    },
    reset() {
      windows.clear();
      lastSweep = 0;
    },
  };
}

export const signupAttemptLimiter = createAttemptLimiter(
  SIGNUP_ATTEMPT_LIMIT,
  SIGNUP_ATTEMPT_WINDOW_MS,
);
