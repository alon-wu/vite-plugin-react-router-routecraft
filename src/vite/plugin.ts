import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, sep } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { createDevtoolsSnapshot } from "../devtools/data.js";
import { createDevtoolsMiddleware } from "../devtools/middleware.js";
import { buildRouteTree } from "../core/route-tree.js";
import type { RoutecraftDiagnostic } from "../core/diagnostics.js";
import { compileRouteObjects } from "../core/compile-routes.js";
import { generateTypedRouter } from "../core/generate-types.js";
import { createHrefModuleSource } from "../core/route-paths.js";
import type { RoutecraftOptions } from "../types.js";
import { resolveRoutecraftOptions, type ResolvedRoutecraftOptions } from "./options.js";
import {
  DEVTOOLS_CLIENT_ID,
  HREF_MODULE_ID,
  PUBLIC_DEVTOOLS_CLIENT,
  PUBLIC_HREF_MODULE,
  PUBLIC_ROUTE_MODULE,
  ROUTE_MODULE_ID,
} from "./virtual-modules.js";

interface PluginSnapshot {
  routeCode: string | undefined;
  ir: ReturnType<typeof buildRouteTree> | undefined;
  diagnostics: RoutecraftDiagnostic[];
}

const initialSnapshot: PluginSnapshot = {
  routeCode: undefined,
  ir: undefined,
  diagnostics: [],
};

