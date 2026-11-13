import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { buildRouteTree } from "../../src/core/route-tree.js";

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
});
