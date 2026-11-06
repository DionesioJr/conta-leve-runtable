import type { UserRecord } from "../db/user-repository";
import { hashPassword, verifyPassword } from "./password";

export type Credentials = {
  email: string;
  password: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
};

export type UserFinder = (email: string) => Promise<UserRecord | null>;

let placeholderHash: Promise<string> | undefined;

function getPlaceholderHash(): Promise<string> {
  placeholderHash ??= hashPassword("placeholder-that-no-one-types");
  return placeholderHash;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function authenticateUser(
  credentials: Credentials,
  findUser: UserFinder,
): Promise<AuthenticatedUser | null> {
  const user = await findUser(normalizeEmail(credentials.email));
  if (!user) {
    await verifyPassword(credentials.password, await getPlaceholderHash());
    return null;
  }
  const matches = await verifyPassword(credentials.password, user.passwordHash);
  if (!matches) {
    return null;
  }
  return { id: user.id, email: user.email, name: user.name };
}