/** 创建 Routecraft Vite 插件实例。 */
export default function routecraft(options: RoutecraftOptions = {}): Plugin {
  let resolvedOptions: ResolvedRoutecraftOptions | undefined;
  let snapshot: PluginSnapshot = { ...initialSnapshot };
  let devServer: ViteDevServer | undefined;
  let revision = 0;

  const refresh = async (): Promise<PluginSnapshot> => {
    if (!resolvedOptions) {
      throw new Error("Routecraft 尚未读取 Vite 的项目根目录。");
    }

    const ir = buildRouteTree(resolvedOptions.routesDir, {
      defaultLazy: resolvedOptions.defaultLazy,
    });
    const errors = ir.diagnostics.filter((diagnostic) => diagnostic.level === "error");
    if (errors.length > 0) {
      snapshot = {
        routeCode: undefined,
        ir: undefined,
        diagnostics: ir.diagnostics,
      };
      return snapshot;
    }

    try {
      await writeIfChanged(
        resolvedOptions.typedRouterFile,
        generateTypedRouter(ir),
      );
    } catch (error) {
      const diagnostic: RoutecraftDiagnostic = {
        code: "RC_TYPES_WRITE",
        level: "error",
        message: `无法写入路由声明文件：${error instanceof Error ? error.message : String(error)}`,
        file: resolvedOptions.typedRouterFile,
      };
      snapshot = {
        routeCode: undefined,
        ir: undefined,
        diagnostics: [...ir.diagnostics, diagnostic],
      };
      return snapshot;
    }

    snapshot = {
      routeCode: compileRouteObjects(ir.root),
      ir,
      diagnostics: ir.diagnostics,
    };
    revision += 1;
    return snapshot;
  };

  return {
    name: "vite-plugin-react-router-routecraft",
    enforce: "pre",

    configResolved(config) {
      resolvedOptions = resolveRoutecraftOptions(config.root, options);
    },

    async buildStart() {
      const next = await refresh();
      const errors = next.diagnostics.filter((diagnostic) => diagnostic.level === "error");
      if (errors.length > 0) {
        this.error(formatDiagnostics(errors, resolvedOptions?.root));
      }
    },

    resolveId(id) {
      if (id === PUBLIC_ROUTE_MODULE) return ROUTE_MODULE_ID;
      if (id === PUBLIC_HREF_MODULE) return HREF_MODULE_ID;
      if (id === PUBLIC_DEVTOOLS_CLIENT && resolvedOptions?.devTools) {
        return DEVTOOLS_CLIENT_ID;
      }
      return null;
    },

    async load(id) {
      if (id === ROUTE_MODULE_ID) {
        if (!snapshot.ir || !snapshot.routeCode) {
          const errors = snapshot.diagnostics.filter((diagnostic) => diagnostic.level === "error");
          if (errors.length > 0) throw new Error(formatDiagnostics(errors, resolvedOptions?.root));
          const next = await refresh();
          if (!next.routeCode) {
            throw new Error(formatDiagnostics(next.diagnostics, resolvedOptions?.root));
          }
        }
        return snapshot.routeCode;
      }
      if (id === HREF_MODULE_ID) return createHrefModuleSource();
      if (id === DEVTOOLS_CLIENT_ID && resolvedOptions?.devTools) {
        return [
          "if (import.meta.hot) {",
          '  import.meta.hot.on("routecraft:update", () => window.dispatchEvent(new Event("routecraft:update")));',
          "}",
          "",
        ].join("\n");
      }
      return null;
    },

    configureServer(server) {
      if (!resolvedOptions) return;
      devServer = server;
      server.watcher.add(resolvedOptions.routesDir);
      if (resolvedOptions.devTools) {
        server.middlewares.use(
          createDevtoolsMiddleware(() =>
            createDevtoolsSnapshot(
              snapshot.ir,
              snapshot.diagnostics,
              resolvedOptions!.root,
              resolvedOptions!.routesDir,
              resolvedOptions!.typedRouterFile,
            ),
          (html) => server.transformIndexHtml("/__routecraft", html),
          ),
        );
      }

      void refresh().then((next) => {
        if (next.diagnostics.some((diagnostic) => diagnostic.level === "error")) {
          server.config.logger.error(formatDiagnostics(next.diagnostics, resolvedOptions?.root));
        }
      });

      const cleanup = (): void => {
        devServer = undefined;
      };
      server.httpServer?.once("close", cleanup);
    },

    async handleHotUpdate(context) {
      if (
        !resolvedOptions ||
        !isWithinDirectory(context.file, resolvedOptions.routesDir) ||
        context.file === resolvedOptions.typedRouterFile
      ) {
        return;
      }

      const next = await refresh();
      const server = context.server;
      const errors = next.diagnostics.filter((diagnostic) => diagnostic.level === "error");
      if (errors.length > 0) {
        server.config.logger.error(formatDiagnostics(errors, resolvedOptions.root));
      }
      const routeModule = server.moduleGraph.getModuleById(ROUTE_MODULE_ID);
      const hrefModule = server.moduleGraph.getModuleById(HREF_MODULE_ID);
      if (routeModule) server.moduleGraph.invalidateModule(routeModule);
      if (hrefModule) server.moduleGraph.invalidateModule(hrefModule);
      server.ws.send({
        type: "custom",
        event: "routecraft:update",
        data: { revision, status: errors.length === 0 ? "ready" : "error" },
      });
      if (errors.length === 0) server.ws.send({ type: "full-reload" });
      return [];
    },

    closeBundle() {
      devServer = undefined;
    },
  };
}

function isWithinDirectory(file: string, directory: string): boolean {
  const relativePath = relative(directory, file);
  return relativePath === "" || (!relativePath.startsWith(`..${sep}`) && relativePath !== "..");
}

async function writeIfChanged(filePath: string, contents: string): Promise<void> {
  let previous: string | undefined;
  try {
    previous = await readFile(filePath, "utf8");
  } catch {
    previous = undefined;
  }
  if (previous === contents) return;

  await mkdir(dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, contents, "utf8");
    await rename(temporaryFile, filePath);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
}

function formatDiagnostics(
  diagnostics: readonly RoutecraftDiagnostic[],
  root?: string,
): string {
  return diagnostics
    .map((diagnostic) => {
      const file =
        diagnostic.file && root
          ? relative(root, diagnostic.file).split(sep).join("/")
          : diagnostic.file;
      return [
        `[${diagnostic.code}] ${diagnostic.message}`,
        ...(file ? [`  文件：${file}`] : []),
        ...(diagnostic.suggestion ? [`  建议：${diagnostic.suggestion}`] : []),
      ].join("\n");
    })
    .join("\n");
}
