import { Middleware } from "koa";

const fingerprint: Middleware = async (ctx, next) => {
  if (!ctx.request.headers["x-fingerprint"]) return ctx.throw(400);

  ctx.state.fingerprint = ctx.request.headers["x-fingerprint"];
  return next();
};

export default fingerprint;
