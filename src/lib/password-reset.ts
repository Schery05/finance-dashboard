import { createHash, randomInt } from "crypto";

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 5;

export function createPasswordResetToken() {
  return String(randomInt(100000, 1000000));
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256")
    .update(String(token ?? "").trim())
    .digest("hex");
}

export function getPasswordResetExpiry() {
  return new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}
