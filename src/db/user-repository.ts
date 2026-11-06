import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

import type { StoredUser } from "../lib/auth/login";

let pool: Pool | null = null;

function getPool(): Pool {
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
