import { describe, expect, it } from "vitest";
import { hasValidSession } from "./guard";
import { createSessionToken } from "./session";

const secret = "s".repeat(32);
const now = 1_700_000_000_000;

describe("hasValidSession", () => {
  it("accepts a token signed with the secret", () => {
    const token = createSessionToken(7, now, secret);
    expect(hasValidSession(token, now, secret)).toBe(true);
  });

  it("rejects a missing token", () => {
    expect(hasValidSession(undefined, now, secret)).toBe(false);
    expect(hasValidSession("", now, secret)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken(7, now, "o".repeat(32));
    expect(hasValidSession(token, now, secret)).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(7, now, secret);
    const later = now + 8 * 24 * 60 * 60 * 1000;
    expect(hasValidSession(token, later, secret)).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(hasValidSession("abc", now, secret)).toBe(false);
  });

  it("rejects when the secret is missing or too short", () => {
    const token = createSessionToken(7, now, secret);
    expect(hasValidSession(token, now, undefined)).toBe(false);
    expect(hasValidSession(token, now, "short")).toBe(false);
  });
});
