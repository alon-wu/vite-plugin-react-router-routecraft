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

    expect(declarations).toContain('"/": Record<never, never>;');
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
        ],
      },
      routeIds: [
        "routecraft:root",
        "routecraft:home:index",
        "routecraft:users:userId:index",
      ],
      routePaths: ["/", "/users/:userId"],
      diagnostics: [],
    };
    const declarations = generateTypedRouter(ir);
    const declarationPath = "/typed-router.d.ts";
    const contractPath = "/routecraft-type-contract.ts";
    const files = new Map([
      [declarationPath, declarations],
      [
        contractPath,
        [
          'import { href } from "virtual:routecraft";',
          "",
          'href("/");',
          'href("/users/:userId", { userId: "user-1" });',
          "// @ts-expect-error 无参数路由不接受参数对象。",
          'href("/", {});',
          "// @ts-expect-error 动态路由必须提供参数对象。",
          'href("/users/:userId");',
          "// @ts-expect-error 动态路由必须提供正确的参数名。",
          'href("/users/:userId", { id: "user-1" });',
        ].join("\n"),
      ],
    ]);
    const options: ts.CompilerOptions = {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
    };
    const host = ts.createCompilerHost(options);
    const originalFileExists = host.fileExists.bind(host);
    const originalGetSourceFile = host.getSourceFile.bind(host);
    host.fileExists = (fileName) => files.has(fileName) || originalFileExists(fileName);
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
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
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(diagnostics).toEqual([]);
  });
});
