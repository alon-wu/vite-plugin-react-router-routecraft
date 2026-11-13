import type { MiddlewareFunction, RouteObject } from "react-router";

const middleware: MiddlewareFunction = async (_args, next) => next();

/** 由 TypeScript 检查插件目标 React Router 基线上的 RouteObject 结构。 */
export const routeObjectContract = [
  {
    id: "root",
    middleware: [middleware],
    HydrateFallback: () => null,
    children: [
      {
        id: "index",
        index: true,
        loader: async () => ({ ready: true }),
        lazy: {
          Component: async () => () => null,
          action: async () => async () => null,
          ErrorBoundary: async () => () => null,
          HydrateFallback: async () => () => null,
        },
      },
    ],
  },
] satisfies RouteObject[];
