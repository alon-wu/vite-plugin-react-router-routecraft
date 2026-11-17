import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readRouteConfig } from "./config.js";
import {
  errorDiagnostic,
  type RoutecraftDiagnostic,
} from "./diagnostics.js";
import { analyzeModuleExports } from "./exports.js";
import type {
  MiddlewareModuleRef,
  RouteIR,
  RouteModuleRef,
  RouteNode,
  RouteProperty,
} from "./ir.js";
import { normalizePathShape, toRoutePath } from "./segments.js";
import { scanRoutes, type RouteDirectory } from "./scanner.js";
import type { RouteLazyConfig } from "../types.js";

export interface RouteTreeOptions {
  defaultLazy: boolean;
}

/** 从扫描快照构建统一路由 IR，并校验模块契约与 URL 冲突。 */
export function buildRouteTree(
  routesDir: string,
  options: RouteTreeOptions,
): RouteIR {
  const scan = scanRoutes(routesDir);
  const diagnostics = [...scan.diagnostics];
  const routePaths: string[] = [];
  const routeIds: string[] = ["routecraft:root"];
  const pathOwners = new Map<string, { file: string; routePath: string }>();
  const root: RouteNode = {
    id: "routecraft:root",
    kind: "root",
    sourcePath: ".",
    routePath: "/",
    modules: {},
    children: [],
  };

  for (const directory of walkDirectories(scan)) {
    if (directory.files.handle && !directory.files.page) {
      diagnostics.push(
        errorDiagnostic(
          "RC_ORPHAN_ROUTE_HANDLE",
          "handle.ts/handle.tsx 需要同目录的 page.ts 或 page.tsx。",
          directory.files.handle,
        ),
      );
    }
    if (directory.files.notFoundHandle && directory.relativePath !== ".") {
      diagnostics.push(
        errorDiagnostic(
          "RC_NOT_FOUND_ROOT_ONLY",
          "not-found.handle.ts/not-found.handle.tsx 仅允许放在路由根目录。",
          directory.files.notFoundHandle,
        ),
      );
    }
    if (
      directory.files.config &&
      !directory.files.page &&
      !directory.files.layout &&
      !directory.files.layoutHandle &&
      !directory.files.error &&
      !directory.files.hydrateFallback &&
      !directory.files.notFound
    ) {
      diagnostics.push(
        errorDiagnostic(
          "RC_ORPHAN_ROUTE_CONFIG",
          "route.config.ts 必须与 page、layout、layout.handle、error、hydrate-fallback 或根 not-found 模块共置。",
          directory.files.config,
        ),
      );
    }
  }
  if (scan.files.notFoundHandle && !scan.files.notFound) {
    diagnostics.push(
      errorDiagnostic(
        "RC_ORPHAN_NOT_FOUND_HANDLE",
        "not-found.handle.ts/not-found.handle.tsx 需要同目录的 not-found.ts 或 not-found.tsx。",
        scan.files.notFoundHandle,
      ),
    );
  }

  applyDirectoryFiles(scan, root, [], diagnostics, options, routeIds, routePaths);
  root.children = [
    ...createPageChild(scan, root, [], diagnostics, options, routeIds, routePaths),
    ...scan.children.flatMap((directory) =>
      createDirectoryNode(
        directory,
        [],
        diagnostics,
        options,
        routeIds,
        routePaths,
      ),
    ),
    ...createNotFoundChild(scan, diagnostics, options, routeIds, routePaths),
  ];

  for (const node of collectAddressableNodes(root)) {
    const shapeParts = node.routePath.split("/").filter(Boolean);
    const shape = normalizePathShape(shapeParts);
    const absolutePath = node.routePath;
    const pageFile = node.modules.Component?.file ?? node.sourcePath;
    const previous = pathOwners.get(shape);
    if (previous) {
      diagnostics.push({
        code: "RC_ROUTE_CONFLICT",
        level: "error",
        message: `路由“${absolutePath}”与“${previous.routePath}”编译为相同路径形状。`,
        file: relative(routesDir, pageFile).split("\\").join("/"),
        routePath: absolutePath,
        suggestion: `检查 ${relative(routesDir, previous.file)} 与 ${relative(routesDir, pageFile)}，路由组名和参数名不会区分 URL。`,
      });
    } else {
      pathOwners.set(shape, {
        file: pageFile.startsWith(routesDir)
          ? relative(routesDir, pageFile).split("\\").join("/")
          : pageFile,
        routePath: absolutePath,
      });
    }

    if (node.kind !== "index") continue;
    const repeatedParams = getRepeatedParams(shapeParts);
    if (repeatedParams.length > 0) {
      diagnostics.push({
        code: "RC_DUPLICATE_PARAM",
        level: "error",
        message: `同一路径不能重复使用动态参数名：${repeatedParams.join(", ")}。`,
        file: typeof pageFile === "string" && pageFile.startsWith(routesDir)
          ? relative(routesDir, pageFile).split("\\").join("/")
          : String(pageFile),
        routePath: absolutePath,
      });
    }
  }

  return {
    root,
    routeIds: [...new Set(routeIds)],
    routePaths: [...new Set(routePaths)].sort(),
    diagnostics,
  };
}

