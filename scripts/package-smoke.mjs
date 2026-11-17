import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveNpmInvocation } from "./npm-command.mjs";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageManifest = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const npmInvocation = resolveNpmInvocation(
  process.platform,
  process.execPath,
  process.env.npm_execpath,
);
const minimumPeers = process.argv.includes("--minimum-peers");
const consumerRoot = await mkdtemp(
  join(await realpath(tmpdir()), "routecraft-package-smoke-"),
);
let devServer;

try {
  run(
    ["pack", "--dry-run=false", "--pack-destination", consumerRoot],
    packageRoot,
  );
  const tarball = join(
    consumerRoot,
    `${packageManifest.name}-${packageManifest.version}.tgz`,
  );

  await writeConsumerFiles(consumerRoot, tarball);
  run(["install", "--no-audit", "--no-fund"], consumerRoot);
  // Vite 插件在构建阶段生成路由类型声明，因此必须先构建再做独立类型检查。
  run(["run", "build"], consumerRoot);
  run(["run", "typecheck"], consumerRoot);
  await lintGeneratedDeclarations(consumerRoot);
  await assertPackagedRouteHandles(consumerRoot);

  const port = 4170 + Math.floor(Math.random() * 1000);
  devServer = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: consumerRoot, stdio: "inherit" },
  );

  const snapshot = await readDevtoolsSnapshot(devServer, port);
  const rootRoute = snapshot.routes?.[0];
  const indexRoute = rootRoute?.children?.find((route) => route.kind === "index");
  const usersRoute = rootRoute?.children?.find(
    (route) => route.kind === "segment" && route.path === "/users",
  );
  const userRoute = usersRoute?.children?.find(
    (route) => route.kind === "segment" && route.path === "/users/:userId",
  );
  const userIndexRoute = userRoute?.children?.find(
    (route) => route.kind === "index",
  );
  const notFoundRoute = rootRoute?.children?.find(
    (route) => route.kind === "not-found",
  );
  const generatedTypes = await readFile(
    join(consumerRoot, "src/types/typed-router.d.ts"),
    "utf8",
  );
  const violations = [];
  if (snapshot.status !== "ready") violations.push("DevTools 状态不是 ready");
  if (snapshot.routeCount !== 6) violations.push("路由节点数量不是 6");
  if (rootRoute?.kind !== "root") violations.push("缺少共同根路由");
  if (rootRoute.modules?.handle?.file !== "layout.handle.ts") {
    violations.push("根结构 handle 来源不正确");
  }
  if (rootRoute.modules?.handle?.loading !== "eager") {
    violations.push("根结构 handle 未按 eager 加载");
  }
  if (indexRoute?.path !== "/") violations.push("根页面路由路径不正确");
  if (indexRoute.modules?.Component?.file !== "page.tsx") {
    violations.push("根页面组件来源不正确");
  }
  if (indexRoute.modules?.handle?.file !== "handle.ts") {
    violations.push("根页面 handle 来源不正确");
  }
  if (indexRoute.modules?.handle?.loading !== "lazy") {
    violations.push("根页面 handle 未按 lazy 加载");
  }
  if (userIndexRoute?.path !== "/users/:userId") {
    violations.push("动态用户页面路径不正确");
  }
  if (userIndexRoute.modules?.handle?.file !== "users/[userId]/handle.ts") {
    violations.push("动态用户页面 handle 来源不正确");
  }
  if (userIndexRoute.modules?.handle?.loading !== "eager") {
    violations.push("动态用户页面 handle 未按 eager 加载");
  }
  if (notFoundRoute?.modules?.handle?.file !== "not-found.handle.ts") {
    violations.push("根 404 handle 来源不正确");
  }
  if (notFoundRoute.modules?.handle?.loading !== "eager") {
    violations.push("根 404 handle 未按 eager 加载");
  }
  if (!generatedTypes.includes('"/": Record<string, never>;')) {
    violations.push("生成声明缺少无参数根路径签名");
  }
  if (generatedTypes.includes('"/": {};')) {
    violations.push("生成声明包含不合规的空对象类型");
  }
  if (violations.length > 0) {
    throw new Error(
      [
        `打包安装后的消费者验证失败：${violations.join("；")}`,
        `DevTools：${JSON.stringify(snapshot)}`,
      ].join("\n"),
    );
  }

  console.log(
    `发布包冒烟测试通过：${packageManifest.name}@${packageManifest.version}；${minimumPeers ? "最低 peer 版本、" : ""}类型检查、生产构建和 DevTools 路由接口均正常。`,
  );
} finally {
  if (devServer && devServer.exitCode === null) {
    const closed = once(devServer, "close");
    devServer.kill("SIGTERM");
    await closed;
  }
  // Vite 的依赖优化目录可能在开发服务器退出时仍处于并发收尾状态。
  await rm(consumerRoot, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

function run(args, cwd) {
  const result = spawnSync(
    npmInvocation.command,
    [...npmInvocation.args, ...args],
    {
      cwd,
      encoding: "utf8",
      stdio: "inherit",
      shell: npmInvocation.shell,
      env: {
        ...process.env,
        npm_config_dry_run: "false",
      },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${npmInvocation.command} ${args.join(" ")} 失败，退出码：${result.status}`,
    );
  }
}

async function lintGeneratedDeclarations(root) {
  const consumerRequire = createRequire(join(root, "package.json"));
  const { ESLint } = consumerRequire("eslint");
  const parser = consumerRequire("@typescript-eslint/parser");
  const typescriptEslint = consumerRequire("@typescript-eslint/eslint-plugin");
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.d.ts"],
        languageOptions: {
          parser,
          parserOptions: { project: "./tsconfig.json", tsconfigRootDir: root },
        },
        plugins: { "@typescript-eslint": typescriptEslint },
        rules: {
          ...typescriptEslint.configs.recommended.rules,
          "@typescript-eslint/no-empty-object-type": "error",
          "@typescript-eslint/no-generated-empty-object-type": "error",
        },
      },
    ],
  });
  const results = await eslint.lintFiles(["src/types/typed-router.d.ts"]);
  const errors = results.flatMap((result) =>
    result.messages.map(
      (message) => `${result.filePath}: ${message.message} (${message.ruleId})`,
    ),
  );
  if (errors.length > 0) {
    throw new Error(`生成的类型声明未通过 ESLint：\n${errors.join("\n")}`);
  }
}

async function assertPackagedRouteHandles(root) {
  const consumerRequire = createRequire(join(root, "package.json"));
  const { createServer } = await import(
    pathToFileURL(consumerRequire.resolve("vite"))
  );
  const pluginEntry = join(
    root,
    "node_modules",
    packageManifest.name,
    "dist/index.js",
  );
  const { default: routecraft } = await import(pathToFileURL(pluginEntry));
  const server = await createServer({
    configFile: false,
    root,
    logLevel: "silent",
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    plugins: [routecraft({ routesDir: "src/routes" })],
  });

  try {
    const loaded = await server.ssrLoadModule("virtual:routecraft/routes");
    const rootRoute = loaded.routeObjects?.[0];
    const indexRoute = rootRoute?.children?.find((route) => route.index);
    const usersRoute = rootRoute?.children?.find(
      (route) => route.id === "routecraft:users" && route.path === "users",
    );
    const userRoute = usersRoute?.children?.find(
      (route) =>
        route.id === "routecraft:users:[userId]" && route.path === ":userId",
    );
    const userIndexRoute = userRoute?.children?.find((route) => route.index);
    const notFoundRoute = rootRoute?.children?.find(
      (route) => route.id === "routecraft:not-found",
    );

    assertHandle(
      rootRoute?.handle?.title === "应用根",
      "已安装包生成的根结构 handle eager 值不正确",
    );
    assertHandle(
      typeof indexRoute?.lazy?.handle === "function",
      "已安装包没有为首页生成 lazy handle 函数",
    );
    const lazyIndexHandle = await indexRoute.lazy.handle();
    assertHandle(
      lazyIndexHandle?.title === "首页",
      "已安装包生成的首页 lazy handle 值不正确",
    );
    assertHandle(
      userIndexRoute?.handle?.title === "用户",
      "已安装包生成的动态页面 handle eager 值不正确",
    );
    assertHandle(
      notFoundRoute?.handle?.title === "未找到",
      "已安装包生成的根 404 handle eager 值不正确",
    );
  } finally {
    await server.close();
  }
}

function assertHandle(condition, message) {
  if (!condition) throw new Error(message);
}

async function writeConsumerFiles(root, tarball) {
  const files = new Map([
    [
      "package.json",
      JSON.stringify(
        {
          name: "routecraft-package-smoke-consumer",
          private: true,
          type: "module",
          scripts: {
            typecheck: "tsc --noEmit",
            build: "vite build",
          },
          dependencies: {
            [packageManifest.name]: `file:${tarball}`,
            react: "^19.2.7",
            "react-dom": "^19.2.7",
            "react-router": minimumPeers ? "8.5.1" : "^8.5.1",
          },
          devDependencies: {
            "@types/node": "^24.0.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            "@vitejs/plugin-react": minimumPeers ? "5.0.0" : "^5.0.0",
            "@typescript-eslint/eslint-plugin": "^8.0.0",
            "@typescript-eslint/parser": "^8.0.0",
            eslint: "^10.0.0",
            typescript: minimumPeers ? "5.9.3" : "^5.9.3",
            vite: minimumPeers ? "7.0.0" : "^7.0.0",
          },
        },
        null,
        2,
      ),
    ],
    [
      "index.html",
      '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
    ],
    [
      "vite.config.ts",
      [
        'import { defineConfig } from "vite";',
        'import react from "@vitejs/plugin-react";',
        `import routecraft from "${packageManifest.name}";`,
        "",
        "export default defineConfig({",
        "  plugins: [react(), routecraft({ devTools: true })],",
        "});",
        "",
      ].join("\n"),
    ],
    [
      "tsconfig.json",
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            lib: ["ESNext", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "Bundler",
            moduleDetection: "force",
            strict: true,
            skipLibCheck: false,
            isolatedModules: true,
            jsx: "react-jsx",
            noUnusedLocals: true,
            noUnusedParameters: true,
            noEmit: true,
            verbatimModuleSyntax: true,
            types: ["vite/client", "node"],
          },
          include: ["src", "vite.config.ts"],
        },
        null,
        2,
      ),
    ],
    [
      "src/main.tsx",
      [
        'import { createRoot } from "react-dom/client";',
        'import { createBrowserRouter } from "react-router";',
        'import { RouterProvider } from "react-router/dom";',
        'import { routeObjects } from "virtual:routecraft/routes";',
        "",
        "createRoot(document.getElementById('root')!).render(",
        "  <RouterProvider router={createBrowserRouter(routeObjects)} />,",
        ");",
        "",
      ].join("\n"),
    ],
    [
      "src/routes/page.tsx",
      "export default function Home() { return <main>Package smoke test</main>; }\n",
    ],
    [
      "src/routes/layout.handle.ts",
      "export const handle = { title: '应用根' };\n",
    ],
    [
      "src/routes/handle.ts",
      "export const handle = { title: '首页' };\n",
    ],
    [
      "src/routes/route.config.ts",
      "export default { lazy: { layoutHandle: false, handle: true, notFoundHandle: false } };\n",
    ],
    [
      "src/routes/not-found.tsx",
      "export default function NotFound() { return <main>Not found</main>; }\n",
    ],
    [
      "src/routes/not-found.handle.ts",
      "export const handle = { title: '未找到' };\n",
    ],
    [
      "src/routes/users/[userId]/page.tsx",
      "export default function User() { return <main>User</main>; }\n",
    ],
    [
      "src/routes/users/[userId]/handle.ts",
      "export const handle = { title: '用户' };\n",
    ],
    [
      "src/routes/users/[userId]/route.config.ts",
      "export default { lazy: { handle: false } };\n",
    ],
    [
      "src/routecraft.type-contract.ts",
      [
        'import { href } from "virtual:routecraft";',
        'import type { RoutePath } from "virtual:routecraft/routes";',
        "",
        'const path: RoutePath = "/";',
        "const url: string = href('/');",
        'const userUrl: string = href("/users/:userId", { userId: "user-1" });',
        "// @ts-expect-error 未登记的路径必须被拒绝。",
        "href('/missing');",
        "// @ts-expect-error 无参数路由不接受参数对象。",
        'href("/", {});',
        "// @ts-expect-error 动态路由必须提供参数对象。",
        'href("/users/:userId");',
        "// @ts-expect-error 动态路由必须提供正确的参数名。",
        'href("/users/:userId", { id: "user-1" });',
        "",
        "void [path, url, userUrl];",
        "",
      ].join("\n"),
    ],
  ]);

  for (const [relativePath, content] of files) {
    const filePath = join(root, relativePath);
    const parent = dirname(filePath);
    if (parent !== root) {
      await mkdir(parent, { recursive: true });
    }
    await writeFile(filePath, content, "utf8");
  }
}

async function readDevtoolsSnapshot(server, port) {
  const endpoint = `http://127.0.0.1:${port}/__routecraft/data`;
  let lastError;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Vite 消费项目开发服务器提前退出，退出码：${server.exitCode}`);
    }
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`DevTools 数据接口返回 HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }

  throw new Error(`等待 DevTools 数据接口超时：${String(lastError)}`);
}
