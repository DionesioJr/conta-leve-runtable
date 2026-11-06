import { describe, expect, it } from "vitest";

import { createLoginRateLimiter } from "./login-rate-limit";

const RULE = { maxFailures: 3, windowMs: 1000 };

describe("createLoginRateLimiter", () => {
  it("não bloqueia abaixo do limite", () => {
    const limiter = createLoginRateLimiter(RULE);
    limiter.recordFailure("a", 0);
    limiter.recordFailure("a", 1);
    expect(limiter.isBlocked("a", 2)).toBe(false);
  });

  it("bloqueia ao atingir o limite dentro da janela", () => {
    const limiter = createLoginRateLimiter(RULE);
    limiter.recordFailure("a", 0);
    limiter.recordFailure("a", 1);
    limiter.recordFailure("a", 2);
    expect(limiter.isBlocked("a", 3)).toBe(true);
    expect(limiter.isBlocked("b", 3)).toBe(false);
  });

  it("libera quando as falhas saem da janela", () => {
    const limiter = createLoginRateLimiter(RULE);
    limiter.recordFailure("a", 0);
    limiter.recordFailure("a", 1);
    limiter.recordFailure("a", 2);
    expect(limiter.isBlocked("a", 1001)).toBe(false);
  });

  it("reset zera as falhas da chave", () => {
    const limiter = createLoginRateLimiter(RULE);
    limiter.recordFailure("a", 0);
    limiter.recordFailure("a", 1);
    limiter.recordFailure("a", 2);
    limiter.reset("a");
    expect(limiter.isBlocked("a", 3)).toBe(false);
  });
});
