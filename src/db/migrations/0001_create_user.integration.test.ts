import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const up = readFileSync(new URL("./0001_create_user.up.sql", import.meta.url), "utf8");
const down = readFileSync(new URL("./0001_create_user.down.sql", import.meta.url), "utf8");

// Requer um MySQL acessível e um usuário com CREATE/DROP DATABASE.
// Sem TEST_DATABASE_URL o bloco é pulado localmente; o critério só é verificado com ela definida.
// No CI (variável CI definida) a ausência da URL falha o arquivo, para que a suíte não passe sem provar a unicidade do e-mail.
const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
if (process.env.CI && !databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL é obrigatória no CI: sem ela o critério de unicidade do e-mail não é verificado.",
  );
}
const databaseName = `conta_leve_mig_${process.pid}_${Date.now()}`;

function uniqueEmail(): string {
  return `${randomUUID()}@exemplo.com.br`;
}

describe.skipIf(!databaseUrl)("migration 0001_create_user (MySQL real)", () => {
  let connection: Connection;

  async function insertUser(email: string | null, name: string | null = "Ana") {
    return connection.query(
      "INSERT INTO `user` (`uuid`, `email`, `password_hash`, `name`) VALUES (?, ?, ?, ?)",
      [randomUUID(), email, "$2b$10$hash-de-teste", name],
    );
  }

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

  it("creates the columns required by the acceptance criterion", async () => {
    const [rows] = await connection.query("SHOW COLUMNS FROM `user`");
    const names = (rows as Array<{ Field: string }>).map((row) => row.Field);
    expect(names).toEqual(
      expect.arrayContaining(["email", "password_hash", "name", "created_at", "updated_at"]),
    );
  });

  it("accepts users with distinct emails", async () => {
    await expect(insertUser(uniqueEmail())).resolves.toBeDefined();
    await expect(insertUser(uniqueEmail())).resolves.toBeDefined();
  });

  it("refuses a second user with the same email (ER_DUP_ENTRY)", async () => {
    const email = uniqueEmail();
    await insertUser(email);
    await expect(insertUser(email)).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });

  it("treats emails that differ only by case as the same email", async () => {
    const email = uniqueEmail();
    await insertUser(email.toLowerCase());
    await expect(insertUser(email.toUpperCase())).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });

  it("refuses a NULL email", async () => {
    await expect(insertUser(null)).rejects.toMatchObject({ code: "ER_BAD_NULL_ERROR" });
  });

  it("refuses a NULL name", async () => {
    await expect(insertUser(uniqueEmail(), null)).rejects.toMatchObject({
      code: "ER_BAD_NULL_ERROR",
    });
  });

  it("fills created_at and updated_at on insert", async () => {
    const email = uniqueEmail();
    await insertUser(email);
    const [rows] = await connection.query(
      "SELECT `created_at`, `updated_at` FROM `user` WHERE `email` = ?",
      [email],
    );
    const [row] = rows as Array<{ created_at: Date | null; updated_at: Date | null }>;
    expect(row.created_at).toBeInstanceOf(Date);
    expect(row.updated_at).toBeInstanceOf(Date);
  });

  it("down removes the user table", async () => {
    await connection.query(down);
    const [rows] = await connection.query("SHOW TABLES LIKE 'user'");
    expect(rows as unknown[]).toHaveLength(0);
  });
});
