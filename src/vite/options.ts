import { isAbsolute, resolve } from "node:path";
import type { RoutecraftOptions } from "../types.js";

export interface ResolvedRoutecraftOptions {
  root: string;
  routesDir: string;
  typesDir: string;
  typedRouterFile: string;
  defaultLazy: boolean;
  devTools: boolean;
}

/** 基于 Vite 根目录归一化插件选项。 */
export function resolveRoutecraftOptions(
  root: string,
  options: RoutecraftOptions = {},
): ResolvedRoutecraftOptions {
  const projectRoot = resolve(root);
  const routesDir = resolveFromRoot(projectRoot, options.routesDir ?? "src/routes");
  const typesDir = resolveFromRoot(projectRoot, options.typesDir ?? "src/types");

  return {
    root: projectRoot,
    routesDir,
    typesDir,
    typedRouterFile: resolve(typesDir, "typed-router.d.ts"),
    defaultLazy: options.defaultLazy ?? true,
    devTools: options.devTools ?? false,
  };
}

function resolveFromRoot(root: string, target: string): string {
  return isAbsolute(target) ? resolve(target) : resolve(root, target);
}
