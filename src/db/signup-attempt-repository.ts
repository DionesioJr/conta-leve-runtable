import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type SignupAttemptKey = {
  scope: string;
  subjectHash: string;
  windowStartMs: number;
};

export async function registerSignupAttempt(
  database: Pick<Pool, "execute">,
  key: SignupAttemptKey,
): Promise<number> {
  await database.execute<ResultSetHeader>(
    "INSERT INTO `signup_attempt` (`scope`, `subject_hash`, `window_start_ms`, `attempts`) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE `attempts` = `attempts` + 1",
    [key.scope, key.subjectHash, key.windowStartMs],
  );
  const [rows] = await database.execute<RowDataPacket[]>(
    "SELECT `attempts` FROM `signup_attempt` WHERE `scope` = ? AND `subject_hash` = ? AND `window_start_ms` = ?",
    [key.scope, key.subjectHash, key.windowStartMs],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("signup_attempt sem linha após o upsert.");
  }
  return Number(row.attempts);
}
