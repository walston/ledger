import { Context } from "koa";
import { randomBytes } from "crypto";
import { InvalidCredentials } from "./errors";

export function generateToken(): string {
  return randomBytes(192).toString("base64"); // 256 random chars
}

export function setAuthorization(
  ctx: Context,
  token: string,
  expires?: Date
): void {
  ctx.cookies.set("authorization", token, expires ? { expires } : undefined);
}

export function getAuthorization(ctx: Context): string {
  const authorization = ctx.cookies.get("authorization");
  if (!authorization) throw new InvalidCredentials();
  return authorization;
}
