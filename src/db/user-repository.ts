import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "./connection";

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
};

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  name: string;
  password_hash: string;
};

export async function findUserByEmail(
  email: string,
  pool: Pool = getPool(),
): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRow[]>(
    "SELECT `id`, `email`, `name`, `password_hash` FROM `user` WHERE `email` = ? LIMIT 1",
    [email],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
  };
}
