import ts from "typescript";
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

  it("为无参数路由生成不触发空对象类型规则的声明", () => {
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
            routePath: "/",
            index: true,
            modules: {},
            children: [],
          },
        ],
      },
      routeIds: ["routecraft:root", "routecraft:home:index"],
      routePaths: ["/"],
      diagnostics: [],
    };

    const declarations = generateTypedRouter(ir);

    expect(declarations).toContain('"/": Record<string, never>;');
    expect(declarations).not.toContain('"/": {};');
  });

  it("生成的类型允许无参数 href 并约束动态路由参数", () => {
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
            routePath: "/",
            index: true,
            modules: {},
            children: [],
          },
          {
            id: "routecraft:users:userId:index",
            kind: "index",
            sourcePath: "users/[userId]",
            routePath: "/users/:userId",
            index: true,
            modules: {},
            children: [],
          },
          {
            id: "routecraft:docs:splat:index",
            kind: "index",
            sourcePath: "docs/[...path]",
            routePath: "/docs/*",
            index: true,
            modules: {},
            children: [],
          },
          {
            id: "routecraft:teams:teamId:users:userId:index",
            kind: "index",
            sourcePath: "teams/[teamId]/users/[userId]",
            routePath: "/teams/:teamId/users/:userId",
            index: true,
            modules: {},
            children: [],
          },
        ],
      },
      routeIds: [
        "routecraft:root",
        "routecraft:home:index",
        "routecraft:users:userId:index",
        "routecraft:docs:splat:index",
        "routecraft:teams:teamId:users:userId:index",
      ],
      routePaths: [
        "/",
        "/users/:userId",
        "/docs/*",
        "/teams/:teamId/users/:userId",
      ],
      diagnostics: [],
    };
    const declarations = generateTypedRouter(ir);
    const declarationPath = "/typed-router.d.ts";
    const contractPath = "/routecraft-type-contract.ts";
    const files = new Map([
      [
        "/react-router.d.ts",
        'declare module "react-router" { export interface RouteObject { path?: string; } }\n',
      ],
      [declarationPath, declarations],
      [
        contractPath,
        [
          'import { href } from "virtual:routecraft";',
          'import type { ParamsFor } from "virtual:routecraft/routes";',
          "",
          'href("/");',
          'href("/users/:userId", { userId: "user-1" });',
          'href("/docs/*", { "*": "guides/start" });',
          'href("/teams/:teamId/users/:userId", { teamId: "team-1", userId: "user-1" });',
          'const noParams: ParamsFor<"/"> = {};',
          "// @ts-expect-error 无参数路由的参数类型拒绝任意字段。",
          'const invalidNoParams: ParamsFor<"/"> = { unexpected: "value" };',
          "// @ts-expect-error 无参数路由不接受参数对象。",
          'href("/", {});',
          "// @ts-expect-error 动态路由必须提供参数对象。",
          'href("/users/:userId");',
          "// @ts-expect-error 动态路由必须提供正确的参数名。",
          'href("/users/:userId", { id: "user-1" });',
          "// @ts-expect-error Catch-all 路由要求使用 React Router 的星号参数名。",
          'href("/docs/*", { path: "guides/start" });',
          "// @ts-expect-error 多参数路由要求提供所有动态参数。",
          'href("/teams/:teamId/users/:userId", { teamId: "team-1" });',
          "// @ts-expect-error 动态路由也拒绝未声明的参数名。",
          'href("/users/:userId", { userId: "user-1", extra: "value" });',
          'declare const maybePath: "/" | "/users/:userId";',
          "// @ts-expect-error 未缩窄的路径联合不能保证参数与路径匹配。",
          "href(maybePath);",
          "// @ts-expect-error 参数对象不能安全地匹配尚未缩窄的路径联合。",
          'href(maybePath, { userId: "user-1" });',
          "",
          "void [noParams, invalidNoParams];",
        ].join("\n"),
      ],
    ]);
    expect(getTypeDiagnostics(files)).toEqual([]);
  }, 30_000);

  it("没有页面路由时也不生成空对象类型", () => {
    const ir: RouteIR = {
      root: {
        id: "routecraft:root",
        kind: "root",
        sourcePath: ".",
        routePath: "/",
        modules: {},
        children: [],
      },
      routeIds: ["routecraft:root"],
      routePaths: [],
      diagnostics: [],
    };

    const declarations = generateTypedRouter(ir);

    expect(declarations).toContain(
      "[path: string]: Record<string, never>;",
    );
    expect(declarations).not.toMatch(/type RouteParamMap = \{\s*\};/u);
    expect(declarations).not.toMatch(/:\s*\{\s*\}/u);

    const files = new Map<string, string>([
      [
        "/react-router.d.ts",
        'declare module "react-router" { export interface RouteObject { path?: string; } }\n',
      ],
      ["/typed-router.d.ts", declarations],
      [
        "/empty-route-contract.ts",
        [
          'import { href } from "virtual:routecraft";',
          "// @ts-expect-error 没有页面路由时，不允许生成任何有效路径。",
          "href('/');",
        ].join("\n"),
      ],
    ]);

    expect(getTypeDiagnostics(files)).toEqual([]);
  }, 30_000);
});

function getTypeDiagnostics(files: Map<string, string>): readonly ts.Diagnostic[] {
  const options: ts.CompilerOptions = {
    isolatedModules: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    moduleDetection: ts.ModuleDetectionKind.Force,
    noEmit: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    skipLibCheck: false,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: true,
  };
  const host = ts.createCompilerHost(options);
  const originalFileExists = host.fileExists.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (fileName) => files.has(fileName) || originalFileExists(fileName);
  host.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const content = files.get(fileName);
    if (content !== undefined) {
      return ts.createSourceFile(fileName, content, languageVersion, true);
    }
    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };
  const program = ts.createProgram([...files.keys()], options, host);
  return ts.getPreEmitDiagnostics(program);
}
