import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRouteTree } from "../../src/core/route-tree.js";

const roots: string[] = [];

function routeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "routecraft-tree-"));
  roots.push(root);
  return root;
}

function file(root: string, path: string, source: string): void {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, source);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("路由树 IR", () => {
  it("支持共享合成根、多路由组布局和全局 middleware", () => {
    const root = routeRoot();
    file(root, "middleware.ts", "export const middleware = async (_args, next) => next();");
    file(root, "(auth)/layout.tsx", "export default function AuthLayout() { return null; }");
    file(root, "(auth)/sign-in/page.tsx", "export default function SignIn() { return null; }");
    file(root, "(workspace)/layout.tsx", "export default function WorkspaceLayout() { return null; }");
    file(root, "(workspace)/page.tsx", "export default function Workspace() { return null; }");

    const result = buildRouteTree(root, { defaultLazy: true });

    expect(result.diagnostics).toEqual([]);
    expect(result.root.middleware?.file).toBe(join(root, "middleware.ts"));
    expect(result.root.children.map((node) => node.id)).toEqual([
      "routecraft:(auth)",
      "routecraft:(workspace)",
    ]);
    expect(result.root.children.every((node) => node.path === undefined)).toBe(true);
    expect(result.root.children.map((node) => node.modules.Component?.file)).toEqual([
      join(root, "(auth)/layout.tsx"),
      join(root, "(workspace)/layout.tsx"),
    ]);
  });

  it("按字段分别选择 eager/lazy，并允许页面没有 action", () => {
    const root = routeRoot();
    file(root, "projects/page.tsx", "export default function Projects() { return null; }");
    file(root, "projects/loader.ts", "export const loader = async () => null;");
    file(
      root,
      "projects/route.config.ts",
      "export default { lazy: { page: true, loader: false } };",
    );

    const result = buildRouteTree(root, { defaultLazy: true });
    const page = result.root.children[0]?.children[0];

    expect(result.diagnostics).toEqual([]);
    expect(page?.modules.Component?.lazy).toBe(true);
    expect(page?.modules.loader?.lazy).toBe(false);
    expect(page?.modules.action).toBeUndefined();
  });

  it("将页面、结构路由和 404 的 handle 分别挂到目标节点并独立选择加载方式", () => {
    const root = routeRoot();
    file(root, "layout.handle.ts", "export const handle = { title: '根结构' };");
    file(root, "page.tsx", "export default function Home() { return null; }");
    file(root, "handle.tsx", "export const handle = { title: '首页' };");
    file(root, "not-found.tsx", "export default function NotFound() { return null; }");
    file(root, "not-found.handle.ts", "export const handle = { title: '未找到' };");
    file(root, "workspace/layout.handle.ts", "export const handle = { title: '工作区结构' };");
    file(root, "workspace/page.tsx", "export default function Workspace() { return null; }");
    file(root, "workspace/handle.ts", "export const handle = { title: '工作区首页' };");
    file(
      root,
      "workspace/route.config.ts",
      "export default { lazy: { layoutHandle: false, handle: true } };",
    );
    file(
      root,
      "section/route.config.ts",
      "export default { lazy: { layoutHandle: false } };",
    );
    file(root, "section/layout.handle.ts", "export const handle = { title: '分组' };");

    const result = buildRouteTree(root, { defaultLazy: true });
    const workspace = result.root.children.find((node) => node.id === "routecraft:workspace");
    const workspacePage = workspace?.children.find((node) => node.kind === "index");
    const section = result.root.children.find((node) => node.id === "routecraft:section");
    const notFound = result.root.children.find((node) => node.kind === "not-found");

    expect(result.diagnostics).toEqual([]);
    expect(result.root.modules.handle).toMatchObject({
      file: join(root, "layout.handle.ts"),
      lazy: true,
    });
    expect(result.root.children.find((node) => node.kind === "index")?.modules.handle)
      .toMatchObject({ file: join(root, "handle.tsx"), lazy: true });
    expect(workspace?.modules.handle).toMatchObject({
      file: join(root, "workspace/layout.handle.ts"),
      lazy: false,
    });
    expect(workspacePage?.modules.handle).toMatchObject({
      file: join(root, "workspace/handle.ts"),
      lazy: true,
    });
    expect(notFound?.modules.handle).toMatchObject({
      file: join(root, "not-found.handle.ts"),
      lazy: true,
    });
    expect(section?.modules.handle).toMatchObject({
      file: join(root, "section/layout.handle.ts"),
      lazy: false,
    });
  });

  it("诊断没有页面的 handle、没有根 404 页面和非根 404 handle", () => {
    const root = routeRoot();
    file(root, "orphan/handle.ts", "export const handle = {};");
    file(root, "not-found.handle.ts", "export const handle = {};");
    file(root, "workspace/not-found.handle.ts", "export const handle = {};");

    const result = buildRouteTree(root, { defaultLazy: true });
    const errors = result.diagnostics.filter((item) => item.level === "error");

    expect(errors.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "RC_ORPHAN_ROUTE_HANDLE",
        "RC_ORPHAN_NOT_FOUND_HANDLE",
        "RC_NOT_FOUND_ROOT_ONLY",
      ]),
    );
    expect(errors.find((item) => item.code === "RC_ORPHAN_ROUTE_HANDLE")?.file)
      .toBe(join(root, "orphan/handle.ts"));
    expect(errors.find((item) => item.code === "RC_ORPHAN_NOT_FOUND_HANDLE")?.file)
      .toBe(join(root, "not-found.handle.ts"));
  });

  it("校验 handle 必须作为命名导出提供", () => {
    const root = routeRoot();
    file(root, "page.tsx", "export default function Home() { return null; }");
    file(root, "handle.ts", "export default { title: '首页' };");

    const result = buildRouteTree(root, { defaultLazy: true });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RC_REQUIRED_EXPORT",
        file: join(root, "handle.ts"),
      }),
    );
  });

  it("报告完整 URL 形状冲突，不通过组名或参数名规避", () => {
    const root = routeRoot();
    file(root, "(public)/[id]/page.tsx", "export default function A() { return null; }");
    file(root, "(account)/[slug]/page.tsx", "export default function B() { return null; }");

    const result = buildRouteTree(root, { defaultLazy: true });

    expect(result.diagnostics.map((item) => item.code)).toContain("RC_ROUTE_CONFLICT");
  });

  it("拒绝同一路径重复使用动态参数名", () => {
    const root = routeRoot();
    file(root, "[id]/[id]/page.tsx", "export default function Page() { return null; }");

    const result = buildRouteTree(root, { defaultLazy: true });

    expect(result.diagnostics.map((item) => item.code)).toContain(
      "RC_DUPLICATE_PARAM",
    );
  });

  it("拒绝没有页面或布局模块的孤立 route.config.ts", () => {
    const root = routeRoot();
    file(root, "section/route.config.ts", "export default { lazy: { page: true } };");

    const result = buildRouteTree(root, { defaultLazy: true });

    expect(result.diagnostics.map((item) => item.code)).toContain(
      "RC_ORPHAN_ROUTE_CONFIG",
    );
  });

  it("拒绝 catch-all 页面与根 not-found 同时占用 splat 匹配", () => {
    const root = routeRoot();
    file(root, "[...parts]/page.tsx", "export default function CatchAll() { return null; }");
    file(root, "not-found.tsx", "export default function NotFound() { return null; }");

    const result = buildRouteTree(root, { defaultLazy: true });

    expect(result.diagnostics.map((item) => item.code)).toContain("RC_ROUTE_CONFLICT");
  });
});
