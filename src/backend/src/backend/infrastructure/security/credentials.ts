import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function token() { return randomBytes(32).toString("hex"); }
export function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(value, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex")}`;
}
export function verifyPassword(value: string, encoded: string) {
  const [algorithm, salt, stored] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !stored) return false;
  const actual = scryptSync(value, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(stored, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
