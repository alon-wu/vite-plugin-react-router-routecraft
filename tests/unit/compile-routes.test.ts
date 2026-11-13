import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRouteTree } from "../../src/core/route-tree.js";
import { compileRouteObjects } from "../../src/core/compile-routes.js";

const roots: string[] = [];

function createProject(): string {
  const root = mkdtempSync(join(tmpdir(), "routecraft-compile-"));
  roots.push(root);
  return root;
}

function add(root: string, path: string, source: string): void {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, source);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("RouteObject 源码编译", () => {
  it("生成对象式 lazy，保留静态匹配字段并支持 eager/lazy 混搭", () => {
    const root = createProject();
    add(root, "projects/page.tsx", "export default function Page() { return null; }");
    add(root, "projects/loader.ts", "export const loader = async () => null;");
    add(root, "projects/action.ts", "export const action = async () => null;");
    add(
      root,
      "projects/route.config.ts",
      "export default { lazy: { page: true, loader: false, action: true } };",
    );
    const routeTree = buildRouteTree(root, { defaultLazy: true });
    const code = compileRouteObjects(routeTree.root);

    expect(code).not.toContain("import type");
    expect(code).not.toContain("satisfies RouteObject");
    expect(code).toContain("export const routeObjects = [{");
    expect(code).toContain("index: true");
    expect(code).toContain("loader: __routecraft_module_");
    expect(code).toContain("lazy: {");
    expect(code).toContain("Component: async () => (await import(");
    expect(code).toContain("action: async () => (await import(");
    expect(code).not.toContain("lazy: async () =>");
  });

  it("将根 middleware 和不同路由分组布局放入不同 RouteObject", () => {
    const root = createProject();
    add(root, "middleware.ts", "export const middleware = async (_args, next) => next();");
    add(root, "(auth)/layout.tsx", "export default function Auth() { return null; }");
    add(root, "(auth)/sign-in/page.tsx", "export default function SignIn() { return null; }");
    add(root, "(workspace)/layout.tsx", "export default function Workspace() { return null; }");
    add(root, "(workspace)/page.tsx", "export default function Home() { return null; }");
    const routeTree = buildRouteTree(root, { defaultLazy: false });
    const code = compileRouteObjects(routeTree.root);

    expect(code).toContain("middleware: [__routecraft_module_");
    expect(code).toContain('path: "sign-in"');
    expect(code).toContain('id: "routecraft:(auth)"');
    expect(code).toContain('id: "routecraft:(workspace)"');
    expect(code).toContain("children:");
  });
});
