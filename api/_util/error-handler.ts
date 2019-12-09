import { Middleware } from "koa";

type ErrorTuple<T = ErrorConstructor> = [T, number];
export default function errorHandler(...errorTuples: ErrorTuple[]): Middleware {
  const tuples = errorTuples.map(([constructor, code]) => {
    return [constructor, code] as [ErrorConstructor, number];
  });
  const config = new Map(tuples);
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      const status = config.get(error.constructor);

      ctx.status = status || 500;
      if (!status) ctx.app.emit("error", error, ctx);
    }
  };
}
