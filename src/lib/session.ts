import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "conta_leve_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const MIN_SECRET_LENGTH = 32;

export type SessionPayload = {
  userId: string;
  expiresAt: number;
};

export function isValidSessionSecret(secret: string): boolean {
  return secret.length >= MIN_SECRET_LENGTH;
}

function assertValidSessionSecret(secret: string): void {
  if (!isValidSessionSecret(secret)) {
    throw new RangeError(`Session secret must have at least ${MIN_SECRET_LENGTH} characters.`);
  }
}

function sign(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function createSessionToken(userId: string, secret: string, nowSeconds: number): string {
  assertValidSessionSecret(secret);
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: nowSeconds + SESSION_MAX_AGE_SECONDS }),
    "utf8",
  ).toString("base64url");
  const signature = sign(payload, secret).toString("base64url");
  return `${payload}.${signature}`;
}

export function readSessionToken(
  token: string,
  secret: string,
  nowSeconds: number,
): SessionPayload | null {
  assertValidSessionSecret(secret);
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [payload, signature] = parts;
  if (payload === "" || signature === "") {
    return null;
  }

  const expected = sign(payload, secret);
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const { sub, exp } = data as { sub?: unknown; exp?: unknown };
  if (typeof sub !== "string" || typeof exp !== "number" || !Number.isFinite(exp)) {
    return null;
  }
  if (exp <= nowSeconds) {
    return null;
  }
  return { userId: sub, expiresAt: exp };
}
