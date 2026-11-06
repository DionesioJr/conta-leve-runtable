import { createPool, type Pool } from "mysql2/promise";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set.");
    }
    pool = createPool({
      uri: databaseUrl,
      supportBigNumbers: true,
      bigNumberStrings: true,
    });
  }
  return pool;
}
