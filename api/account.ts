import Koa from "koa";
import Router from "koa-router";
import bodyparser from "koa-bodyparser";
import sql from "sql-template-strings";

import { query } from "./_util/db-driver";
import { manglePassword, newSalt } from "./_util/password";

/** Known Errors */
const DUPLICATE_ENTRY = Error("DUPLICATE ENTRY ON INSERT");

/**
 * POST /account
 * X-FINGERPRINT='string'
 * {
 *   'account_name': string;
 *   'password': string;
 * }
 *
 * salt = crypto().salt()
 * hash(password, salt)
 * psql('insert into
 *    accounts (username, password, salt)
 *    values ($1, $2, $3)
 *    returning (id);
 * ', [account_name, password, salt])
 * psql('insert into
 *    authentication_tokens (id, fingerprint, token, expiry)
 *    values ($1, $2, $3, now() + 30min)
 *    returning (token, expiry);
 * ', [account_id, x_fingerprint, token])
 */

const app = new Koa();
const router = new Router();
router
  .use(bodyparser())
  .post("Create Account", "/account", async (ctx, next) => {
    const { account_name, password } = ctx.request.body;

    try {
      ctx.status = 200;
      ctx.body = { uuid: await createAccount(account_name, password) };
      return next();
    } catch (e) {
      if (e === DUPLICATE_ENTRY) {
        ctx.status = 409;
        return next();
      } else {
        console.error(e);
        ctx.status = 500;
        return next();
      }
    }
  })
  .put("Update Password", "/account", async (ctx, next) => {
    ctx.status = 430;
    ctx.body = "Operation Not Yet Supported";
    return next();
  })
  .delete("Remove Account", "/account", async (ctx, next) => {
    ctx.status = 430;
    ctx.body = "Operation Not Yet Supported";
    return next();
  });

app.use(router.routes()).use(router.allowedMethods());

export default app;

function createAccount(accountName: string, password: string): Promise<string> {
  accountName = String(accountName).toLocaleLowerCase();

  const salt = newSalt();
  const hashedPassword = manglePassword(password, salt);

  return query(sql`INSERT INTO "accounts"
    ("id", "username", "hashed_password", "salt")
    VALUES
    (gen_random_uuid(), ${accountName}, ${hashedPassword}, ${salt})
    RETURNING "accounts"."id";
  `)
    .then(rows => rows[0].id)
    .catch(err => {
      if (err.detail && err.detail.includes("already exists"))
        throw DUPLICATE_ENTRY;
    });
}