function createDirectoryNode(
  directory: RouteDirectory,
  parentParts: string[],
  diagnostics: RoutecraftDiagnostic[],
  options: RouteTreeOptions,
  routeIds: string[],
  routePaths: string[],
): RouteNode[] {
  if (!directory.segment) return [];

  const segmentPath = directory.segment.path;
  const pathParts =
    segmentPath === null ? parentParts : [...parentParts, segmentPath];
  const id = routeId(directory.relativePath);
  const node: RouteNode = {
    id,
    kind: "segment",
    sourcePath: directory.relativePath,
    routePath: toRoutePath(pathParts),
    modules: {},
    children: [],
    ...(segmentPath === null ? {} : { path: segmentPath }),
  };
  routeIds.push(id);
  applyDirectoryFiles(directory, node, pathParts, diagnostics, options, routeIds, routePaths);

  node.children = [
    ...createPageChild(
      directory,
      node,
      pathParts,
      diagnostics,
      options,
      routeIds,
      routePaths,
    ),
    ...directory.children.flatMap((child) =>
      createDirectoryNode(
        child,
        pathParts,
        diagnostics,
        options,
        routeIds,
        routePaths,
      ),
    ),
    ...createNotFoundChild(directory, diagnostics, options, routeIds, routePaths),
  ];

  if (directory.files.notFound && directory.relativePath !== ".") {
    diagnostics.push(
      errorDiagnostic(
        "RC_NOT_FOUND_ROOT_ONLY",
        "not-found.tsx 仅允许放在路由根目录。",
        directory.files.notFound,
      ),
    );
  }
  return [node];
}

function createPageChild(
  directory: RouteDirectory,
  parent: RouteNode,
  pathParts: string[],
  diagnostics: RoutecraftDiagnostic[],
  options: RouteTreeOptions,
  routeIds: string[],
  routePaths: string[],
): RouteNode[] {
  const { page, loader, action } = directory.files;
  if ((loader || action) && !page) {
    diagnostics.push(
      errorDiagnostic(
        "RC_ORPHAN_DATA_MODULE",
        "loader.ts/action.ts 需要同目录的 page.ts 或 page.tsx。",
        loader ?? action,
      ),
    );
  }
  if (!page) return [];

  const id = parent.kind === "root" ? "routecraft:index" : `${parent.id}:index`;
  const pageNode: RouteNode = {
    id,
    kind: "index",
    sourcePath: directory.relativePath,
    routePath: toRoutePath(pathParts),
    index: true,
    modules: {},
    children: [],
  };
  routeIds.push(id);
  routePaths.push(pageNode.routePath);
  const config = readConfig(directory, diagnostics);
  addModule(pageNode, page, "default", "Component", config.lazy.page, options, diagnostics);
  if (directory.files.handle) {
    addModule(
      pageNode,
      directory.files.handle,
      "handle",
      "handle",
      config.lazy.handle,
      options,
      diagnostics,
    );
  }
  if (loader) {
    addModule(pageNode, loader, "loader", "loader", config.lazy.loader, options, diagnostics);
  }
  if (action) {
    addModule(pageNode, action, "action", "action", config.lazy.action, options, diagnostics);
  }
  return [pageNode];
}

function createNotFoundChild(
  directory: RouteDirectory,
  diagnostics: RoutecraftDiagnostic[],
  options: RouteTreeOptions,
  routeIds: string[],
  routePaths: string[],
): RouteNode[] {
  const file = directory.files.notFound;
  if (!file || directory.relativePath !== ".") return [];
  const id = "routecraft:not-found";
  const node: RouteNode = {
    id,
    kind: "not-found",
    sourcePath: ".",
    routePath: "/*",
    path: "*",
    modules: {},
    children: [],
  };
  routeIds.push(id);
  routePaths.push("/*");
  const config = readConfig(directory, diagnostics);
  addModule(node, file, "default", "Component", config.lazy.page, options, diagnostics);
  if (directory.files.notFoundHandle) {
    addModule(
      node,
      directory.files.notFoundHandle,
      "handle",
      "handle",
      config.lazy.notFoundHandle,
      options,
      diagnostics,
    );
  }
  return [node];
}

