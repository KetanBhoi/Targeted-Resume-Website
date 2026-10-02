import { createHash, randomBytes } from "node:crypto";

export function createApplicationShareToken(): string {
  let token = "";
  do {
    token = randomBytes(32).toString("base64url");
  } while (!isApplicationShareToken(token));
  return token;
}

export function hashApplicationShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isApplicationShareToken(value: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  const characterClasses = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[_-]/.test(value),
  ].filter(Boolean).length;
  return decoded.length === 32 &&
    decoded.toString("base64url") === value &&
    new Set(value).size >= 20 &&
    characterClasses >= 3;
}

export function isApplicationShareUnavailable(
  expiresAt: Date,
  revokedAt: Date | null,
  now: number,
): boolean {
  return revokedAt !== null || expiresAt.getTime() <= now;
}