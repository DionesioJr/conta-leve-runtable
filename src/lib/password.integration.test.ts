import { readFileSync } from "node:fs";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

const up = readFileSync(
  new URL("../db/migrations/0001_create_user.up.sql", import.meta.url),
  "utf8",
);

// Requer um MySQL acessível e um usuário com CREATE/DROP DATABASE.
// Sem TEST_DATABASE_URL o bloco é pulado localmente; no CI a ausência da URL falha o arquivo,
// para que a suíte não passe sem provar que a senha não fica legível no banco.
const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
if (process.env.CI && !databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL é obrigatória no CI: sem ela o critério de senha não recuperável no banco não é verificado.",
  );
}
const databaseName = `conta_leve_pwd_${process.pid}_${Date.now()}`;
const PASSWORD = "senha-segura-123";

describe.skipIf(!databaseUrl)("password_hash gravado no banco (MySQL real)", () => {
  let connection: Connection;

  beforeAll(async () => {
    connection = await createConnection(databaseUrl);
    await connection.query(`CREATE DATABASE \`${databaseName}\``);
    await connection.query(`USE \`${databaseName}\``);
    await connection.query(up);
  });

  afterAll(async () => {
    if (connection) {
      await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      await connection.end();
    }
  });

  async function saveAndReadPasswordHash(password: string, email: string): Promise<string> {
    const hash = await hashPassword(password);
    await connection.query(
      "INSERT INTO `user` (`email`, `password_hash`, `name`) VALUES (?, ?, ?)",
      [email, hash, "Ana"],
    );
    const [rows] = await connection.query(
      "SELECT `password_hash` FROM `user` WHERE `email` = ?",
      [email],
    );
    const [row] = rows as Array<{ password_hash: string }>;
    return row.password_hash;
  }

  it("does not store the original password in password_hash", async () => {
    const stored = await saveAndReadPasswordHash(PASSWORD, "hash.texto@exemplo.com.br");
    expect(stored).not.toBe(PASSWORD);
    expect(stored).not.toContain(PASSWORD);
  });

  it("stores a value that verifies only against the original password", async () => {
    const stored = await saveAndReadPasswordHash(PASSWORD, "hash.verifica@exemplo.com.br");
    await expect(verifyPassword(PASSWORD, stored)).resolves.toBe(true);
    await expect(verifyPassword("outra-senha-456", stored)).resolves.toBe(false);
  });
});
