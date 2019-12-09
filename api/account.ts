import Koa from "koa";
import Router from "koa-router";
import bodyparser from "koa-bodyparser";
import crypto from "crypto";
import sql from "sql-template-strings";
import { InvalidCredentials, DuplicateEntry } from "./_util/errors";

import { query } from "./_util/db-driver";
import { setAuthorization, generateToken } from "./_util/authorization";
import { manglePassword, newSalt } from "./_util/password";
import errorHandler from "./_util/error-handler";
import validateFingerprint from "./_util/validate-fingerprint";
import validateToken from "./_util/validate-token";

type Credentials = { id: string; token: string; expiry: Date };

const app = new Koa();
const router = new Router({ prefix: "/account" });
router
  .use(bodyparser())
  .use(errorHandler([InvalidCredentials, 401], [DuplicateEntry, 409]))
  .use(validateFingerprint())
  .post("/", async (ctx, next) => {
    const { account_name: name, password } = ctx.request.body;
    const { fingerprint } = ctx.state;
    const account = await createAccount(name, password, fingerprint);
    setAuthorization(ctx, account.token);
    ctx.body = { id: account.id };
    return await next();
  })
  .post("/login", async (ctx, next) => {
    const { account_name: name, password } = ctx.request.body;
    const { fingerprint } = ctx.state;
    const account = await accountLogin(name, password, fingerprint);
    setAuthorization(ctx, account.token);
    ctx.body = { id: account.id };
    return await next();
  })
  .post("/logout", validateToken(), async (ctx, next) => {
    const { id, token, fingerprint } = ctx.state;
    await accountLogout(id, token, fingerprint);
    ctx.status = 204;
    return await next();
  })
  .get("/", validateToken(), async (ctx, next) => {
    const { account, token } = ctx.state;
    ctx.body = { account, token };
    return await next();
  });

app.use(router.routes()).use(router.allowedMethods());
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
    "accounts" ("id"             ,  "username", "hashed_password",  "salt")
    VALUES     (gen_random_uuid(), ${username}, ${hashedPassword}, ${salt})
    RETURNING "accounts"."id"
    ;
  `)
    .then(rows => rows[0].id)
    .catch(dbError => {
      if (dbError.detail && dbError.detail.includes("already exists"))
        throw DuplicateEntry();
      else throw dbError;
    });

  return await query<{ token: string; expiry: string }>(sql`
    INSERT INTO "authentication_tokens" as
    "tokens" ( "id",  "fingerprint",          "token"  , "expiry"                             )
    VALUES   (${id}, ${fingerprint}, ${generateToken()}, current_timestamp + interval '1 hour')
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
    if (rows.length === 0) throw InvalidCredentials();
    return rows[0];
  });

  /** @note remove old logins with same fingerprint */
  await query(sql`
    DELETE FROM "authentication_tokens"
    WHERE "fingerprint" = ${fingerprint}
    AND "id" = ${account.id};
  `);

  const hashedPassword = manglePassword(password, account.salt);
  if (account.hashed_password !== hashedPassword) throw InvalidCredentials();

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

async function accountLogout(id: string, token: string, fingerprint: string) {
  return await query(sql`
    DELETE FROM "authentication_tokens"
    WHERE id = ${id}
    AND token = ${token}
    AND fingerprint = ${fingerprint};
  `);
}
