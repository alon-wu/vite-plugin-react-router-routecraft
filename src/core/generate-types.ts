import type { RouteIR, RouteNode } from "./ir.js";

/** 根据同一份 Route IR 生成虚拟模块声明和类型化 href 契约。 */
export function generateTypedRouter(ir: RouteIR): string {
  const routePaths = collectPagePaths(ir.root);
  const routeIds = [...new Set(ir.routeIds)].sort();
  const paramEntries = routePaths
    .map((path) => `    ${JSON.stringify(path)}: ${formatParams(path)};`)
    .join("\n");

  return [
    "// Routecraft 自动生成的声明文件；请勿手工编辑。",
    'declare module "virtual:routecraft/routes" {',
    '  import type { RouteObject } from "react-router";',
    "",
    "  export const routeObjects: RouteObject[];",
    `  export type RouteId = ${union(routeIds)};`,
    `  export type RoutePath = ${union(routePaths)};`,
    "",
    "  type RouteParamMap = {",
    paramEntries,
    "  };",
    "  export type ParamsFor<P extends RoutePath> = RouteParamMap[P];",
    "}",
    "",
    'declare module "virtual:routecraft" {',
    '  import type { ParamsFor, RoutePath } from "virtual:routecraft/routes";',
    "",
    "  export function href<P extends RoutePath>(",
    "    path: P,",
    "    ...args: keyof ParamsFor<P> extends never ? [] : [params: ParamsFor<P>]",
    "  ): string;",
    "}",
    "",
  ].join("\n");
}

function collectPagePaths(root: RouteNode): string[] {
  const paths = new Set<string>();
  const visit = (node: RouteNode): void => {
    if (node.kind === "index") paths.add(node.routePath);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return [...paths].sort();
}

function formatParams(path: string): string {
  const parameters = path
    .split("/")
    .flatMap((part) => {
      if (part.startsWith(":")) return [part.slice(1)];
      if (part === "*") return ["*"];
      return [];
    });
  if (parameters.length === 0) return "{}";
  return `{ ${parameters
    .map((parameter) => `${JSON.stringify(parameter)}: string`)
    .join("; ")} }`;
}

function union(values: readonly string[]): string {
  return values.length === 0
    ? "never"
    : values.map((value) => JSON.stringify(value)).join(" | ");
}
