import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

import type { StoredUser } from "../lib/auth/login";

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

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = mysql.createPool({ uri: url, connectionLimit: 5 });
  }
  return pool;
}

export async function findUserByEmail(
  email: string,
): Promise<StoredUser | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, password_hash FROM `user` WHERE email = ? LIMIT 1",
    [email],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return { id: Number(row.id), passwordHash: String(row.password_hash) };
}
