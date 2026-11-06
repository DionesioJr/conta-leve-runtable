import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const SCHEME = "scrypt";
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const HEX_PATTERN = /^[0-9a-f]+$/;

// Parâmetros fixados explicitamente. Valem os mesmos defaults do Node (N=16384, r=8, p=1),
// que são os usados pelo password.ts da CLV-93: mudar qualquer um invalida os hashes gravados.
export const SCRYPT_PARAMS: Readonly<Pick<ScryptOptions, "N" | "r" | "p">> = {
  N: 16384,
  r: 8,
  p: 1,
};

const DUMMY_SALT = Buffer.alloc(SALT_BYTES);

export function deriveKey(
  password: string,
  salt: Buffer,
  keyBytes: number = KEY_BYTES,
  params: ScryptOptions = SCRYPT_PARAMS,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyBytes, params, (error, key) => {
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
  const [scheme, saltHex, keyHex] = parts;
  const wellFormed =
    parts.length === 3 &&
    scheme === SCHEME &&
    HEX_PATTERN.test(saltHex) &&
    HEX_PATTERN.test(keyHex) &&
    saltHex.length === SALT_BYTES * 2 &&
    keyHex.length === KEY_BYTES * 2;
  if (!wellFormed) {
    // Faz o mesmo custo de scrypt para não vazar por tempo que o hash é malformado.
    await deriveKey(password, DUMMY_SALT);
    return false;
  }
  const expected = Buffer.from(keyHex, "hex");
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}
