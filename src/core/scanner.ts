import {
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  errorDiagnostic,
  type RoutecraftDiagnostic,
} from "./diagnostics.js";
import { parseDirectorySegment, type RouteSegment } from "./segments.js";

export type RouteFileKey =
  | "page"
  | "layout"
  | "error"
  | "notFound"
  | "hydrateFallback"
  | "loader"
  | "action"
  | "layoutLoader"
  | "layoutAction"
  | "middleware"
  | "config";

export interface RouteDirectory {
  name: string;
  absolutePath: string;
  relativePath: string;
  segment?: RouteSegment;
  files: Partial<Record<RouteFileKey, string>>;
  children: RouteDirectory[];
}

export interface ScanResult extends RouteDirectory {
  diagnostics: RoutecraftDiagnostic[];
}

const componentConventions: Record<string, RouteFileKey> = {
  page: "page",
  layout: "layout",
  error: "error",
  "not-found": "notFound",
  "hydrate-fallback": "hydrateFallback",
};

const typescriptConventions: Record<string, RouteFileKey> = {
  loader: "loader",
  action: "action",
  "layout.loader": "layoutLoader",
  "layout.action": "layoutAction",
  middleware: "middleware",
  "route.config": "config",
};

const unsupportedConventions = new Set([
  "loading",
  "template",
  "route",
  "default",
]);

/** 递归扫描路由根目录，只保留路由约定文件和含有路由后代的目录。 */
export function scanRoutes(routesDir: string): ScanResult {
  const rootPath = resolve(routesDir);
  const diagnostics: RoutecraftDiagnostic[] = [];

  const root: RouteDirectory = {
    name: "",
    absolutePath: rootPath,
    relativePath: ".",
    files: {},
    children: [],
  };

  if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
    diagnostics.push(
      errorDiagnostic(
        "RC_ROUTES_DIR_MISSING",
        `路由根目录不存在或不是目录：${rootPath}`,
        rootPath,
      ),
    );
    return { ...root, diagnostics };
  }

  root.children = scanChildren(rootPath, rootPath, diagnostics);
  root.files = scanFiles(rootPath, rootPath, diagnostics);
  return { ...root, diagnostics };
}

function scanChildren(
  directory: string,
  rootPath: string,
  diagnostics: RoutecraftDiagnostic[],
): RouteDirectory[] {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );
  const children: RouteDirectory[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) {
      continue;
    }

    const childPath = join(directory, entry.name);
    if (isUnsupportedRouteDirectory(entry.name)) {
      diagnostics.push({
        code: "RC_UNSUPPORTED_ROUTE_CONVENTION",
        level: "warning",
        message: `目录“${entry.name}”使用了 Routecraft 当前不支持的目录约定；该目录不会生成路由。`,
        file: relative(rootPath, childPath).split("\\").join("/"),
      });
      continue;
    }
    const files = scanFiles(childPath, rootPath, diagnostics);
    const descendants = scanChildren(childPath, rootPath, diagnostics);
    if (Object.keys(files).length === 0 && descendants.length === 0) continue;

    let segment: RouteSegment | undefined;
    try {
      segment = parseDirectorySegment(entry.name);
    } catch (error) {
      diagnostics.push(
        ...(error instanceof Error && "diagnostics" in error
          ? (error as { diagnostics: RoutecraftDiagnostic[] }).diagnostics
          : [
              errorDiagnostic(
                "RC_INVALID_SEGMENT",
                error instanceof Error ? error.message : String(error),
                relative(rootPath, childPath),
              ),
            ]),
      );
    }

    const routeDirectory: RouteDirectory = {
      name: entry.name,
      absolutePath: childPath,
      relativePath: relative(rootPath, childPath).split("\\").join("/"),
      files,
      children: descendants,
      ...(segment === undefined ? {} : { segment }),
    };

    if (segment?.kind === "splat" && descendants.length > 0) {
      diagnostics.push(
        errorDiagnostic(
          "RC_SPLAT_NOT_TERMINAL",
          `Catch-all 目录“${entry.name}”必须是路由路径的末尾段。`,
          routeDirectory.relativePath,
        ),
      );
    }
    children.push(routeDirectory);
  }

  return children;
}

function isUnsupportedRouteDirectory(name: string): boolean {
  return name.startsWith("@") || /^\(\.{1,3}\)/u.test(name);
}

function scanFiles(
  directory: string,
  rootPath: string,
  diagnostics: RoutecraftDiagnostic[],
): Partial<Record<RouteFileKey, string>> {
  const files: Partial<Record<RouteFileKey, string>> = {};
  const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name === "typed-router.d.ts" || entry.name.endsWith(".d.ts")) continue;

    const extension = entry.name.endsWith(".tsx") ? ".tsx" : entry.name.endsWith(".ts") ? ".ts" : "";
    if (!extension) {
      const baseName = entry.name.replace(/\.[^.]+$/u, "");
      if (unsupportedConventions.has(baseName)) {
        diagnostics.push({
          code: "RC_UNSUPPORTED_ROUTE_CONVENTION",
          level: "warning",
          message: `“${entry.name}”使用了 Routecraft 当前不支持的文件约定；该文件不会生成路由功能。`,
          file: relative(rootPath, join(directory, entry.name)).split("\\").join("/"),
        });
      }
      continue;
    }

    const stem = entry.name.slice(0, -extension.length);
    if (unsupportedConventions.has(stem)) {
      diagnostics.push({
        code: "RC_UNSUPPORTED_ROUTE_CONVENTION",
        level: "warning",
        message: `“${entry.name}”使用了 Routecraft 当前不支持的文件约定；该文件不会生成路由功能。`,
        file: relative(rootPath, join(directory, entry.name)).split("\\").join("/"),
      });
      continue;
    }
    const key = componentConventions[stem] ?? typescriptConventions[stem];
    if (!key) continue;

    if (key === "loader" || key === "action" || key === "layoutLoader" ||
        key === "layoutAction" || key === "middleware" || key === "config") {
      if (extension !== ".ts") continue;
    }

    if (files[key]) {
      diagnostics.push(
        errorDiagnostic(
          "RC_DUPLICATE_CONVENTION_FILE",
          `同一目录中不能同时存在多个“${stem}”约定文件：${files[key]}、${join(directory, entry.name)}`,
          relative(rootPath, directory).split("\\").join("/") || ".",
        ),
      );
      continue;
    }
    files[key] = join(directory, entry.name);
  }

  return files;
}
