import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword } from "../../../../lib/auth/password";

const findUserByEmail = vi.fn();

vi.mock("../../../../db/user-repository", () => ({
  findUserByEmail: (email: string) => findUserByEmail(email),
}));

import { POST } from "./route";

const SECRET = "x".repeat(32);

function makeRequest(body: unknown, raw?: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    findUserByEmail.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("responde 204 e grava o cookie de sessão httpOnly com credenciais corretas", async () => {
    const passwordHash = await hashPassword("senha-correta");
    findUserByEmail.mockResolvedValue({ id: 7, passwordHash });

    const response = await POST(
      makeRequest({ email: "Ana@Example.com", password: "senha-correta" }),
    );

    expect(response.status).toBe(204);
    expect(findUserByEmail).toHaveBeenCalledWith("ana@example.com");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^session=[^;]+/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=\d+/i);
  });

  it("responde 401 sem cookie quando a senha está errada", async () => {
    const passwordHash = await hashPassword("senha-correta");
    findUserByEmail.mockResolvedValue({ id: 7, passwordHash });

    const response = await POST(
      makeRequest({ email: "ana@example.com", password: "outra" }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({
      error: "E-mail ou senha incorretos.",
    });
  });

  it("responde 401 quando o e-mail não existe", async () => {
    findUserByEmail.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ email: "x@example.com", password: "qualquer" }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("responde 401 para corpo inválido ou ausente sem consultar o banco", async () => {
    const invalid = await POST(makeRequest({ email: "ruim", password: "a" }));
    const notJson = await POST(makeRequest(null, "não é json"));

    expect(invalid.status).toBe(401);
    expect(notJson.status).toBe(401);
    expect(notJson.headers.get("set-cookie")).toBeNull();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("continua respondendo 401 para dados errados após várias falhas e aceita a senha certa depois", async () => {
    const passwordHash = await hashPassword("senha-correta");
    findUserByEmail.mockResolvedValue({ id: 7, passwordHash });

    for (let i = 0; i < 8; i += 1) {
      const wrong = await POST(
        makeRequest({ email: "ana@example.com", password: "errada" }),
      );
      expect(wrong.status).toBe(401);
    }
    const right = await POST(
      makeRequest({ email: "ana@example.com", password: "senha-correta" }),
    );

    expect(right.status).toBe(204);
  });

  it("responde 401 sem consultar o banco para content-type que não é JSON ou corpo grande", async () => {
    const form = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ email: "ana@example.com", password: "a" }),
      }),
    );
    const big = await POST(
      makeRequest(null, JSON.stringify({ email: "ana@example.com", password: "a".repeat(5000) })),
    );

    expect(form.status).toBe(401);
    expect(big.status).toBe(401);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("responde 500 sem consultar o banco quando SESSION_SECRET falta ou é curto", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    const missing = await POST(
      makeRequest({ email: "ana@example.com", password: "a" }),
    );
    vi.stubEnv("SESSION_SECRET", "curto");
    const short = await POST(
      makeRequest({ email: "ana@example.com", password: "a" }),
    );

    expect(missing.status).toBe(500);
    expect(short.status).toBe(500);
    expect(missing.headers.get("set-cookie")).toBeNull();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("responde 500 quando o banco falha", async () => {
    findUserByEmail.mockRejectedValue(new Error("db fora do ar"));

    const response = await POST(
      makeRequest({ email: "ana@example.com", password: "a" }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
