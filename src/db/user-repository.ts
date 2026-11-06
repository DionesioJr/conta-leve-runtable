import type { Pool, ResultSetHeader } from "mysql2/promise";

export type NewUser = {
  name: string;
  email: string;
  passwordHash: string;
};

export type InsertUserResult =
  | { ok: true; id: number }
  | { ok: false; reason: "email_taken" };

const DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";

function isDuplicateEntry(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_ENTRY_CODE
  );
}

export async function insertUser(
  database: Pick<Pool, "execute">,
  user: NewUser,
): Promise<InsertUserResult> {
  try {
    const [result] = await database.execute<ResultSetHeader>(
      "INSERT INTO `user` (`email`, `password_hash`, `name`) VALUES (?, ?, ?)",
      [user.email, user.passwordHash, user.name],
    );
    return { ok: true, id: result.insertId };
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return { ok: false, reason: "email_taken" };
    }
    throw error;
  }
}
