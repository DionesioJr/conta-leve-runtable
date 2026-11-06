import { readFileSync } from "node:fs";
import { createConnection, createPool, type Connection, type Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerSignupAttempt } from "./signup-attempt-repository";

const up = readFileSync(
  new URL("./migrations/0002_create_signup_attempt.up.sql", import.meta.url),
  "utf8",
);

// Requer um MySQL acessível e um usuário com CREATE/DROP DATABASE.
// Sem TEST_DATABASE_URL o bloco é pulado localmente; no CI a ausência da URL falha o arquivo,
// para que a suíte não passe sem provar a contagem de tentativas.
const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
if (process.env.CI && !databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL é obrigatória no CI: sem ela a limitação de tentativas de cadastro não é verificada.",
  );
}
const databaseName = `conta_leve_attempt_${process.pid}_${Date.now()}`;

describe.skipIf(!databaseUrl)("registerSignupAttempt (MySQL real)", () => {
  let connection: Connection;
  let pool: Pool;

  beforeAll(async () => {
    connection = await createConnection(databaseUrl);
    await connection.query(`CREATE DATABASE \`${databaseName}\``);
    await connection.query(`USE \`${databaseName}\``);
    await connection.query(up);
    pool = createPool({ uri: databaseUrl, database: databaseName });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
    if (connection) {
      await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      await connection.end();
    }
  });

  it("counts attempts for the same key and starts at 1", async () => {
    const key = { scope: "signup_ip", subjectHash: "a".repeat(64), windowStartMs: 1_000_000 };

    await expect(registerSignupAttempt(pool, key)).resolves.toBe(1);
    await expect(registerSignupAttempt(pool, key)).resolves.toBe(2);
    await expect(registerSignupAttempt(pool, key)).resolves.toBe(3);
  });

  it("keeps separate counters for different subjects, scopes and windows", async () => {
    const base = { scope: "signup_email", subjectHash: "b".repeat(64), windowStartMs: 2_000_000 };

    await registerSignupAttempt(pool, base);
    await expect(
      registerSignupAttempt(pool, { ...base, subjectHash: "c".repeat(64) }),
    ).resolves.toBe(1);
    await expect(registerSignupAttempt(pool, { ...base, scope: "signup_ip" })).resolves.toBe(1);
    await expect(registerSignupAttempt(pool, { ...base, windowStartMs: 3_000_000 })).resolves.toBe(
      1,
    );
    await expect(registerSignupAttempt(pool, base)).resolves.toBe(2);
  });
});
