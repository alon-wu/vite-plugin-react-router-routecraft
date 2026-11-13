import type { MiddlewareFunction } from "react-router";

/** 示例全局 middleware：演示作用范围，不承担真实鉴权职责。 */
export const middleware: MiddlewareFunction = async (_args, next) => {
  return next();
};
