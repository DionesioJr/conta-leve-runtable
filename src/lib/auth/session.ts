import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  userId: number,
  nowMs: number,
  secret: string,
): string {
  const expiresAt = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string,
  nowMs: number,
  secret: string,
): { userId: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [userIdText, expiresText, signature] = parts;
  const expected = Buffer.from(sign(`${userIdText}.${expiresText}`, secret));
  const received = Buffer.from(signature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null;
  }
  const userId = Number(userIdText);
  const expiresAt = Number(expiresText);
  if (!Number.isInteger(userId) || !Number.isInteger(expiresAt)) {
    return null;
  }
  if (expiresAt <= Math.floor(nowMs / 1000)) {
    return null;
  }
  return { userId };
}
