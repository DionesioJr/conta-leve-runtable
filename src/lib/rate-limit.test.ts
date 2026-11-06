import { describe, expect, it } from "vitest";
import {
  consumeRateLimit,
  hashRateLimitSubject,
  type RateLimitStore,
} from "./rate-limit";

const WINDOW_MS = 60_000;
const POLICY = { limit: 3, windowMs: WINDOW_MS };

function memoryStore(): RateLimitStore & { calls: Array<{ scope: string; subjectHash: string; windowStartMs: number }> } {
  const counts = new Map<string, number>();
  const calls: Array<{ scope: string; subjectHash: string; windowStartMs: number }> = [];
  return {
    calls,
    async registerAttempt(attempt) {
      calls.push(attempt);
      const id = `${attempt.scope}|${attempt.subjectHash}|${attempt.windowStartMs}`;
      const next = (counts.get(id) ?? 0) + 1;
      counts.set(id, next);
      return next;
    },
  };
}

describe("consumeRateLimit", () => {
  it("allows attempts up to the limit within the window", async () => {
    const store = memoryStore();
    const now = 120_000;
    for (let i = 0; i < POLICY.limit; i += 1) {
      await expect(consumeRateLimit(store, "signup_ip", "203.0.113.5", POLICY, now)).resolves.toEqual({
        allowed: true,
      });
    }
  });

  it("blocks the attempt after the limit and reports when the window ends", async () => {
    const store = memoryStore();
    const now = 120_000 + 10_000;
    for (let i = 0; i < POLICY.limit; i += 1) {
      await consumeRateLimit(store, "signup_ip", "203.0.113.5", POLICY, now);
    }

    await expect(consumeRateLimit(store, "signup_ip", "203.0.113.5", POLICY, now)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 50,
    });
  });

  it("reports at least one second when the window is about to end", async () => {
    const store = memoryStore();
    const nearEnd = 180_000 - 1;
    for (let i = 0; i < POLICY.limit; i += 1) {
      await consumeRateLimit(store, "signup_ip", "203.0.113.5", POLICY, nearEnd);
    }

    await expect(consumeRateLimit(store, "signup_ip", "203.0.113.5", POLICY, nearEnd)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  it("starts a fresh count in the next window", async () => {
    const store = memoryStore();
    for (let i = 0; i < POLICY.limit; i += 1) {
      await consumeRateLimit(store, "signup_ip", "203.0.113.5", POLICY, 120_000);
    }

    await expect(consumeRateLimit(store, "signup_ip", "203.0.113.5", POLICY, 180_000)).resolves.toEqual({
      allowed: true,
    });
  });

  it("keeps separate counts for different subjects and scopes", async () => {
    const store = memoryStore();
    for (let i = 0; i < POLICY.limit; i += 1) {
      await consumeRateLimit(store, "signup_ip", "203.0.113.5", POLICY, 120_000);
    }

    await expect(consumeRateLimit(store, "signup_ip", "198.51.100.7", POLICY, 120_000)).resolves.toEqual({
      allowed: true,
    });
    await expect(consumeRateLimit(store, "signup_email", "203.0.113.5", POLICY, 120_000)).resolves.toEqual({
      allowed: true,
    });
  });

  it("never hands the raw subject to the store", async () => {
    const store = memoryStore();
    await consumeRateLimit(store, "signup_email", "ana@exemplo.com.br", POLICY, 120_000);

    const [attempt] = store.calls;
    expect(attempt.subjectHash).toBe(hashRateLimitSubject("ana@exemplo.com.br"));
    expect(attempt.subjectHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(store.calls)).not.toContain("ana@exemplo.com.br");
  });

  it("aligns the window start to the policy window", async () => {
    const store = memoryStore();
    await consumeRateLimit(store, "signup_ip", "203.0.113.5", POLICY, 125_000);

    expect(store.calls[0].windowStartMs).toBe(120_000);
  });
});
