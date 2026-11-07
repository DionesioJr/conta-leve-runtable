import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertUser } from "../../../db/user-repository";
import { SIGNUP_ATTEMPT_LIMIT, signupAttemptLimiter } from "../../../lib/signup-attempt-limiter";
import { POST } from "./route";

vi.mock("../../../db/connection", () => ({
  getPool: () => ({}),
}));

vi.mock("../../../lib/password", () => ({
  hashPassword: vi.fn(async () => "scrypt$131072$8$1$c2FsdA==$a2V5"),
}));

vi.mock("../../../db/user-repository", () => ({
  insertUser: vi.fn(),
}));

const insertUserMock = vi.mocked(insertUser);

const VALID_BODY = {
  name: "Ana Souza",
  email: "ana@exemplo.com.br",
  password: "senha-segura-123",
  passwordConfirmation: "senha-segura-123",
};

const CLIENT_IP = "198.51.100.7";

function postJson(body: unknown, ip: string = CLIENT_IP): Request {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  insertUserMock.mockReset();
  signupAttemptLimiter.reset();
});

afterEach(() => {
  vi.unstubAllEnvs();
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

  it("answers 429 with Retry-After once one IP exceeds the attempt limit, without storing", async () => {
    insertUserMock.mockResolvedValue({ ok: false, reason: "email_taken" });

    for (let attempt = 0; attempt < SIGNUP_ATTEMPT_LIMIT; attempt += 1) {
      await POST(postJson(VALID_BODY));
    }
    insertUserMock.mockClear();

    const response = await POST(postJson(VALID_BODY));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    await expect(response.json()).resolves.toEqual({
      errors: { form: "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente." },
    });
    expect(insertUserMock).not.toHaveBeenCalled();
  });

  it("keeps the limit per IP, so another client can still sign up for the same email", async () => {
    insertUserMock.mockResolvedValue({ ok: true, id: 9 });

    for (let attempt = 0; attempt < SIGNUP_ATTEMPT_LIMIT; attempt += 1) {
      await POST(postJson(VALID_BODY));
    }

    const response = await POST(postJson(VALID_BODY, "203.0.113.50"));

    expect(response.status).toBe(201);
  });

  it("ignores client-supplied hops placed before the platform hop, so rotating them does not reset the limit", async () => {
    insertUserMock.mockResolvedValue({ ok: false, reason: "email_taken" });

    for (let attempt = 0; attempt < SIGNUP_ATTEMPT_LIMIT; attempt += 1) {
      await POST(postJson(VALID_BODY, `203.0.113.${attempt}, ${CLIENT_IP}`));
    }

    const response = await POST(postJson(VALID_BODY, `198.51.100.200, ${CLIENT_IP}`));

    expect(response.status).toBe(429);
  });

  it("answers 500 and stores nothing in production when the origin IP cannot be identified", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    insertUserMock.mockResolvedValue({ ok: true, id: 11 });

    const response = await POST(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.99" },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(response.status).toBe(500);
    expect(insertUserMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("answers 201 outside production without a proxy header, and does not share a limit bucket", async () => {
    insertUserMock.mockResolvedValue({ ok: true, id: 12 });

    for (let attempt = 0; attempt < SIGNUP_ATTEMPT_LIMIT + 1; attempt += 1) {
      const response = await POST(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...VALID_BODY, email: `pessoa${attempt}@exemplo.com.br` }),
        }),
      );
      expect(response.status).toBe(201);
    }
  });

  it("does not count requests with an invalid body toward the limit", async () => {
    insertUserMock.mockResolvedValue({ ok: true, id: 9 });

    for (let attempt = 0; attempt < SIGNUP_ATTEMPT_LIMIT + 5; attempt += 1) {
      await POST(postJson({ ...VALID_BODY, email: "sem-arroba" }));
    }

    const response = await POST(postJson(VALID_BODY));

    expect(response.status).toBe(201);
  });

  it("still allows the last attempt under the limit from the same IP when the email differs", async () => {
    insertUserMock.mockResolvedValue({ ok: false, reason: "email_taken" });

    for (let attempt = 0; attempt < SIGNUP_ATTEMPT_LIMIT - 1; attempt += 1) {
      await POST(postJson(VALID_BODY));
    }
    insertUserMock.mockResolvedValue({ ok: true, id: 10 });

    const response = await POST(
      postJson({ ...VALID_BODY, email: "outra@exemplo.com.br" }),
    );

    expect(response.status).toBe(201);
  });
});
