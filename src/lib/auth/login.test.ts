import { describe, expect, it, vi } from "vitest";

import { login, parseLoginInput } from "./login";
import { hashPassword } from "./password";
import { createSessionToken, verifySessionToken } from "./session";

const SECRET = "x".repeat(32);
const NOW = 1_800_000_000_000;

async function makeDeps(email = "ana@example.com", password = "senha-correta") {
  const passwordHash = await hashPassword(password);
  const findUserByEmail = vi.fn(async (value: string) =>
    value === email ? { id: 7, passwordHash } : null,
  );
  return { findUserByEmail, now: () => NOW, secret: SECRET };
}

describe("parseLoginInput", () => {
  it("normaliza o e-mail", () => {
    expect(parseLoginInput({ email: "  Ana@Example.com ", password: "a" })).toEqual({
      email: "ana@example.com",
      password: "a",
    });
  });

  it.each([
    null,
    "texto",
    {},
    { email: "ana@example.com" },
    { email: "invalido", password: "a" },
    { email: "ana@example.com", password: "" },
    { email: 1, password: "a" },
    { email: "ana@example.com", password: "a".repeat(201) },
  ])("rejeita entrada inválida %#", (body) => {
    expect(parseLoginInput(body)).toBeNull();
  });
});

describe("login", () => {
  it("retorna 204 e token verificável com dados corretos", async () => {
    const deps = await makeDeps();
    const result = await login(
      { email: "ANA@example.com", password: "senha-correta" },
      deps,
    );
    expect(result.status).toBe(204);
    if (result.status === 204) {
      expect(verifySessionToken(result.token, NOW, SECRET)).toEqual({ userId: 7 });
    }
  });

  it("retorna 401 com senha errada", async () => {
    const deps = await makeDeps();
    const result = await login(
      { email: "ana@example.com", password: "outra" },
      deps,
    );
    expect(result).toEqual({ status: 401 });
  });

  it("retorna 401 quando o e-mail não existe", async () => {
    const deps = await makeDeps();
    const result = await login(
      { email: "bia@example.com", password: "senha-correta" },
      deps,
    );
    expect(result).toEqual({ status: 401 });
  });

  it("retorna 401 sem consultar o banco com entrada inválida", async () => {
    const deps = await makeDeps();
    const result = await login({ email: "", password: "" }, deps);
    expect(result).toEqual({ status: 401 });
    expect(deps.findUserByEmail).not.toHaveBeenCalled();
  });
});

describe("session token", () => {
  it("expira após o prazo", () => {
    const token = createSessionToken(1, NOW, SECRET);
    expect(verifySessionToken(token, NOW + 8 * 24 * 3600 * 1000, SECRET)).toBeNull();
  });

  it("rejeita assinatura adulterada ou segredo diferente", () => {
    const token = createSessionToken(1, NOW, SECRET);
    const tampered = token.replace(/^1\./, "2.");
    expect(verifySessionToken(tampered, NOW, SECRET)).toBeNull();
    expect(verifySessionToken(token, NOW, "y".repeat(32))).toBeNull();
    expect(verifySessionToken("lixo", NOW, SECRET)).toBeNull();
  });
});
