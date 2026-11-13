import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageManifest = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const minimumPeers = process.argv.includes("--minimum-peers");
const consumerRoot = await mkdtemp(join(tmpdir(), "routecraft-package-smoke-"));
let devServer;

try {
  run(npmCommand, ["pack", "--pack-destination", consumerRoot], packageRoot);
  const tarball = join(
    consumerRoot,
    `${packageManifest.name}-${packageManifest.version}.tgz`,
  );

  await writeConsumerFiles(consumerRoot, tarball);
  run(npmCommand, ["install", "--no-audit", "--no-fund"], consumerRoot);
  // Vite 插件在构建阶段生成路由类型声明，因此必须先构建再做独立类型检查。
  run(npmCommand, ["run", "build"], consumerRoot);
  run(npmCommand, ["run", "typecheck"], consumerRoot);

  const port = 4170 + Math.floor(Math.random() * 1000);
  devServer = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: consumerRoot, stdio: "inherit" },
  );

  const snapshot = await readDevtoolsSnapshot(devServer, port);
  const rootRoute = snapshot.routes?.[0];
  const indexRoute = rootRoute?.children?.find((route) => route.kind === "index");
  if (
    snapshot.status !== "ready" ||
    snapshot.routeCount !== 2 ||
    rootRoute?.kind !== "root" ||
    indexRoute?.path !== "/" ||
    indexRoute.modules?.Component?.file !== "page.tsx"
  ) {
    throw new Error(
      `打包安装后的 DevTools 快照不符合预期：${JSON.stringify(snapshot)}`,
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
  await rm(consumerRoot, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 失败，退出码：${result.status}`);
  }
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
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            "@vitejs/plugin-react": minimumPeers ? "5.0.0" : "^5.0.0",
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
            module: "ESNext",
            moduleResolution: "Bundler",
            strict: true,
            skipLibCheck: true,
            jsx: "react-jsx",
            noEmit: true,
            types: ["vite/client"],
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
      "src/routecraft.type-contract.ts",
      [
        'import { href } from "virtual:routecraft";',
        'import type { RoutePath } from "virtual:routecraft/routes";',
        "",
        'const path: RoutePath = "/";',
        "const url: string = href('/');",
        "// @ts-expect-error 未登记的路径必须被拒绝。",
        "href('/missing');",
        "",
        "void [path, url];",
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
