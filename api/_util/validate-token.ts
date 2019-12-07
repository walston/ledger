import { Middleware } from "koa";
import sql from "sql-template-strings";
import { query } from "./db-driver";

const AUTHENTICATION_ERROR = Error("AUTHENTICATION ERROR");

export default function validateToken(): Middleware {
  return async (ctx, next) =>
    query<{ id: string }>(sql`
      SELECT "id"
      FROM "authentication_tokens"
      WHERE "fingerprint" = ${ctx.state.fingerprint}
      AND "token" = ${ctx.cookies.get("token")};
    `)
      .then(rows => rows[0].id)
      .then(id => {
        ctx.state.account = id;
        return next();
      })
      .catch(authError => {
        console.error(authError);
        ctx.throw(401, AUTHENTICATION_ERROR);
      });
}
