import { Middleware } from "koa";

type ErrorTuple = [Error, number];
export default function errorHandler(...errorTuples: ErrorTuple[]): Middleware {
  const config = new Map(errorTuples);
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      const status = config.get(error);
      ctx.status = status || 500;

      if (!status) ctx.app.emit("error", error, ctx);
    }
  };
}
