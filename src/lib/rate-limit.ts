import { createHash } from "node:crypto";

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

export type RateLimitStore = {
  registerAttempt(attempt: {
    scope: string;
    subjectHash: string;
    windowStartMs: number;
  }): Promise<number>;
};

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function hashRateLimitSubject(subject: string): string {
  return createHash("sha256").update(subject, "utf8").digest("hex");
}

export async function consumeRateLimit(
  store: RateLimitStore,
  scope: string,
  subject: string,
  policy: RateLimitPolicy,
  nowMs: number,
): Promise<RateLimitDecision> {
  const windowStartMs = Math.floor(nowMs / policy.windowMs) * policy.windowMs;
  const attempts = await store.registerAttempt({
    scope,
    subjectHash: hashRateLimitSubject(subject),
    windowStartMs,
  });

  if (attempts <= policy.limit) {
    return { allowed: true };
  }

  const windowEndMs = windowStartMs + policy.windowMs;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000)),
  };
}
