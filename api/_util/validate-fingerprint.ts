import { Middleware } from "koa";

export default function fingerprint(): Middleware {
  return async (ctx, next) => {
    if (!ctx.request.headers["x-fingerprint"]) return ctx.throw(400);

    ctx.state.fingerprint = ctx.request.headers["x-fingerprint"];
    return next();
  };
}
