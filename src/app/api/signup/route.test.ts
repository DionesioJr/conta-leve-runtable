import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertUser } from "../../../db/user-repository";
import { registerSignupAttempt } from "../../../db/signup-attempt-repository";
import { POST } from "./route";

const attemptCounts = vi.hoisted(() => new Map<string, number>());

vi.mock("../../../db/connection", () => ({
  getPool: () => ({}),
}));

vi.mock("../../../lib/password", () => ({
  hashPassword: vi.fn(async () => "scrypt$131072$8$1$c2FsdA==$a2V5"),
}));

vi.mock("../../../db/user-repository", () => ({
  insertUser: vi.fn(),
}));

vi.mock("../../../db/signup-attempt-repository", () => ({
  registerSignupAttempt: vi.fn(
    async (_database: unknown, key: { scope: string; subjectHash: string; windowStartMs: number }) => {
      const id = `${key.scope}|${key.subjectHash}|${key.windowStartMs}`;
      const next = (attemptCounts.get(id) ?? 0) + 1;
      attemptCounts.set(id, next);
      return next;
    },
  ),
}));

const insertUserMock = vi.mocked(insertUser);
const registerSignupAttemptMock = vi.mocked(registerSignupAttempt);

const VALID_BODY = {
  name: "Ana Souza",
  email: "ana@exemplo.com.br",
  password: "senha-segura-123",
  passwordConfirmation: "senha-segura-123",
};

function postJson(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
  insertUserMock.mockReset();
  attemptCounts.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/signup", () => {
  it("answers 201 with the created user and without the password hash", async () => {
    insertUserMock.mockResolvedValue({ ok: true, id: 42 });

    const response = await POST(postJson(VALID_BODY));

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toEqual({
      user: { id: 42, name: "Ana Souza", email: "ana@exemplo.com.br" },
    });
    expect(JSON.stringify(payload)).not.toContain("scrypt");
    expect(insertUserMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: "Ana Souza",
        email: "ana@exemplo.com.br",
        passwordHash: expect.stringMatching(/^scrypt\$/),
      }),
    );
  });

  it("answers 400 with the email error when the email is already registered", async () => {
    insertUserMock.mockResolvedValue({ ok: false, reason: "email_taken" });

    const response = await POST(postJson(VALID_BODY));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: { email: "Já existe uma conta com este e-mail." },
    });
  });

  it("answers 400 with a Portuguese message for a password shorter than 8 characters", async () => {
    const response = await POST(
      postJson({ ...VALID_BODY, password: "1234567", passwordConfirmation: "1234567" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: { password: "A senha deve ter pelo menos 8 caracteres." },
    });
    expect(insertUserMock).not.toHaveBeenCalled();
  });

  it("answers 400 with a Portuguese message for a password longer than 1024 characters", async () => {
    const password = "a".repeat(1025);
    const response = await POST(postJson({ ...VALID_BODY, password, passwordConfirmation: password }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: { password: "A senha deve ter no máximo 1024 caracteres." },
    });
    expect(insertUserMock).not.toHaveBeenCalled();
  });

  it("answers 400 with the confirmation error when the passwords differ", async () => {
    const response = await POST(postJson({ ...VALID_BODY, passwordConfirmation: "outra-senha" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: { passwordConfirmation: "As senhas não coincidem." },
    });
    expect(insertUserMock).not.toHaveBeenCalled();
  });

  it("answers 400 when the body is not JSON", async () => {
    const response = await POST(postJson("{nao-e-json"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: { form: "O corpo da requisição deve ser JSON." },
    });
  });

  it("answers 413 without parsing or storing when the body exceeds 16 KB", async () => {
    const response = await POST(postJson("x".repeat(16 * 1024 + 1)));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      errors: { form: "O corpo da requisição é grande demais." },
    });
    expect(insertUserMock).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After once the same e-mail has been tried 5 times in the window", async () => {
    insertUserMock.mockResolvedValue({ ok: false, reason: "email_taken" });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await POST(postJson(VALID_BODY))).status).toBe(400);
    }
    const response = await POST(postJson(VALID_BODY));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    await expect(response.json()).resolves.toEqual({
      errors: { form: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
    });
    expect(insertUserMock).toHaveBeenCalledTimes(5);
  });

  it("answers 429 once the same client IP has made 30 attempts in the window", async () => {
    insertUserMock.mockResolvedValue({ ok: true, id: 1 });
    const headers = { "x-forwarded-for": "203.0.113.9" };

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const email = `pessoa${attempt}@exemplo.com.br`;
      expect((await POST(postJson({ ...VALID_BODY, email }, headers))).status).toBe(201);
    }
    const response = await POST(
      postJson({ ...VALID_BODY, email: "outra@exemplo.com.br" }, headers),
    );

    expect(response.status).toBe(429);
    expect(insertUserMock).toHaveBeenCalledTimes(30);
  });

  it("counts the IP limit before reading the body", async () => {
    insertUserMock.mockResolvedValue({ ok: true, id: 1 });
    const headers = { "x-forwarded-for": "198.51.100.20" };
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await POST(postJson("{nao-e-json", headers));
    }

    const response = await POST(postJson(VALID_BODY, headers));

    expect(response.status).toBe(429);
    expect(insertUserMock).not.toHaveBeenCalled();
  });

  it("answers 500 with a generic message when the repository fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    insertUserMock.mockRejectedValue(new Error("connection lost"));

    const response = await POST(postJson(VALID_BODY));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      errors: { form: "Não foi possível criar a conta. Tente novamente." },
    });
    consoleError.mockRestore();
  });

  it("answers 500 when the attempt counter cannot be stored", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    registerSignupAttemptMock.mockRejectedValueOnce(new Error("connection lost"));

    const response = await POST(postJson(VALID_BODY));

    expect(response.status).toBe(500);
    expect(insertUserMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
