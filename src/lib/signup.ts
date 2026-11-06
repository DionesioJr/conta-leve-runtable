import type { InsertUserResult, NewUser } from "../db/user-repository";
import { MESSAGES, validateSignup, type SignupErrors } from "./signup-validation";

export type CreatedUser = {
  id: number;
  name: string;
  email: string;
};

export type SignupDependencies = {
  hashPassword: (password: string) => Promise<string>;
  insertUser: (user: NewUser) => Promise<InsertUserResult>;
};

export type SignupOutcome =
  | { ok: true; user: CreatedUser }
  | { ok: false; errors: SignupErrors };

export async function signUp(
  body: unknown,
  dependencies: SignupDependencies,
): Promise<SignupOutcome> {
  const validation = validateSignup(body);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const { name, email, password } = validation.input;
  const passwordHash = await dependencies.hashPassword(password);
  const result = await dependencies.insertUser({ name, email, passwordHash });

  if (!result.ok) {
    return { ok: false, errors: { email: MESSAGES.emailTaken } };
  }

  return { ok: true, user: { id: result.id, name, email } };
}
