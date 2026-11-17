import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { matchRoutes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "vite";
import routecraft from "../../src/vite/plugin.js";

const roots: string[] = [];

function createProject(): string {
  const root = mkdtempSync(join(tmpdir(), "routecraft-vite-"));
  roots.push(root);
  mkdirSync(join(root, "src/routes"), { recursive: true });
  writeFileSync(
    join(root, "src/routes/page.tsx"),
    "export default function Home() { return null; }\n",
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Vite 插件集成", () => {
  it("解析虚拟路由模块并生成类型声明文件", async () => {
    const root = createProject();
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [routecraft({ routesDir: "src/routes", typesDir: "src/generated" })],
    });

    try {
      const resolved = await server.pluginContainer.resolveId("virtual:routecraft/routes");
      expect(resolved?.id).toBe("\0routecraft:routes");
      const loaded = await server.pluginContainer.load(resolved!.id);
      expect(String(loaded)).toContain("routeObjects");
      expect(String(loaded)).toContain("page.tsx");
      const typesFile = join(root, "src/generated/typed-router.d.ts");
      expect(existsSync(typesFile)).toBe(true);
      expect(readFileSync(typesFile, "utf8")).toContain('declare module "virtual:routecraft/routes"');
    } finally {
      await server.close();
    }
  });

  it("只在 devTools 开启时注册只读页面与数据端点", async () => {
    const root = createProject();
    writeFileSync(
      join(root, "src/routes/layout.handle.ts"),
      "export const handle = { title: '根布局元信息' };\n",
    );
    writeFileSync(
      join(root, "src/routes/handle.ts"),
      "export const handle = { title: '首页元信息' };\n",
    );
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [routecraft({ devTools: true })],
    });

    try {
      const htmlResponse = await requestMiddleware(server, "/__routecraft");
      const dataResponse = await requestMiddleware(server, "/__routecraft/data");
      const body = JSON.parse(dataResponse.body) as {
        status: string;
        routes: Array<{
          source: string;
          modules: Record<string, { file: string; loading: string }>;
          children: Array<{ kind: string; modules: Record<string, { file: string; loading: string }> }>;
        }>;
      };

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain("Routecraft DevTools");
      expect(htmlResponse.body).toContain("/@vite/client");
      expect(htmlResponse.body).not.toContain('import "virtual:routecraft/devtools-client"');
      expect(dataResponse.status).toBe(200);
      expect(body.status).toBe("ready");
      expect(body.routes[0]?.modules.handle).toEqual({
        file: "layout.handle.ts",
        loading: "lazy",
      });
      expect(body.routes[0]?.children.find((route) => route.kind === "index")?.modules.handle)
        .toEqual({ file: "handle.ts", loading: "lazy" });
      expect(JSON.stringify(body)).not.toContain(root);
      expect(JSON.stringify(body)).not.toContain("根布局元信息");
      expect(JSON.stringify(body)).not.toContain("首页元信息");
    } finally {
      await server.close();
    }
  });

  it("关闭 devTools 时不注册专用中间件或客户端虚拟模块", async () => {
    const root = createProject();
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [routecraft({ devTools: false })],
    });

    try {
      expect(
        server.middlewares.stack.some(
          (item) =>
            (item.handle as { name?: string }).name === "routecraftDevtoolsMiddleware",
        ),
      ).toBe(false);
      expect(
        await server.pluginContainer.resolveId("virtual:routecraft/devtools-client"),
      ).toBeNull();
    } finally {
      await server.close();
    }
  });

  it("路由存在错误时不覆盖上一次声明之外的部分产物，且构建钩子可报告错误", async () => {
    const root = createProject();
    writeFileSync(join(root, "src/routes/page.tsx"), "const Page = () => null;\n");
    await expect(
      createServer({
        configFile: false,
        root,
        logLevel: "silent",
        server: { middlewareMode: true },
        plugins: [routecraft()],
      }),
    ).rejects.toThrow("RC_REQUIRED_EXPORT");
  });

  it("路由根目录不存在时以稳定诊断码阻止构建", async () => {
    const root = mkdtempSync(join(tmpdir(), "routecraft-vite-"));
    roots.push(root);

    await expect(
      createServer({
        configFile: false,
        root,
        logLevel: "silent",
        server: { middlewareMode: true },
        plugins: [routecraft({ routesDir: "missing/routes" })],
      }),
    ).rejects.toThrow("RC_ROUTES_DIR_MISSING");
  });

  it("类型声明输出路径不可创建时报告写入诊断并阻止构建", async () => {
    const root = createProject();
    writeFileSync(join(root, "blocked"), "该文件阻止同名目录创建。");

    await expect(
      createServer({
        configFile: false,
        root,
        logLevel: "silent",
        server: { middlewareMode: true },
        plugins: [routecraft({ typesDir: "blocked/types" })],
      }),
    ).rejects.toThrow("RC_TYPES_WRITE");
  });

  it("路由目录变更时重新生成类型并通知 DevTools 客户端", async () => {
    const root = createProject();
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [routecraft({ routesDir: "src/routes", typesDir: "src/types", devTools: true })],
    });

    try {
      const addedFile = join(root, "src/routes/docs/page.tsx");
      mkdirSync(join(root, "src/routes/docs"), { recursive: true });
      writeFileSync(addedFile, "export default function Docs() { return null; }\n");
      const plugin = server.config.plugins.find(
        (item) => item.name === "vite-plugin-react-router-routecraft",
      ) as unknown as {
        handleHotUpdate?: Function | { handler: Function };
      };
      const hook = plugin.handleHotUpdate;
      const handle = typeof hook === "function" ? hook : hook?.handler;
      if (!handle) throw new Error("Routecraft 未注册 handleHotUpdate 钩子。");
      const send = vi.spyOn(server.ws, "send");

      await handle.call({}, {
        file: addedFile,
        timestamp: Date.now(),
        modules: [],
        server,
        read: async () => readFileSync(addedFile, "utf8"),
      });

      const declarations = readFileSync(join(root, "src/types/typed-router.d.ts"), "utf8");
      expect(declarations).toContain('"/docs"');
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "custom",
          event: "routecraft:update",
        }),
      );
      expect(send).toHaveBeenCalledWith({ type: "full-reload" });
    } finally {
      await server.close();
    }
  });

  it("覆盖路由新增、修改、删除以及编译错误恢复的完整更新周期", async () => {
    const root = createProject();
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [routecraft({ routesDir: "src/routes", typesDir: "src/types", devTools: true })],
    });

    try {
      const routeFile = join(root, "src/routes/docs/page.tsx");
      const declarationsFile = join(root, "src/types/typed-router.d.ts");
      const send = vi.spyOn(server.ws, "send");

      mkdirSync(join(root, "src/routes/docs"), { recursive: true });
      writeFileSync(routeFile, "export default function Docs() { return null; }\n");
      await runHotUpdate(server, routeFile);
      expect(readFileSync(declarationsFile, "utf8")).toContain('"/docs"');
      expect((await getDevtoolsData(server)).status).toBe("ready");
      expect(send).toHaveBeenCalledWith({ type: "full-reload" });

      send.mockClear();
      writeFileSync(routeFile, "export default function UpdatedDocs() { return null; }\n");
      await runHotUpdate(server, routeFile);
      expect((await getDevtoolsData(server)).status).toBe("ready");
      expect(send).toHaveBeenCalledWith({ type: "full-reload" });

      send.mockClear();
      writeFileSync(routeFile, "const MissingDefaultExport = () => null;\n");
      await runHotUpdate(server, routeFile);
      const errorSnapshot = await getDevtoolsData(server);
      expect(errorSnapshot.status).toBe("error");
      expect(errorSnapshot.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
        "RC_REQUIRED_EXPORT",
      );
      expect(send).not.toHaveBeenCalledWith({ type: "full-reload" });

      send.mockClear();
      writeFileSync(routeFile, "export default function RecoveredDocs() { return null; }\n");
      await runHotUpdate(server, routeFile);
      expect((await getDevtoolsData(server)).status).toBe("ready");
      expect(readFileSync(declarationsFile, "utf8")).toContain('"/docs"');
      expect(send).toHaveBeenCalledWith({ type: "full-reload" });

      send.mockClear();
      rmSync(routeFile);
      await runHotUpdate(server, routeFile);
      expect(readFileSync(declarationsFile, "utf8")).not.toContain('"/docs"');
      expect((await getDevtoolsData(server)).status).toBe("ready");
      expect(send).toHaveBeenCalledWith({ type: "full-reload" });
    } finally {
      await server.close();
    }
  });

  it("handle 文件新增、修改和删除时刷新 DevTools 来源但不泄露元信息值", async () => {
    const root = createProject();
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [routecraft({ routesDir: "src/routes", typesDir: "src/types", devTools: true })],
    });

    try {
      const pageDirectory = join(root, "src/routes/docs");
      const pageFile = join(pageDirectory, "page.tsx");
      const handleFile = join(pageDirectory, "handle.ts");
      mkdirSync(pageDirectory, { recursive: true });
      writeFileSync(pageFile, "export default function Docs() { return null; }\n");
      await runHotUpdate(server, pageFile);

      writeFileSync(
        handleFile,
        "export const handle = { title: 'secret-handle-value' };\n",
      );
      await runHotUpdate(server, handleFile);
      const addedSnapshot = await getDevtoolsData(server);
      expect(JSON.stringify(addedSnapshot)).toContain(
        '"handle":{"file":"docs/handle.ts","loading":"lazy"}',
      );
      expect(JSON.stringify(addedSnapshot)).not.toContain("secret-handle-value");

      writeFileSync(
        handleFile,
        "export const handle = { title: 'updated-secret-handle-value' };\n",
      );
      await runHotUpdate(server, handleFile);
      const modifiedSnapshot = await getDevtoolsData(server);
      expect(JSON.stringify(modifiedSnapshot)).not.toContain("updated-secret-handle-value");
      expect(JSON.stringify(modifiedSnapshot)).toContain(
        '"handle":{"file":"docs/handle.ts","loading":"lazy"}',
      );

      rmSync(handleFile);
      await runHotUpdate(server, handleFile);
      const deletedSnapshot = await getDevtoolsData(server);
      expect(JSON.stringify(deletedSnapshot)).not.toContain("docs/handle.ts");
    } finally {
      await server.close();
    }
  });

  it("虚拟模块在运行时生成可由 React Router 匹配的多分支 RouteObject", async () => {
    const root = createProject();
    writeFileSync(
      join(root, "src/routes/middleware.ts"),
      "export const middleware = async (_args, next) => next();\n",
    );
    mkdirSync(join(root, "src/routes/(auth)/auth"), { recursive: true });
    writeFileSync(
      join(root, "src/routes/(auth)/auth/layout.tsx"),
      "export default function AuthLayout() { return null; }\n",
    );
    mkdirSync(join(root, "src/routes/(auth)/auth/sign-in"), { recursive: true });
    writeFileSync(
      join(root, "src/routes/(auth)/auth/sign-in/page.tsx"),
      "export default function SignIn() { return null; }\n",
    );
    mkdirSync(join(root, "src/routes/(workspace)/workspace"), { recursive: true });
    writeFileSync(
      join(root, "src/routes/(workspace)/workspace/layout.tsx"),
      "export default function WorkspaceLayout() { return null; }\n",
    );
    writeFileSync(
      join(root, "src/routes/(workspace)/workspace/page.tsx"),
      "export default function WorkspacePage() { return null; }\n",
    );
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [routecraft({ devTools: false })],
    });

    try {
      const module = (await server.ssrLoadModule(
        "virtual:routecraft/routes",
      )) as { routeObjects: Parameters<typeof matchRoutes>[0] };
      const authMatches = matchRoutes(module.routeObjects, "/auth/sign-in");
      const workspaceMatches = matchRoutes(module.routeObjects, "/workspace");

      expect(authMatches?.map((match) => match.route.id)).toContain(
        "routecraft:(auth):auth:sign-in:index",
      );
      expect(workspaceMatches?.map((match) => match.route.id)).toContain(
        "routecraft:(workspace):workspace:index",
      );
      expect(module.routeObjects[0]?.middleware).toHaveLength(1);
      expect(module.routeObjects[0]?.children?.length).toBeGreaterThan(1);
    } finally {
      await server.close();
    }
  });

  it("虚拟路由对象包含 eager handle，并可独立加载 lazy 页面 handle", async () => {
    const root = createProject();
    writeFileSync(
      join(root, "src/routes/layout.handle.ts"),
      "export const handle = { title: '根布局' };\n",
    );
    writeFileSync(
      join(root, "src/routes/handle.ts"),
      "export const handle = { title: '首页' };\n",
    );
    mkdirSync(join(root, "src/routes/docs"), { recursive: true });
    writeFileSync(
      join(root, "src/routes/docs/page.tsx"),
      "export default function Docs() { return null; }\n",
    );
    writeFileSync(
      join(root, "src/routes/docs/handle.ts"),
      "export const handle = { title: '文档' };\n",
    );
    writeFileSync(
      join(root, "src/routes/docs/route.config.ts"),
      "export default { lazy: { page: false, handle: true } };\n",
    );
    mkdirSync(join(root, "src/routes/admin"), { recursive: true });
    writeFileSync(
      join(root, "src/routes/admin/layout.handle.ts"),
      "export const handle = { title: '管理结构' };\n",
    );
    writeFileSync(
      join(root, "src/routes/admin/page.tsx"),
      "export default function Admin() { return null; }\n",
    );
    writeFileSync(
      join(root, "src/routes/admin/route.config.ts"),
      "export default { lazy: { layoutHandle: true } };\n",
    );
    writeFileSync(
      join(root, "src/routes/not-found.tsx"),
      "export default function NotFound() { return null; }\n",
    );
    writeFileSync(
      join(root, "src/routes/not-found.handle.ts"),
      "export const handle = { title: '未找到' };\n",
    );
    writeFileSync(
      join(root, "src/routes/route.config.ts"),
      "export default { lazy: { notFoundHandle: true } };\n",
    );
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [routecraft({ defaultLazy: false })],
    });

    try {
      const module = (await server.ssrLoadModule(
        "virtual:routecraft/routes",
      )) as { routeObjects: Parameters<typeof matchRoutes>[0] };
      const rootRoute = module.routeObjects[0];
      const homeRoute = rootRoute?.children?.find((route) => route.index);
      const docsRoute = rootRoute?.children?.find((route) => route.path === "docs");
      const docsPage = docsRoute?.children?.find((route) => route.index);
      const adminRoute = rootRoute?.children?.find((route) => route.path === "admin");
      const adminPage = adminRoute?.children?.find((route) => route.index);
      const notFoundRoute = rootRoute?.children?.find((route) => route.path === "*");

      expect(rootRoute?.handle).toEqual({ title: "根布局" });
      expect(homeRoute?.handle).toEqual({ title: "首页" });
      expect(docsPage?.Component).toBeTypeOf("function");
      expect(docsPage?.handle).toBeUndefined();

      const lazyHandle = docsPage?.lazy as
        | { handle?: () => Promise<unknown> }
        | undefined;
      await expect(lazyHandle?.handle?.()).resolves.toEqual({ title: "文档" });

      expect(adminRoute?.Component).toBeUndefined();
      const lazyAdminHandle = adminRoute?.lazy as
        | { handle?: () => Promise<unknown> }
        | undefined;
      await expect(lazyAdminHandle?.handle?.()).resolves.toEqual({ title: "管理结构" });
      expect(adminPage?.index).toBe(true);

      const lazyNotFoundHandle = notFoundRoute?.lazy as
        | { handle?: () => Promise<unknown> }
        | undefined;
      await expect(lazyNotFoundHandle?.handle?.()).resolves.toEqual({ title: "未找到" });
      expect(matchRoutes(module.routeObjects, "/docs")?.map((match) => match.route.id))
        .toContain("routecraft:docs:index");
      expect(matchRoutes(module.routeObjects, "/admin")?.map((match) => match.route.id))
        .toContain("routecraft:admin");
      expect(matchRoutes(module.routeObjects, "/missing")?.map((match) => match.route.id))
        .toContain("routecraft:not-found");
    } finally {
      await server.close();
    }
  });
});

