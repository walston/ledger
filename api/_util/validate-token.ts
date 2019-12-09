import { Middleware } from "koa";
import sql from "sql-template-strings";
import { query } from "./db-driver";
import { getAuthorization } from "./authorization";
import { InvalidCredentials } from "./errors";

export default function validateToken(): Middleware {
  return async (ctx, next) => {
    const fingerprint = ctx.state.fingerprint;
    const token = getAuthorization(ctx);
    if (!token || !fingerprint) throw InvalidCredentials();
    await query<{ id: string; token: string }>(sql`
      SELECT "id", "token"
      FROM "authentication_tokens"
      WHERE "fingerprint" = ${fingerprint}
      AND "token" = ${token}
      AND "expiry" > now()
      LIMIT 1;
    `)
      .then(rows => {
        if (rows.length === 0) throw InvalidCredentials();
        return rows[0];
      })
      .then(account => {
        ctx.state.account = account.id;
        ctx.state.token = account.token;
      });
    /** @fixme throw AuthenticationError is not captured by the error handler */
    return await next();
  };
}
