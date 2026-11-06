import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const up = readFileSync(new URL("./0001_create_user.up.sql", import.meta.url), "utf8");
const down = readFileSync(new URL("./0001_create_user.down.sql", import.meta.url), "utf8");

function columnLine(name: string): string | undefined {
  return up.split("\n").find((line) => line.trimStart().startsWith(`\`${name}\``));
}

describe("migration 0001_create_user (up)", () => {
  it("creates the user table", () => {
    expect(up).toMatch(/CREATE TABLE `user`/);
  });

  it.each(["email", "password_hash", "name", "created_at", "updated_at"])(
    "defines the %s column as NOT NULL",
    (column) => {
      const line = columnLine(column);
      expect(line).toBeDefined();
      expect(line).toMatch(/NOT NULL/);
    },
  );

  it("enforces a unique constraint on email in the database", () => {
    expect(up).toMatch(/UNIQUE KEY `user_email_unique` \(`email`\)/);
  });

  it("uses a uuid as the external identifier and keeps an internal primary key", () => {
    expect(columnLine("uuid")).toMatch(/NOT NULL/);
    expect(up).toMatch(/UNIQUE KEY `user_uuid_unique` \(`uuid`\)/);
    expect(up).toMatch(/PRIMARY KEY \(`id`\)/);
  });

  it("defaults both timestamps to the current time", () => {
    expect(columnLine("created_at")).toMatch(/DEFAULT CURRENT_TIMESTAMP\(3\)/);
    expect(columnLine("updated_at")).toMatch(/DEFAULT CURRENT_TIMESTAMP\(3\)/);
  });
});

describe("migration 0001_create_user (down)", () => {
  it("drops the user table it creates", () => {
    expect(down.trim()).toBe("DROP TABLE `user`;");
  });
});