async function runHotUpdate(
  server: Awaited<ReturnType<typeof createServer>>,
  file: string,
): Promise<void> {
  const plugin = server.config.plugins.find(
    (item) => item.name === "vite-plugin-react-router-routecraft",
  ) as unknown as {
    handleHotUpdate?: Function | { handler: Function };
  };
  const hook = plugin.handleHotUpdate;
  const handle = typeof hook === "function" ? hook : hook?.handler;
  if (!handle) throw new Error("Routecraft 未注册 handleHotUpdate 钩子。");
  await handle.call({}, {
    file,
    timestamp: Date.now(),
    modules: [],
    server,
    read: async () => readFileSync(file, "utf8"),
  });
}

async function getDevtoolsData(
  server: Awaited<ReturnType<typeof createServer>>,
): Promise<{ status: string; diagnostics: Array<{ code: string }> }> {
  const response = await requestMiddleware(server, "/__routecraft/data");
  return JSON.parse(response.body) as {
    status: string;
    diagnostics: Array<{ code: string }>;
  };
}

async function requestMiddleware(
  server: Awaited<ReturnType<typeof createServer>>,
  url: string,
): Promise<{ status: number; body: string }> {
  const middleware = server.middlewares.stack.find((item) => {
    return (item.handle as { name?: string }).name === "routecraftDevtoolsMiddleware";
  })?.handle;
  if (!middleware) throw new Error("未注册 Routecraft DevTools 中间件。");

  const headers = new Map<string, string>();
  let body = "";
  let status = 200;
  const request = { url, method: "GET", headers: {} };
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    end(content = "") {
      body = content;
      status = this.statusCode;
    },
  };
  await new Promise<void>((resolve, reject) => {
    const finish = (content = "") => {
      body = content;
      status = response.statusCode;
      resolve();
    };
    response.end = finish;
    (middleware as (req: unknown, res: unknown, next: (error?: Error) => void) => void)(
      request,
      response,
      (error) => (error ? reject(error) : resolve()),
    );
  });
  return { status, body };
}
