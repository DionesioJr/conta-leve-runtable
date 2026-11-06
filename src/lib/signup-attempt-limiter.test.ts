import { describe, expect, it } from "vitest";
import { createAttemptLimiter } from "./signup-attempt-limiter";

const WINDOW_MS = 15 * 60 * 1000;
const START = 1_000_000;

describe("createAttemptLimiter", () => {
  it("allows attempts up to the limit", () => {
    const limiter = createAttemptLimiter(3, WINDOW_MS);

    expect(limiter.consume("ip-a", START)).toEqual({ allowed: true });
    expect(limiter.consume("ip-a", START)).toEqual({ allowed: true });
    expect(limiter.consume("ip-a", START)).toEqual({ allowed: true });
  });

  it("blocks the attempt after the limit and reports the seconds until the window resets", () => {
    const limiter = createAttemptLimiter(2, WINDOW_MS);
    limiter.consume("ip-a", START);
    limiter.consume("ip-a", START);

    expect(limiter.consume("ip-a", START + 1_000)).toEqual({
      allowed: false,
      retryAfterSeconds: Math.ceil((WINDOW_MS - 1_000) / 1000),
    });
  });

  it("keeps blocking while the window is open, even after more attempts", () => {
    const limiter = createAttemptLimiter(1, WINDOW_MS);
    limiter.consume("ip-a", START);

    expect(limiter.consume("ip-a", START + 1)).toMatchObject({ allowed: false });
    expect(limiter.consume("ip-a", START + 2)).toMatchObject({ allowed: false });
  });

  it("releases the key once the window has elapsed", () => {
    const limiter = createAttemptLimiter(1, WINDOW_MS);
    limiter.consume("ip-a", START);
    expect(limiter.consume("ip-a", START + 1)).toMatchObject({ allowed: false });

    expect(limiter.consume("ip-a", START + WINDOW_MS)).toEqual({ allowed: true });
  });

  it("counts each key separately", () => {
    const limiter = createAttemptLimiter(1, WINDOW_MS);
    limiter.consume("ip-a", START);

    expect(limiter.consume("ip-b", START)).toEqual({ allowed: true });
  });

  it("forgets all keys after reset", () => {
    const limiter = createAttemptLimiter(1, WINDOW_MS);
    limiter.consume("ip-a", START);
    limiter.reset();

    expect(limiter.consume("ip-a", START)).toEqual({ allowed: true });
  });
});
