import crypto, { BinaryLike } from "crypto";

export function manglePassword(password: string, salt: BinaryLike): string {
  return crypto
    .createHmac("sha256", salt)
    .update(password)
    .digest("hex");
}

export function newSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}
