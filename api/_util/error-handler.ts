import { Middleware } from "koa";

export default function errorHandler(config: object = {}): Middleware {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      ctx.status = error.status || 500;
      if (typeof config[error.status] !== "undefined")
        ctx.body = config[error.status];
      ctx.app.emit("error", error, ctx);
    }
  };
}
