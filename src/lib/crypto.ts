import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/** Hash a 4-digit access code for storage. Never store or log the raw code. */
export async function hashAccessCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

export async function verifyAccessCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/** A dummy hash used to keep login timing constant when a member is not found. */
export const DUMMY_CODE_HASH = bcrypt.hashSync("0000", BCRYPT_ROUNDS);

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Generates a cryptographically random opaque session token. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** We store only a SHA-256 hash of the session token in the database. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const CODE_PATTERN = /^\d{4}$/;

export function isValidAccessCodeFormat(code: string): boolean {
  return CODE_PATTERN.test(code);
}
