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
const INVALID_CREDENTIALS = Error("INVALID CREDENTIALS");
const DATABASE_DISCONNECT = Error("UNABLE TO CONNECT TO DATABASE");
const UKNOWN_ERROR = Error("UKNOWN ERROR");

type Credentials = { id: string; token: string; expiry: Date };

const app = new Koa();
const publicRouter = new Router();
publicRouter
  .use(bodyparser())
  .use(errorHandler())
  .use(validateFingerprint())
  .post("Create Account", "/account", async (ctx, next) => {
    const { account_name: name, password } = ctx.request.body;
    const { fingerprint } = ctx.state;

    try {
      const account = await createAccount(name, password, fingerprint);
      ctx.cookies.set("token", account.token, { expires: account.expiry });
      ctx.body = { id: account.id };
      return await next();
    } catch (e) {
      if (e === DUPLICATE_ENTRY) {
        return ctx.throw(409);
      } else {
        console.error(e);
        return ctx.throw();
      }
    }
  })
  .post("Login", "/account/login", async (ctx, next) => {
    const { account_name: name, password } = ctx.request.body;
    const { fingerprint } = ctx.state;

    try {
      const account = await accountLogin(name, password, fingerprint);
      ctx.cookies.set("token", account.token, { expires: account.expiry });
      ctx.body = { id: account.id };
      return await next();
    } catch (e) {
      if (e === INVALID_CREDENTIALS) {
        return ctx.throw(401);
      } else {
        console.error(e);
        return ctx.throw();
      }
    }
  });

app.use(publicRouter.routes()).use(publicRouter.allowedMethods());

export default app;

async function createAccount(
  username: string,
  password: string,
  fingerprint: string
): Promise<Credentials> {
  username = String(username).toLowerCase();

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

type AccountRow = {
  id: string;
  username: string;
  hashed_password: string;
  salt: string;
};
async function accountLogin(
  username: string,
  password: string,
  fingerprint: string
): Promise<Credentials> {
  username = String(username).toLowerCase();

  const account = await query<AccountRow>(sql`
    SELECT *
    FROM "accounts" as "a"
    WHERE "username" = ${username};
  `).then(rows => {
    if (rows.length === 0) throw INVALID_CREDENTIALS;
    return rows[0];
  });

  /** @note remove old logins with same fingerprint */
  await query(sql`
    DELETE FROM "authentication_tokens"
    WHERE "fingerprint" = ${fingerprint}
    AND "id" = ${account.id};
  `);

  const hashedPassword = manglePassword(password, account.salt);
  if (account.hashed_password !== hashedPassword) throw INVALID_CREDENTIALS;

  const token = crypto.randomBytes(192).toString("base64"); // 256 random chars
  return await query<{ token: string; expiry: string }>(sql`
    INSERT INTO "authentication_tokens" as
    "tokens" ( "id"        ,  "fingerprint",  "token", "expiry"                             )
    VALUES   (${account.id}, ${fingerprint}, ${token}, current_timestamp + interval '1 hour')
    RETURNING "tokens"."token", "tokens"."expiry";
  `).then(rows => ({
    id: account.id,
    token: rows[0].token,
    expiry: new Date(rows[0].expiry)
  }));
}
