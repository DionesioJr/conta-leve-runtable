export type RateLimitRule = { maxFailures: number; windowMs: number };

export type LoginRateLimiter = {
  isBlocked: (key: string, now: number) => boolean;
  recordFailure: (key: string, now: number) => void;
  reset: (key: string) => void;
};

const MAX_TRACKED_KEYS = 10000;

export function createLoginRateLimiter(rule: RateLimitRule): LoginRateLimiter {
  const failures = new Map<string, number[]>();

  function recent(key: string, now: number): number[] {
    const list = (failures.get(key) ?? []).filter(
      (time) => now - time < rule.windowMs,
    );
    if (list.length === 0) {
      failures.delete(key);
    } else {
      failures.set(key, list);
    }
    return list;
  }

  return {
    isBlocked(key, now) {
      return recent(key, now).length >= rule.maxFailures;
    },
    recordFailure(key, now) {
      const list = recent(key, now);
      if (list.length === 0 && failures.size >= MAX_TRACKED_KEYS) {
        const oldest = failures.keys().next().value;
        if (oldest !== undefined) {
          failures.delete(oldest);
        }
      }
      list.push(now);
      failures.set(key, list);
    },
    reset(key) {
      failures.delete(key);
    },
  };
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
