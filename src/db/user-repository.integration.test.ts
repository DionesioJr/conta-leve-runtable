import { readFileSync } from "node:fs";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const up = readFileSync(new URL("./migrations/0001_create_user.up.sql", import.meta.url), "utf8");

// Requer um MySQL acessível e um usuário com CREATE/DROP DATABASE.
// Sem TEST_DATABASE_URL o bloco é pulado localmente; no CI a ausência falha o arquivo.
const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
if (process.env.CI && !databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL é obrigatória no CI: sem ela findUserByEmail não é verificado contra o banco.",
  );
}
const databaseName = `conta_leve_repo_${process.pid}_${Date.now()}`;

describe.skipIf(!databaseUrl)("findUserByEmail (MySQL real)", () => {
  let connection: Connection;
  let findUserByEmail: typeof import("./user-repository").findUserByEmail;
  let previousDatabaseUrl: string | undefined;

  beforeAll(async () => {
    connection = await createConnection(databaseUrl);
    await connection.query(`CREATE DATABASE \`${databaseName}\``);
    await connection.query(`USE \`${databaseName}\``);
    await connection.query(up);

    const url = new URL(databaseUrl);
    url.pathname = `/${databaseName}`;
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url.toString();
    ({ findUserByEmail } = await import("./user-repository"));
  });

  afterAll(async () => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    if (connection) {
      await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      await connection.end();
    }
  });

  it("returns id and passwordHash mapped for an existing email", async () => {
    const [result] = await connection.query(
      "INSERT INTO `user` (`email`, `password_hash`, `name`) VALUES (?, ?, ?)",
      ["ana@exemplo.com.br", "hash-da-ana", "Ana"],
    );
    const insertId = (result as { insertId: number }).insertId;

    const user = await findUserByEmail("ana@exemplo.com.br");

    expect(user).toEqual({ id: insertId, passwordHash: "hash-da-ana" });
    expect(typeof user?.id).toBe("number");
  });

  it("finds the user regardless of email letter case", async () => {
    await connection.query(
      "INSERT INTO `user` (`email`, `password_hash`, `name`) VALUES (?, ?, ?)",
      ["bia@exemplo.com.br", "hash-da-bia", "Bia"],
    );

    await expect(findUserByEmail("BIA@Exemplo.com.br")).resolves.toMatchObject({
      passwordHash: "hash-da-bia",
    });
  });

  it("returns null when the email does not exist", async () => {
    await expect(findUserByEmail("ninguem@exemplo.com.br")).resolves.toBeNull();
  });
});
