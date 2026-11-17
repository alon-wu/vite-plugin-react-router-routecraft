import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRouteTree } from "../../src/core/route-tree.js";
import { getDocumentTitle } from "../../examples/basic/src/route-handle.js";

const exampleRoot = resolve(import.meta.dirname, "../../examples/basic/src/routes");

function normalizePath(file: string | undefined): string {
  return file?.replaceAll("\\", "/") ?? "";
}

describe("内置示例应用", () => {
  it("示例目录能编译出认证、工作区双布局及全局 middleware", () => {
    const result = buildRouteTree(exampleRoot, { defaultLazy: true });

    expect(result.diagnostics.filter((item) => item.level === "error")).toEqual([]);
    expect(result.root.middleware?.file).toContain("middleware.ts");
    expect(result.routePaths).toEqual(
      expect.arrayContaining([
        "/",
        "/auth/sign-in",
        "/auth/sign-up",
        "/workspace",
        "/workspace/projects/:projectId",
      ]),
    );
    expect(result.root.children.filter((node) => node.kind === "segment").map((node) => node.id)).toEqual([
      "routecraft:(auth)",
      "routecraft:(workspace)",
    ]);
    const authLayout = normalizePath(
      result.root.children[1]?.children[0]?.modules.Component?.file,
    );
    const workspaceLayout = normalizePath(
      result.root.children[2]?.children[0]?.modules.Component?.file,
    );
    expect(authLayout).toContain("(auth)/auth/layout.tsx");
    expect(workspaceLayout).toContain("(workspace)/workspace/layout.tsx");
  });

  it("示例同时覆盖 eager loader、lazy 页面和 hydration fallback", () => {
    const result = buildRouteTree(exampleRoot, { defaultLazy: true });
    const workspace = result.root.children[2]?.children[0];
    const projectRoute = workspace?.children[1]?.children[0]?.children[0];

    expect(result.root.modules.HydrateFallback?.lazy).toBe(true);
    expect(workspace?.children[0]?.modules.loader?.lazy).toBe(false);
    expect(workspace?.modules.Component?.lazy).toBe(false);
    expect(workspace?.children[0]?.modules.Component?.lazy).toBe(true);
    expect(projectRoute?.modules.Component?.lazy).toBe(true);
  });

  it("示例展示页面、无布局结构节点和根 404 的 handle 映射", () => {
    const result = buildRouteTree(exampleRoot, { defaultLazy: true });
    const authGroup = result.root.children.find((node) => node.id === "routecraft:(auth)");
    const workspace = result.root.children.find(
      (node) => node.id === "routecraft:(workspace)",
    )?.children[0];
    const workspacePage = workspace?.children.find((node) => node.kind === "index");
    const rootPage = result.root.children.find((node) => node.kind === "index");
    const notFound = result.root.children.find((node) => node.kind === "not-found");
    const authHandle = authGroup?.modules.handle;

    expect(result.diagnostics.filter((item) => item.level === "error")).toEqual([]);
    expect(authGroup?.modules.Component).toBeUndefined();
    expect(authHandle?.file).toContain("(auth)/layout.handle.ts");
    expect(rootPage?.modules.handle?.file).toContain("handle.tsx");
    expect(workspacePage?.modules.handle?.file).toContain("workspace/handle.ts");
    expect(notFound?.modules.handle?.file).toContain("not-found.handle.ts");
  });

  it("示例对页面、结构和 404 handle 使用独立的 eager/lazy 配置", () => {
    const result = buildRouteTree(exampleRoot, { defaultLazy: true });
    const rootPage = result.root.children.find((node) => node.kind === "index");
    const authGroup = result.root.children.find((node) => node.id === "routecraft:(auth)");
    const workspace = result.root.children.find(
      (node) => node.id === "routecraft:(workspace)",
    )?.children[0];
    const workspacePage = workspace?.children.find((node) => node.kind === "index");
    const notFound = result.root.children.find((node) => node.kind === "not-found");

    expect(rootPage?.modules.handle?.lazy).toBe(true);
    expect(authGroup?.modules.handle?.lazy).toBe(true);
    expect(workspace?.modules.handle?.lazy).toBe(true);
    expect(workspacePage?.modules.handle?.lazy).toBe(false);
    expect(notFound?.modules.handle?.lazy).toBe(true);
  });

  it("示例应用从 useMatches 的 handle 链选择最具体标题并提供默认标题", () => {
    expect(
      getDocumentTitle([
        { title: "站点" },
        { title: "工作区" },
        { title: "项目详情" },
      ]),
    ).toBe("项目详情 | Routecraft 示例");
    expect(getDocumentTitle([undefined, { breadcrumb: "未提供标题" }])).toBe(
      "Routecraft 示例",
    );
  });

  it("示例根布局实际消费 useMatches 并由应用代码更新 document.title", () => {
    const rootLayout = readFileSync(
      resolve(import.meta.dirname, "../../examples/basic/src/routes/layout.tsx"),
      "utf8",
    );

    expect(rootLayout).toContain("useMatches");
    expect(rootLayout).toContain("match.handle");
    expect(rootLayout).toContain("document.title = title");
  });
});
