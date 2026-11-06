import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("produces the scrypt$<salt hex>$<key hex> format", async () => {
    const hash = await hashPassword("senha-segura-123");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it("fits the password_hash column (VARCHAR 255)", async () => {
    const hash = await hashPassword("senha-segura-123");
    expect(hash.length).toBeLessThanOrEqual(255);
  });

  it("uses a different salt on every call", async () => {
    const first = await hashPassword("senha-segura-123");
    const second = await hashPassword("senha-segura-123");
    expect(first).not.toBe(second);
  });

  it("does not contain the plain password", async () => {
    const hash = await hashPassword("senha-segura-123");
    expect(hash).not.toContain("senha-segura-123");
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", async () => {
    const hash = await hashPassword("senha-segura-123");
    await expect(verifyPassword("senha-segura-123", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("senha-segura-123");
    await expect(verifyPassword("outra-senha", hash)).resolves.toBe(false);
  });

  it("accepts passwords with accents", async () => {
    const hash = await hashPassword("açaí-É-ção-123");
    await expect(verifyPassword("açaí-É-ção-123", hash)).resolves.toBe(true);
  });

  it("treats NFC and NFD forms of the same password as equal (NFKC)", async () => {
    const nfc = "açaí-É".normalize("NFC");
    const nfd = nfc.normalize("NFD");
    expect(nfd).not.toBe(nfc);
    const hash = await hashPassword(nfc);
    await expect(verifyPassword(nfd, hash)).resolves.toBe(true);
    const hashFromNfd = await hashPassword(nfd);
    await expect(verifyPassword(nfc, hashFromNfd)).resolves.toBe(true);
  });

  it.each([
    ["empty string", ""],
    ["short even-length salt", `scrypt$aabb$${"a".repeat(128)}`],
    ["long salt (17 bytes)", `scrypt$${"a".repeat(34)}$${"a".repeat(128)}`],
    ["plain text", "senha-segura-123"],
    ["wrong scheme", "bcrypt$aa$bb"],
    ["missing key", "scrypt$aabb"],
    ["extra part", `scrypt$aabb$${"a".repeat(128)}$x`],
    ["non-hex salt", `scrypt$zz$${"a".repeat(128)}`],
    ["odd-length salt", `scrypt$aab$${"a".repeat(128)}`],
    ["short key", "scrypt$aabb$aabb"],
  ])("rejects a malformed stored hash (%s)", async (_label, stored) => {
    await expect(verifyPassword("senha-segura-123", stored)).resolves.toBe(false);
  });
});
