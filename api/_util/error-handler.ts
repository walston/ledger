import { Middleware } from "koa";

type ErrorNumConfig = { [key: number]: string };
export default function errorHandler(config: ErrorNumConfig = {}): Middleware {
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
