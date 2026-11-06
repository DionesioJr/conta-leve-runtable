import { beforeAll, describe, expect, it, vi } from "vitest";
import type { UserRecord } from "../db/user-repository";
import { authenticateUser, normalizeEmail } from "./login";
import { hashPassword } from "./password";

const PASSWORD = "senha-segura-123";
let storedUser: UserRecord;

beforeAll(async () => {
  storedUser = {
    id: "7",
    email: "ana@exemplo.com.br",
    name: "Ana",
    passwordHash: await hashPassword(PASSWORD),
  };
});

function finderReturning(user: UserRecord | null) {
  return vi.fn(async (email: string) => (email === storedUser.email ? user : null));
}

describe("authenticateUser", () => {
  it("returns the user when the password matches", async () => {
    const finder = finderReturning(storedUser);
    await expect(
      authenticateUser({ email: storedUser.email, password: PASSWORD }, finder),
    ).resolves.toEqual({ id: "7", email: "ana@exemplo.com.br", name: "Ana" });
  });

  it("never returns the password hash", async () => {
    const result = await authenticateUser(
      { email: storedUser.email, password: PASSWORD },
      finderReturning(storedUser),
    );
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("returns null when the password is wrong", async () => {
    await expect(
      authenticateUser({ email: storedUser.email, password: "outra-senha" }, finderReturning(storedUser)),
    ).resolves.toBeNull();
  });

  it("returns null when no user has the e-mail", async () => {
    await expect(
      authenticateUser({ email: "ninguem@exemplo.com.br", password: PASSWORD }, finderReturning(null)),
    ).resolves.toBeNull();
  });

  it("looks up the e-mail trimmed and in lower case", async () => {
    const finder = finderReturning(storedUser);
    await authenticateUser({ email: "  ANA@Exemplo.com.br ", password: PASSWORD }, finder);
    expect(finder).toHaveBeenCalledWith("ana@exemplo.com.br");
  });

  it("propagates a failure from the user lookup", async () => {
    const finder = vi.fn(async () => {
      throw new Error("connection refused");
    });
    await expect(
      authenticateUser({ email: storedUser.email, password: PASSWORD }, finder),
    ).rejects.toThrow("connection refused");
  });
});

describe("normalizeEmail", () => {
  it("trims spaces and lower-cases the address", () => {
    expect(normalizeEmail("  Ana.Silva@Exemplo.com.br ")).toBe("ana.silva@exemplo.com.br");
  });
});
