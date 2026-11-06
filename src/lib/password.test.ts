import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

const PASSWORD = "senha-segura-123";

describe("hashPassword", () => {
  it("stores a value that is not the original password", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).not.toBe(PASSWORD);
    expect(hash).not.toContain(PASSWORD);
  });

  it("produces a hash that fits the password_hash VARCHAR(255) column", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash.length).toBeLessThanOrEqual(255);
  });

  it("uses a fresh random salt, so equal passwords give different hashes", async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);
    expect(first).not.toBe(second);
  });

  it("refuses an empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow(RangeError);
  });
});

describe("verifyPassword", () => {
  it("accepts the original password", async () => {
    const hash = await hashPassword(PASSWORD);
    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(true);
  });

  it("accepts passwords with accents and non-ASCII characters", async () => {
    const password = "ação-çãoé-2026";
    const hash = await hashPassword(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it("rejects a different password", async () => {
    const hash = await hashPassword(PASSWORD);
    await expect(verifyPassword("outra-senha-456", hash)).resolves.toBe(false);
  });

  it("rejects a password that differs only by case", async () => {
    const hash = await hashPassword(PASSWORD);
    await expect(verifyPassword(PASSWORD.toUpperCase(), hash)).resolves.toBe(false);
  });

  it("returns false for a stored value that is not a scrypt hash", async () => {
    await expect(verifyPassword(PASSWORD, PASSWORD)).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, "")).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, "$2b$10$hash-de-teste")).resolves.toBe(false);
  });

  it("returns false for a stored hash with invalid cost parameters", async () => {
    const hash = await hashPassword(PASSWORD);
    const [, , r, p, salt, key] = hash.split("$");
    await expect(verifyPassword(PASSWORD, `scrypt$1000$${r}$${p}$${salt}$${key}`)).resolves.toBe(
      false,
    );
    await expect(verifyPassword(PASSWORD, `scrypt$131072$0$${p}$${salt}$${key}`)).resolves.toBe(
      false,
    );
  });

  it("returns false instead of throwing when the stored cost exceeds the memory limit", async () => {
    // N=2^20 com r=8 exige 128 * N * r = 1 GiB, acima do maxmem de 256 MB.
    const hash = await hashPassword(PASSWORD);
    const [, , r, p, salt, key] = hash.split("$");
    await expect(
      verifyPassword(PASSWORD, `scrypt$1048576$${r}$${p}$${salt}$${key}`),
    ).resolves.toBe(false);
  });

  it("returns false for a stored hash with a truncated key", async () => {
    const hash = await hashPassword(PASSWORD);
    const truncated = hash.slice(0, hash.lastIndexOf("$") + 5);
    await expect(verifyPassword(PASSWORD, truncated)).resolves.toBe(false);
  });
});
