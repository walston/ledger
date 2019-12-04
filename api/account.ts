import Koa from "koa";
import Router from "koa-router";
import bodyparser from "koa-bodyparser";
import sql from "sql-template-strings";

import { query } from "./_util/db-driver";
import { manglePassword, newSalt } from "./_util/password";

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

const DUPLICATE_ENTRY = Error("DUPLICATE ENTRY");

const app = new Koa();
const router = new Router();
router
  .use(bodyparser())
  .post("Create Account", "/account", async (ctx, next) => {
    const { account_name, password } = ctx.request.body;
    const salt = newSalt();
    const hashedPassword = manglePassword(password, salt);
    const accountName = String(account_name).toLocaleLowerCase();

    let uuid: any = "00000-00000-00000-00000-00000";
    try {
      await query(sql`INSERT INTO "accounts"
        ("id", "username", "hashed_password", "salt")
        VALUES
        (gen_random_uuid(), ${accountName}, ${hashedPassword}, ${salt})
        RETURNING "accounts"."id";
      `)
        .then(rows => {
          uuid = rows[0].id;
        })
        .catch(err => {
          if (err.detail && err.detail.includes("already exists"))
            throw DUPLICATE_ENTRY;
        });
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

    ctx.status = 200;
    ctx.body = { hashedPassword, accountName, salt, uuid };
    return next();
  });

app.use(router.routes()).use(router.allowedMethods());

export default app;
