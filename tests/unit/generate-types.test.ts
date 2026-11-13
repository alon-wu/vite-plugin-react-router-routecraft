import { describe, expect, it } from "vitest";
import { generateTypedRouter } from "../../src/core/generate-types.js";
import type { RouteIR } from "../../src/core/ir.js";

describe("路由类型声明生成", () => {
  it("生成虚拟模块声明、路径参数、路由 ID 和 href 签名", () => {
    const ir: RouteIR = {
      root: {
        id: "routecraft:root",
        kind: "root",
        sourcePath: ".",
        routePath: "/",
        modules: {},
        children: [
          {
            id: "routecraft:home:index",
            kind: "index",
            sourcePath: "home",
            routePath: "/projects/:projectId",
            index: true,
            modules: {},
            children: [],
          },
        ],
      },
      routeIds: ["routecraft:root", "routecraft:home:index"],
      routePaths: ["/projects/:projectId"],
      diagnostics: [],
    };

    const declarations = generateTypedRouter(ir);

    expect(declarations).toContain('declare module "virtual:routecraft/routes"');
    expect(declarations).toContain('"routecraft:home:index"');
    expect(declarations).toContain('"/projects/:projectId"');
    expect(declarations).toContain('"/projects/:projectId": { "projectId": string }');
    expect(declarations).toContain("export type ParamsFor");
    expect(declarations).toContain('declare module "virtual:routecraft"');
  });

  it("把 React Router splat 参数声明为字符串参数“*”", () => {
    const ir: RouteIR = {
      root: {
        id: "routecraft:root",
        kind: "root",
        sourcePath: ".",
        routePath: "/",
        modules: {},
        children: [
          {
            id: "routecraft:docs:index",
            kind: "index",
            sourcePath: "docs",
            routePath: "/docs/*",
            index: true,
            modules: {},
            children: [],
          },
        ],
      },
      routeIds: ["routecraft:root", "routecraft:docs:index"],
      routePaths: ["/docs/*"],
      diagnostics: [],
    };

    expect(generateTypedRouter(ir)).toContain('"/docs/*": { "*": string }');
  });
});
