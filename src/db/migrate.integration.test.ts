import mysql, { type Connection, type Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createMigrator } from "./migrate";

// Requer um MySQL acessível e um usuário com CREATE/DROP DATABASE.
// Sem TEST_DATABASE_URL o bloco é pulado localmente; no CI (variável CI definida) a ausência da URL falha o arquivo.
const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
if (process.env.CI && !databaseUrl) {
  throw new Error("TEST_DATABASE_URL é obrigatória no CI para verificar o runner de migrações.");
}
const databaseName = `conta_leve_runner_${process.pid}_${Date.now()}`;

describe.skipIf(!databaseUrl)("migration runner (MySQL real)", () => {
  let admin: Connection;
  let pool: Pool;

  async function tableExists(name: string): Promise<boolean> {
    const [rows] = await pool.query(`SHOW TABLES LIKE '${name}'`);
    return (rows as unknown[]).length > 0;
  }

  beforeAll(async () => {
    admin = await mysql.createConnection(databaseUrl);
    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    const url = new URL(databaseUrl);
    url.pathname = `/${databaseName}`;
    pool = mysql.createPool({ uri: url.toString(), connectionLimit: 1 });
  });

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      await admin.end();
    }
  });

  it("applies pending migrations and records them", async () => {
    const applied = await createMigrator(pool).up();
    expect(applied.map((migration) => migration.name)).toEqual(["0001_create_user"]);
    expect(await tableExists("user")).toBe(true);
    const [rows] = await pool.query("SELECT `name` FROM `schema_migrations`");
    expect(rows).toEqual([{ name: "0001_create_user" }]);
  });

  it("does nothing when every migration is already applied", async () => {
    const applied = await createMigrator(pool).up();
    expect(applied).toEqual([]);
  });

  it("reverts the last migration and removes its record", async () => {
    const reverted = await createMigrator(pool).down();
    expect(reverted.map((migration) => migration.name)).toEqual(["0001_create_user"]);
    expect(await tableExists("user")).toBe(false);
    const [rows] = await pool.query("SELECT `name` FROM `schema_migrations`");
    expect(rows).toEqual([]);
  });

  it("applies again after a revert", async () => {
    const applied = await createMigrator(pool).up();
    expect(applied.map((migration) => migration.name)).toEqual(["0001_create_user"]);
    expect(await tableExists("user")).toBe(true);
  });
});