function applyDirectoryFiles(
  directory: RouteDirectory,
  node: RouteNode,
  _pathParts: string[],
  diagnostics: RoutecraftDiagnostic[],
  options: RouteTreeOptions,
  _routeIds: string[],
  _routePaths: string[],
): void {
  const config = readConfig(directory, diagnostics);
  const files = directory.files;

  if (files.layout) {
    addModule(node, files.layout, "default", "Component", config.lazy.layout, options, diagnostics);
  }
  if (files.layoutHandle) {
    addModule(
      node,
      files.layoutHandle,
      "handle",
      "handle",
      config.lazy.layoutHandle,
      options,
      diagnostics,
    );
  }
  if (files.error) {
    addModule(node, files.error, "default", "ErrorBoundary", config.lazy.error, options, diagnostics);
  }
  if (files.hydrateFallback) {
    addModule(
      node,
      files.hydrateFallback,
      "default",
      "HydrateFallback",
      config.lazy.hydrateFallback,
      options,
      diagnostics,
    );
  }
  if (files.layoutLoader || files.layoutAction) {
    if (!files.layout) {
      diagnostics.push(
        errorDiagnostic(
          "RC_ORPHAN_LAYOUT_DATA_MODULE",
          "layout.loader.ts/layout.action.ts 需要同目录的 layout.tsx 或 layout.ts。",
          files.layoutLoader ?? files.layoutAction,
        ),
      );
    }
  }
  if (files.layoutLoader) {
    addModule(
      node,
      files.layoutLoader,
      "loader",
      "loader",
      config.lazy.layoutLoader,
      options,
      diagnostics,
    );
  }
  if (files.layoutAction) {
    addModule(
      node,
      files.layoutAction,
      "action",
      "action",
      config.lazy.layoutAction,
      options,
      diagnostics,
    );
  }
  if (files.middleware) {
    addMiddleware(node, files.middleware, diagnostics);
  }
}

function addModule(
  node: RouteNode,
  file: string,
  exportName: string,
  property: RouteProperty,
  configuredLazy: boolean | undefined,
  options: RouteTreeOptions,
  diagnostics: RoutecraftDiagnostic[],
): void {
  const source = readFileSync(file, "utf8");
  diagnostics.push(...analyzeModuleExports(source, file, [exportName]));
  const lazy = configuredLazy ?? options.defaultLazy;
  const module: RouteModuleRef = { file, exportName, property, lazy };

  if (node.modules[property]) {
    diagnostics.push(
      errorDiagnostic(
        "RC_DUPLICATE_ROUTE_PROPERTY",
        `同一条路由不能重复设置 ${property} 属性。`,
        file,
      ),
    );
    return;
  }
  node.modules[property] = module;
}

function addMiddleware(
  node: RouteNode,
  file: string,
  diagnostics: RoutecraftDiagnostic[],
): void {
  diagnostics.push(...analyzeModuleExports(readFileSync(file, "utf8"), file, ["middleware"]));
  node.middleware = { file, exportName: "middleware" };
}

function readConfig(
  directory: RouteDirectory,
  diagnostics: RoutecraftDiagnostic[],
): { lazy: RouteLazyConfig } {
  const file = directory.files.config;
  if (!file) return { lazy: {} };
  const parsed = readRouteConfig(file);
  diagnostics.push(...parsed.diagnostics);
  return { lazy: parsed.lazy };
}

function routeId(relativePath: string): string {
  return `routecraft:${relativePath.split("/").filter(Boolean).join(":")}`;
}

function walkDirectories(root: RouteDirectory): RouteDirectory[] {
  return [root, ...root.children.flatMap(walkDirectories)];
}

function collectAddressableNodes(root: RouteNode): RouteNode[] {
  const nodes = [root.kind === "index" || root.kind === "not-found" ? root : undefined]
    .filter((node): node is RouteNode => node !== undefined);
  return [
    ...nodes,
    ...root.children.flatMap(collectAddressableNodes),
  ];
}

function getRepeatedParams(pathParts: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const part of pathParts) {
    if (!part.startsWith(":")) continue;
    const name = part.slice(1);
    if (seen.has(name)) repeated.add(name);
    seen.add(name);
  }
  return [...repeated];
}
