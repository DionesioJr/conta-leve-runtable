import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const up = readFileSync(new URL("./0002_create_signup_attempt.up.sql", import.meta.url), "utf8");
const down = readFileSync(new URL("./0002_create_signup_attempt.down.sql", import.meta.url), "utf8");

describe("migration 0002_create_signup_attempt (up)", () => {
  it("creates the signup_attempt table", () => {
    expect(up).toMatch(/CREATE TABLE `signup_attempt`/);
  });

  it("keys each counter by scope, hashed subject and window", () => {
    expect(up).toMatch(/PRIMARY KEY \(`scope`, `subject_hash`, `window_start_ms`\)/);
  });

  it("stores the subject as a fixed-size hash, never the raw value", () => {
    expect(up).toMatch(/`subject_hash` CHAR\(64\) NOT NULL/);
  });

  it("starts the attempt counter at zero by default", () => {
    expect(up).toMatch(/`attempts` INT UNSIGNED NOT NULL DEFAULT 0/);
  });
});

describe("migration 0002_create_signup_attempt (down)", () => {
  it("drops the signup_attempt table it creates", () => {
    expect(down.trim()).toBe("DROP TABLE `signup_attempt`;");
  });
});
