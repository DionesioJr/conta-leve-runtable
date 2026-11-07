import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Pool, RowDataPacket } from "mysql2/promise";
import { Umzug, type UmzugStorage } from "umzug";

const MIGRATIONS_DIR = join(process.cwd(), "src", "db", "migrations");
const MIGRATIONS_TABLE = "schema_migrations";

function mysqlStorage(): UmzugStorage<Pool> {
  return {
    async executed({ context: pool }) {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
          \`name\` VARCHAR(255) NOT NULL,
          \`executed_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`name\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      );
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT \`name\` FROM \`${MIGRATIONS_TABLE}\` ORDER BY \`name\``,
      );
      return rows.map((row) => String(row.name));
    },
    async logMigration({ name, context: pool }) {
      await pool.execute(`INSERT INTO \`${MIGRATIONS_TABLE}\` (\`name\`) VALUES (?)`, [name]);
    },
    async unlogMigration({ name, context: pool }) {
      await pool.execute(`DELETE FROM \`${MIGRATIONS_TABLE}\` WHERE \`name\` = ?`, [name]);
    },
  };
}

export function createMigrator(pool: Pool): Umzug<Pool> {
  return new Umzug<Pool>({
    context: pool,
    storage: mysqlStorage(),
    logger: undefined,
    migrations: {
      glob: ["*.up.sql", { cwd: MIGRATIONS_DIR }],
      resolve: ({ name, context }) => {
        const migrationName = name.replace(/\.up\.sql$/, "");
        return {
          name: migrationName,
          up: async () => {
            await context.query(
              readFileSync(join(MIGRATIONS_DIR, `${migrationName}.up.sql`), "utf8"),
            );
          },
          down: async () => {
            await context.query(
              readFileSync(join(MIGRATIONS_DIR, `${migrationName}.down.sql`), "utf8"),
            );
          },
        };
      },
    },
  });
}
