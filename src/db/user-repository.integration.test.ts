import { readFileSync } from "node:fs";
import { createConnection, createPool, type Connection, type Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertUser } from "./user-repository";

const up = readFileSync(new URL("./migrations/0001_create_user.up.sql", import.meta.url), "utf8");

// Requer um MySQL acessível e um usuário com CREATE/DROP DATABASE.
// Sem TEST_DATABASE_URL o bloco é pulado localmente; no CI a ausência da URL falha o arquivo,
// para que a suíte não passe sem provar a gravação, a recusa de e-mail repetido e a busca por e-mail.
const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
if (process.env.CI && !databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL é obrigatória no CI: sem ela o cadastro e a busca de usuário no banco não são verificados.",
  );
}
const databaseName = `conta_leve_repo_${process.pid}_${Date.now()}`;

describe.skipIf(!databaseUrl)("user-repository (MySQL real)", () => {
  let connection: Connection;
  let pool: Pool;
  let findUserByEmail: typeof import("./user-repository").findUserByEmail;
  let previousDatabaseUrl: string | undefined;

  beforeAll(async () => {
    connection = await createConnection(databaseUrl);
    await connection.query(`CREATE DATABASE \`${databaseName}\``);
    await connection.query(`USE \`${databaseName}\``);
    await connection.query(up);
    pool = createPool({ uri: databaseUrl, database: databaseName });

    const url = new URL(databaseUrl);
    url.pathname = `/${databaseName}`;
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url.toString();
    ({ findUserByEmail } = await import("./user-repository"));
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
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

  it("stores the user and returns its id", async () => {
    const result = await insertUser(pool, {
      name: "Ana Souza",
      email: "ana.insercao@exemplo.com.br",
      passwordHash: "scrypt$131072$8$1$c2FsdA==$a2V5",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const [rows] = await connection.query(
      "SELECT `id`, `name`, `email`, `password_hash` FROM `user` WHERE `id` = ?",
      [result.id],
    );
    expect(rows).toEqual([
      {
        id: result.id,
        name: "Ana Souza",
        email: "ana.insercao@exemplo.com.br",
        password_hash: "scrypt$131072$8$1$c2FsdA==$a2V5",
      },
    ]);
  });

  it("reports email_taken when the email is already registered", async () => {
    const user = {
      name: "Bruno",
      email: "bruno.repetido@exemplo.com.br",
      passwordHash: "scrypt$131072$8$1$c2FsdA==$a2V5",
    };
    await expect(insertUser(pool, user)).resolves.toMatchObject({ ok: true });
    await expect(insertUser(pool, user)).resolves.toEqual({ ok: false, reason: "email_taken" });
  });

  it("reports email_taken when the email differs only by case", async () => {
    await insertUser(pool, {
      name: "Carla",
      email: "carla.caixa@exemplo.com.br",
      passwordHash: "scrypt$131072$8$1$c2FsdA==$a2V5",
    });
    await expect(
      insertUser(pool, {
        name: "Carla",
        email: "CARLA.CAIXA@exemplo.com.br",
        passwordHash: "scrypt$131072$8$1$c2FsdA==$a2V5",
      }),
    ).resolves.toEqual({ ok: false, reason: "email_taken" });
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
