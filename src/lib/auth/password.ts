import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCHEME = "scrypt";
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const HEX_PATTERN = /^[0-9a-f]+$/;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_BYTES, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);
  return `${SCHEME}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== SCHEME) {
    return false;
  }
  const [, saltHex, keyHex] = parts;
  if (
    !HEX_PATTERN.test(saltHex) ||
    !HEX_PATTERN.test(keyHex) ||
    saltHex.length % 2 !== 0 ||
    keyHex.length !== KEY_BYTES * 2
  ) {
    return false;
  }
  const expected = Buffer.from(keyHex, "hex");
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}
