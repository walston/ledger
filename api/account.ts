import Koa from "koa";
import Router from "koa-router";
import bodyparser from "koa-bodyparser";
import crypto from "crypto";
import sql from "sql-template-strings";

import { query } from "./_util/db-driver";
import { manglePassword, newSalt } from "./_util/password";
import errorHandler from "./_util/error-handler";
import validateFingerprint from "./_util/validate-fingerprint";

/** Known Errors */
const DUPLICATE_ENTRY = Error("DUPLICATE ENTRY ON INSERT");
const DATABASE_DISCONNECT = Error("UNABLE TO CONNECT TO DATABASE");
const UKNOWN_ERROR = Error("UKNOWN ERROR");

type AccountCreation = { id: string; token: string; expiry: Date };

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
  .use(errorHandler())
  .use(validateFingerprint)
  .post("Create Account", "/account", async (ctx, next) => {
    const { account_name, password } = ctx.request.body;

    try {
      ctx.status = 200;
      const account = await createAccount(
        account_name,
        password,
        ctx.request.header["x-fingerprint"]
      );
      ctx.cookies.set("token", account.token, { expires: account.expiry });
      ctx.body = { id: account.id };
      return next();
    } catch (e) {
      if (e === DUPLICATE_ENTRY) {
        return ctx.throw(409);
      } else {
        console.error(e);
        return ctx.throw();
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

async function createAccount(
  username: string,
  password: string,
  fingerprint: string
): Promise<AccountCreation> {
  username = String(username).toLocaleLowerCase();

  const salt = newSalt();
  const hashedPassword = manglePassword(password, salt);

  const id: string = await query<{ id: string }>(sql`
    INSERT INTO
    "accounts" ("id"             , "username"  , "hashed_password", "salt" )
    VALUES     (gen_random_uuid(), ${username} , ${hashedPassword}, ${salt})
    RETURNING "accounts"."id"
    ;
  `)
    .then(rows => rows[0].id)
    .catch(err => {
      if (err.detail && err.detail.includes("already exists"))
        throw DUPLICATE_ENTRY;
      else throw UKNOWN_ERROR;
    });

  const token = crypto.randomBytes(192).toString("base64"); // 256 random chars
  return await query<{ token: string; expiry: string }>(sql`
    INSERT INTO "authentication_tokens" as
    "tokens" ( "id",  "fingerprint",  "token", "expiry"                             )
    VALUES   (${id}, ${fingerprint}, ${token}, current_timestamp + interval '1 hour')
    RETURNING "tokens"."token", "tokens"."expiry";
  `).then(rows => ({
    id,
    token: rows[0].token,
    expiry: new Date(rows[0].expiry)
  }));
}
