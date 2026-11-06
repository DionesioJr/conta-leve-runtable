import { describe, expect, it } from "vitest";
import {
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isValidSessionSecret,
  readSessionToken,
} from "./session";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const NOW = 1_800_000_000;

describe("createSessionToken and readSessionToken", () => {
  it("returns the user id it was created for", () => {
    const token = createSessionToken("42", SECRET, NOW);
    expect(readSessionToken(token, SECRET, NOW)).toEqual({
      userId: "42",
      expiresAt: NOW + SESSION_MAX_AGE_SECONDS,
    });
  });

  it("does not leave the user id readable as plain text", () => {
    const token = createSessionToken("42", SECRET, NOW);
    expect(token).not.toContain('"sub"');
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken("42", SECRET, NOW);
    expect(readSessionToken(token, "outro-segredo-com-mais-de-32-caracteres", NOW)).toBeNull();
  });

  it("rejects a token whose payload was changed to another user", () => {
    const token = createSessionToken("42", SECRET, NOW);
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "1", exp: NOW + SESSION_MAX_AGE_SECONDS }),
      "utf8",
    ).toString("base64url");
    expect(readSessionToken(`${forgedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a token after it expires", () => {
    const token = createSessionToken("42", SECRET, NOW);
    expect(readSessionToken(token, SECRET, NOW + SESSION_MAX_AGE_SECONDS)).toBeNull();
  });

  it.each(["", "abc", "a.b.c", ".", "payload.", ".signature"])(
    "rejects a malformed token %j",
    (token) => {
      expect(readSessionToken(token, SECRET, NOW)).toBeNull();
    },
  );

  it("rejects a token with a valid signature over a payload without a user id", () => {
    const payload = Buffer.from(JSON.stringify({ exp: NOW + 60 }), "utf8").toString("base64url");
    const token = createSessionToken("42", SECRET, NOW);
    const [, signature] = token.split(".");
    expect(readSessionToken(`${payload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("refuses to create a token with a weak secret", () => {
    expect(() => createSessionToken("42", "curto", NOW)).toThrow(RangeError);
  });

  it("refuses to read a token with a weak secret", () => {
    const token = createSessionToken("42", SECRET, NOW);
    expect(() => readSessionToken(token, "curto", NOW)).toThrow(RangeError);
  });
});

describe("isValidSessionSecret", () => {
  it("accepts a secret with at least 32 characters", () => {
    expect(isValidSessionSecret("a".repeat(32))).toBe(true);
  });

  it("rejects a secret shorter than 32 characters", () => {
    expect(isValidSessionSecret("a".repeat(31))).toBe(false);
    expect(isValidSessionSecret("")).toBe(false);
  });
});
