import { verifySessionToken } from "./session";

export function hasValidSession(
  token: string | undefined,
  nowMs: number,
  secret: string | undefined,
): boolean {
  if (!token || !secret || secret.length < 32) {
    return false;
  }
  return verifySessionToken(token, nowMs, secret) !== null;
}
