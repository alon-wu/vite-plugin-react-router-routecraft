import type {
  MiddlewareModuleRef,
  RouteModuleRef,
  RouteNode,
  RouteProperty,
} from "./ir.js";

/** 将 Route IR 编译为 Vite 虚拟模块可加载的 TypeScript 源码。 */
export function compileRouteObjects(root: RouteNode): string {
  const modules = collectModules(root);
  const imports = modules.map(
    (module, index) =>
      `import * as __routecraft_module_${index} from ${JSON.stringify(module.file)};`,
  );
  const moduleIndexes = new Map(
    modules.map((module, index) => [module.file, index] as const),
  );

  const routeObjects = `[${compileNode(root, 1, moduleIndexes)}]`;
  return [
    "// 由 Routecraft 根据路由目录自动生成；请勿手工编辑。",
    ...imports,
    "",
    `export const routeObjects = ${routeObjects};`,
    "",
  ].join("\n");
}

function compileNode(
  node: RouteNode,
  depth: number,
  moduleIndexes: ReadonlyMap<string, number>,
): string {
  const indentation = "  ".repeat(depth);
  const childIndentation = "  ".repeat(depth + 1);
  const fields: string[] = [`id: ${JSON.stringify(node.id)}`];

  if (node.path !== undefined) fields.push(`path: ${JSON.stringify(node.path)}`);
  if (node.index) fields.push("index: true");

  const eagerModules = Object.values(node.modules).filter(
    (module): module is RouteModuleRef => Boolean(module && !module.lazy),
  );
  for (const module of eagerModules) {
    fields.push(
      `${module.property}: ${moduleReference(module, moduleIndexes)}.${module.exportName}`,
    );
  }

  if (node.middleware) {
    fields.push(
      `middleware: [${middlewareReference(node.middleware, moduleIndexes)}.middleware]`,
    );
  }

  const lazyModules = Object.values(node.modules).filter(
    (module): module is RouteModuleRef => Boolean(module?.lazy),
  );
  if (lazyModules.length > 0) {
    const lazyFields = lazyModules.map(
      (module) =>
        `${module.property}: async () => (await import(${JSON.stringify(module.file)})).${module.exportName}`,
    );
    fields.push(`lazy: { ${lazyFields.join(", ")} }`);
  }

  if (node.children.length > 0) {
    const children = node.children
      .map((child) => compileNode(child, depth + 2, moduleIndexes))
      .join(",\n");
    fields.push(`children: [\n${children}\n${childIndentation}]`);
  }

  return `{\n${fields.map((field) => `${childIndentation}${field}`).join(",\n")}\n${indentation}}`;
}

function collectModules(root: RouteNode): Array<RouteModuleRef | MiddlewareModuleRef> {
  const byFile = new Map<string, RouteModuleRef | MiddlewareModuleRef>();
  const visit = (node: RouteNode): void => {
    for (const module of Object.values(node.modules)) {
      if (module && !module.lazy) byFile.set(module.file, module);
    }
    if (node.middleware) byFile.set(node.middleware.file, node.middleware);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return [...byFile.values()].sort((left, right) => left.file.localeCompare(right.file));
}

function moduleReference(
  module: RouteModuleRef,
  moduleIndexes: ReadonlyMap<string, number>,
): string {
  const index = moduleIndexes.get(module.file);
  if (index === undefined) {
    throw new Error(`Routecraft 编译错误：找不到模块 ${module.file} 的导入编号。`);
  }
  return `__routecraft_module_${index}`;
}

function middlewareReference(
  module: MiddlewareModuleRef,
  moduleIndexes: ReadonlyMap<string, number>,
): string {
  const index = moduleIndexes.get(module.file);
  if (index === undefined) {
    throw new Error(`Routecraft 编译错误：找不到 middleware 模块 ${module.file} 的导入编号。`);
  }
  return `__routecraft_module_${index}`;
}
