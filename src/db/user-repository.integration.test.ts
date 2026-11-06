import { readFileSync } from "node:fs";
import { createConnection, createPool, type Connection, type Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findUserByEmail } from "./user-repository";

const up = readFileSync(new URL("./migrations/0001_create_user.up.sql", import.meta.url), "utf8");

// Requer um MySQL acessível e um usuário com CREATE/DROP DATABASE.
// Sem TEST_DATABASE_URL o bloco é pulado localmente; no CI a ausência da URL falha o arquivo,
// para que a suíte não passe sem provar a busca de usuário por e-mail.
const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
if (process.env.CI && !databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL é obrigatória no CI: sem ela a busca de usuário por e-mail não é verificada.",
  );
}
const databaseName = `conta_leve_repo_${process.pid}_${Date.now()}`;
const EMAIL = "ana.repo@exemplo.com.br";
const PASSWORD_HASH = "scrypt$131072$8$1$c2FsdC1kZS10ZXN0ZQ==$a2V5LWRlLXRlc3Rl";

describe.skipIf(!databaseUrl)("findUserByEmail (MySQL real)", () => {
  let admin: Connection;
  let pool: Pool;
  let userId: string;

  beforeAll(async () => {
    admin = await createConnection(databaseUrl);
    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    await admin.query(`USE \`${databaseName}\``);
    await admin.query(up);

    const testUrl = new URL(databaseUrl);
    testUrl.pathname = `/${databaseName}`;
    pool = createPool({ uri: testUrl.toString(), supportBigNumbers: true, bigNumberStrings: true });

    const [result] = await admin.query(
      "INSERT INTO `user` (`email`, `password_hash`, `name`) VALUES (?, ?, ?)",
      [EMAIL, PASSWORD_HASH, "Ana"],
    );
    userId = String((result as { insertId: number }).insertId);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      await admin.end();
    }
  });

  it("returns the stored user, with the id as a string", async () => {
    await expect(findUserByEmail(EMAIL, pool)).resolves.toEqual({
      id: userId,
      email: EMAIL,
      name: "Ana",
      passwordHash: PASSWORD_HASH,
    });
  });

  it("finds the user when the e-mail differs only by case", async () => {
    await expect(findUserByEmail(EMAIL.toUpperCase(), pool)).resolves.toMatchObject({
      id: userId,
    });
  });

  it("returns null when no user has the e-mail", async () => {
    await expect(findUserByEmail("ninguem@exemplo.com.br", pool)).resolves.toBeNull();
  });

  it("treats SQL in the e-mail as plain text", async () => {
    await expect(findUserByEmail("' OR '1'='1", pool)).resolves.toBeNull();
  });
});
