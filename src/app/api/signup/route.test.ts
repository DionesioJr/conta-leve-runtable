import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertUser } from "../../../db/user-repository";
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

function postJson(body: unknown): Request {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  insertUserMock.mockReset();
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
});
