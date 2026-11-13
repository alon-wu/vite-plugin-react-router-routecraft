import { isAbsolute, relative, resolve } from "node:path";
import type { RoutecraftDiagnostic } from "../core/diagnostics.js";
import type { RouteIR, RouteNode, RouteProperty } from "../core/ir.js";

export interface DevtoolsRoute {
  id: string;
  kind: RouteNode["kind"];
  path: string;
  source: string;
  modules: Partial<Record<RouteProperty, { file: string; loading: "eager" | "lazy" }>>;
  middleware?: string;
  children: DevtoolsRoute[];
}

export interface DevtoolsSnapshot {
  status: "ready" | "error";
  routeCount: number;
  typesFile: string;
  routes: DevtoolsRoute[];
  diagnostics: Array<{
    code: string;
    level: string;
    message: string;
    file?: string;
    routePath?: string;
    suggestion?: string;
  }>;
}

/** 生成不包含源代码和绝对磁盘路径的 DevTools 只读数据快照。 */
export function createDevtoolsSnapshot(
  ir: RouteIR | undefined,
  diagnostics: readonly RoutecraftDiagnostic[],
  projectRoot: string,
  routesDir: string,
  typesFile: string,
): DevtoolsSnapshot {
  const routes = ir ? [serializeRoute(ir.root, routesDir)] : [];
  return {
    status: diagnostics.some((item) => item.level === "error") ? "error" : "ready",
    routeCount: ir?.routeIds.length ?? 0,
    typesFile: relative(projectRoot, typesFile).split("\\").join("/"),
    routes,
    diagnostics: diagnostics.map((item) => ({
      code: item.code,
      level: item.level,
      message: item.message,
      ...(item.file === undefined ? {} : { file: displayDiagnosticPath(item.file, projectRoot, routesDir) }),
      ...(item.routePath === undefined ? {} : { routePath: item.routePath }),
      ...(item.suggestion === undefined ? {} : { suggestion: item.suggestion }),
    })),
  };
}

function serializeRoute(node: RouteNode, routesDir: string): DevtoolsRoute {
  const modules: DevtoolsRoute["modules"] = {};
  for (const [property, module] of Object.entries(node.modules)) {
    if (!module) continue;
    modules[property as RouteProperty] = {
      file: displayPath(module.file, routesDir, routesDir),
      loading: module.lazy ? "lazy" : "eager",
    };
  }

  return {
    id: node.id,
    kind: node.kind,
    path: node.routePath,
    source: node.sourcePath,
    modules,
    ...(node.middleware
      ? { middleware: displayPath(node.middleware.file, routesDir, routesDir) }
      : {}),
    children: node.children.map((child) => serializeRoute(child, routesDir)),
  };
}

function displayPath(file: string, base: string, fallbackBase: string): string {
  const resolvedFile = isAbsolute(file) ? file : resolve(base, file);
  const path = relative(base, resolvedFile).split("\\").join("/");
  if (path === "" || (!path.startsWith("../") && path !== "..")) return path || ".";
  return relative(fallbackBase, resolvedFile).split("\\").join("/");
}

function displayDiagnosticPath(file: string, projectRoot: string, routesDir: string): string {
  const resolvedFile = isAbsolute(file) ? file : resolve(routesDir, file);
  const relativeToRoutes = relative(routesDir, resolvedFile).split("\\").join("/");
  if (relativeToRoutes === "" || (!relativeToRoutes.startsWith("../") && relativeToRoutes !== "..")) {
    return relativeToRoutes || ".";
  }
  return relative(projectRoot, resolvedFile).split("\\").join("/");
}
