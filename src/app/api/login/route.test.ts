import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { findUserByEmail } from "../../../db/user-repository";
import { hashPassword } from "../../../lib/password";
import { SESSION_COOKIE_NAME, readSessionToken } from "../../../lib/session";
import { POST } from "./route";

vi.mock("../../../db/user-repository", () => ({
  findUserByEmail: vi.fn(),
}));

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const PASSWORD = "senha-segura-123";
const EMAIL = "ana@exemplo.com.br";
const NOW_SECONDS = () => Math.floor(Date.now() / 1000);

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

function loginRequest(body: unknown): Request {
  return new Request("http://localhost/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function userFound() {
  vi.mocked(findUserByEmail).mockResolvedValue({
    id: "7",
    email: EMAIL,
    name: "Ana",
    passwordHash,
  });
}

describe("POST /api/login", () => {
  beforeEach(() => {
    vi.mocked(findUserByEmail).mockReset();
    process.env.SESSION_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  describe("with correct credentials", () => {
    it("answers 200 with the user and no password data", async () => {
      userFound();
      const response = await POST(loginRequest({ email: EMAIL, password: PASSWORD }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ user: { id: "7", email: EMAIL, name: "Ana" } });
      expect(JSON.stringify(body)).not.toContain(passwordHash);
    });

    it("sets a session cookie that is httpOnly, scoped to the site and lax", async () => {
      userFound();
      const response = await POST(loginRequest({ email: EMAIL, password: PASSWORD }));
      const setCookie = response.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(setCookie).toMatch(/;\s*HttpOnly/i);
      expect(setCookie).toMatch(/;\s*Path=\//i);
      expect(setCookie).toMatch(/;\s*SameSite=lax/i);
      expect(setCookie).toMatch(/;\s*Max-Age=\d+/i);
    });

    it("binds the cookie to the authenticated user", async () => {
      userFound();
      const response = await POST(loginRequest({ email: EMAIL, password: PASSWORD }));
      const setCookie = response.headers.get("set-cookie") ?? "";
      const token = setCookie.split(";")[0].slice(`${SESSION_COOKIE_NAME}=`.length);
      expect(readSessionToken(token, SECRET, NOW_SECONDS())).toMatchObject({ userId: "7" });
    });

    it("accepts an e-mail with spaces and upper-case letters", async () => {
      userFound();
      const response = await POST(loginRequest({ email: "  ANA@Exemplo.com.br ", password: PASSWORD }));
      expect(response.status).toBe(200);
      expect(findUserByEmail).toHaveBeenCalledWith("ana@exemplo.com.br");
    });
  });

  describe("with wrong credentials", () => {
    it("answers 401 for a wrong password, without a cookie", async () => {
      userFound();
      const response = await POST(loginRequest({ email: EMAIL, password: "outra-senha" }));
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("answers 401 with the same message for an unknown e-mail", async () => {
      vi.mocked(findUserByEmail).mockResolvedValue(null);
      const response = await POST(loginRequest({ email: "ninguem@exemplo.com.br", password: PASSWORD }));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "E-mail ou senha inválidos." });
      expect(response.headers.get("set-cookie")).toBeNull();
    });
  });

  describe("with invalid input", () => {
    it.each([
      ["missing password", { email: EMAIL }],
      ["missing e-mail", { password: PASSWORD }],
      ["empty e-mail", { email: "   ", password: PASSWORD }],
      ["empty password", { email: EMAIL, password: "" }],
      ["numeric e-mail", { email: 42, password: PASSWORD }],
      ["e-mail longer than 255 characters", { email: `${"a".repeat(256)}@x.com`, password: PASSWORD }],
      ["password longer than 1024 characters", { email: EMAIL, password: "a".repeat(1025) }],
      ["array body", ["ana", "senha"]],
      ["null body", null],
    ])("answers 400 for %s", async (_label, body) => {
      const response = await POST(loginRequest(body));
      expect(response.status).toBe(400);
      expect(findUserByEmail).not.toHaveBeenCalled();
    });

    it("answers 400 for a body that is not JSON", async () => {
      const response = await POST(loginRequest("{nao-e-json"));
      expect(response.status).toBe(400);
      expect(findUserByEmail).not.toHaveBeenCalled();
    });
  });

  describe("when the server cannot answer", () => {
    it("answers 500 when SESSION_SECRET is missing and does not touch the database", async () => {
      delete process.env.SESSION_SECRET;
      const response = await POST(loginRequest({ email: EMAIL, password: PASSWORD }));
      expect(response.status).toBe(500);
      expect(findUserByEmail).not.toHaveBeenCalled();
    });

    it("answers 500 when SESSION_SECRET is too short", async () => {
      process.env.SESSION_SECRET = "curto";
      const response = await POST(loginRequest({ email: EMAIL, password: PASSWORD }));
      expect(response.status).toBe(500);
      expect(findUserByEmail).not.toHaveBeenCalled();
    });

    it("answers 500 when the user lookup fails", async () => {
      vi.mocked(findUserByEmail).mockRejectedValue(new Error("connection refused"));
      const response = await POST(loginRequest({ email: EMAIL, password: PASSWORD }));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Não foi possível concluir o login." });
      expect(response.headers.get("set-cookie")).toBeNull();
    });
  });
});
