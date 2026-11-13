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
        routes: Array<{ source: string }>;
      };

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain("Routecraft DevTools");
      expect(htmlResponse.body).toContain("/@vite/client");
      expect(htmlResponse.body).not.toContain('import "virtual:routecraft/devtools-client"');
      expect(dataResponse.status).toBe(200);
      expect(body.status).toBe("ready");
      expect(JSON.stringify(body)).not.toContain(root);
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
