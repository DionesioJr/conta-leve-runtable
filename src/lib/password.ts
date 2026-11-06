import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const ALGORITHM = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const COST = { N: 131072, r: 8, p: 1 } as const;
const MAX_MEMORY = 256 * 1024 * 1024;

type ScryptCost = { N: number; r: number; p: number };

type ParsedHash = { cost: ScryptCost; salt: Buffer; key: Buffer };

function deriveKey(password: string, salt: Buffer, cost: ScryptCost): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { ...cost, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

function isValidCost(cost: ScryptCost): boolean {
  return (
    Number.isSafeInteger(cost.N) &&
    cost.N > 1 &&
    (cost.N & (cost.N - 1)) === 0 &&
    Number.isSafeInteger(cost.r) &&
    cost.r > 0 &&
    Number.isSafeInteger(cost.p) &&
    cost.p > 0
  );
}

function parseHash(storedHash: string): ParsedHash | null {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== ALGORITHM) {
    return null;
  }
  const cost = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
  if (!isValidCost(cost)) {
    return null;
  }
  const salt = Buffer.from(parts[4], "base64");
  const key = Buffer.from(parts[5], "base64");
  if (salt.length !== SALT_LENGTH || key.length !== KEY_LENGTH) {
    return null;
  }
  return { cost, salt, key };
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length === 0) {
    throw new RangeError("Password must not be empty.");
  }
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, COST);
  return [
    ALGORITHM,
    COST.N,
    COST.r,
    COST.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseHash(storedHash);
  if (!parsed) {
    return false;
  }
  const key = await deriveKey(password, parsed.salt, parsed.cost);
  return timingSafeEqual(key, parsed.key);
}
