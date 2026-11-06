import { verifyPassword } from "../password";
import { createSessionToken } from "./session";

export type LoginInput = { email: string; password: string };

export type StoredUser = { id: number; passwordHash: string };

export type LoginDeps = {
  findUserByEmail: (email: string) => Promise<StoredUser | null>;
  now: () => number;
  secret: string;
};

export type LoginResult =
  | { status: 204; token: string }
  | { status: 401 };

const MAX_EMAIL_LENGTH = 255;
const MAX_PASSWORD_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hash no formato de src/lib/password.ts (scrypt$N$r$p$salt$key, base64) com o mesmo custo de
// hashPassword, para que e-mail inexistente gaste o mesmo tempo de verificação.
const DUMMY_HASH = [
  "scrypt",
  131072,
  8,
  1,
  Buffer.alloc(16).toString("base64"),
  Buffer.alloc(64).toString("base64"),
].join("$");

export function parseLoginInput(body: unknown): LoginInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedEmail.length === 0 ||
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    return null;
  }
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return null;
  }
  return { email: normalizedEmail, password };
}

export async function login(
  body: unknown,
  deps: LoginDeps,
): Promise<LoginResult> {
  const input = parseLoginInput(body);
  if (!input) {
    return { status: 401 };
  }
  const user = await deps.findUserByEmail(input.email);
  const valid = await verifyPassword(
    input.password,
    user ? user.passwordHash : DUMMY_HASH,
  );
  if (!user || !valid) {
    return { status: 401 };
  }
  return {
    status: 204,
    token: createSessionToken(user.id, deps.now(), deps.secret),
  };
}
