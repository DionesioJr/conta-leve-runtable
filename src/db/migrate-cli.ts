import mysql from "mysql2/promise";

import { createMigrator } from "./migrate";

type Direction = "up" | "down";

function parseDirection(argument: string | undefined): Direction {
  if (argument === undefined || argument === "up") {
    return "up";
  }
  if (argument === "down") {
    return "down";
  }
  throw new Error(`Unknown migration direction "${argument}". Use "up" or "down".`);
}

async function main(): Promise<void> {
  const direction = parseDirection(process.argv[2]);
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = mysql.createPool({ uri: url, connectionLimit: 1 });
  try {
    const migrator = createMigrator(pool);
    const migrations =
      direction === "up" ? await migrator.up() : await migrator.down();
    const names = migrations.map((migration) => migration.name);
    console.log(
      names.length === 0
        ? "No migrations to run."
        : `${direction === "up" ? "Applied" : "Reverted"}: ${names.join(", ")}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
