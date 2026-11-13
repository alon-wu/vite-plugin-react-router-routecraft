# 安装与快速开始

本文从 Vite React TypeScript 项目开始，依次完成插件配置、路由文件创建、类型声明接入和浏览器验证。示例严格使用当前仓库公开 API。

## 1. 环境要求

| 依赖 | 要求 |
| --- | --- |
| Node.js | `>=22.22.0`（插件 `package.json` 的 `engines.node`） |
| Vite | `^7.0.0`（插件 peer dependency） |
| React Router | `^8.5.1`，使用 Data Mode API |
| TypeScript | `^5.9.3`（插件运行依赖；宿主项目也需配置 TypeScript） |
| React / React DOM | 与宿主 React Router 版本匹配；仓库示例使用 `^19.2.7` |

Routecraft 不会安装 React、React DOM、`@vitejs/plugin-react` 或应用所需的类型包；这些由 Vite 宿主应用负责。

## 2. 安装方式

### npm 发布之后

当前仓库标记为未发布。包发布后，在 Vite React 项目中安装：

```sh
npm install react react-dom react-router
npm install -D vite @vitejs/plugin-react typescript
npm install -D vite-plugin-react-router-routecraft
```

发布后的准确版本、peer dependency 要求和 npm 安装命令以 npm 包页面及本仓库 `package.json` 为准。

### 当前仓库试用

无需在应用中猜测包名是否已发布。克隆本仓库后，直接运行自带集成示例：

```sh
npm install
npm run build
npm --prefix examples/basic install
npm --prefix examples/basic run dev
```

在输出的本地地址访问示例应用。启用了 DevTools 时，再访问该地址下的 `/__routecraft`。

如果要在自己的应用试用未发布版本，可在仓库根目录先构建 npm tarball，再把 tarball 路径安装进应用：

```sh
# 在 Routecraft 仓库根目录
npm pack

# 在你的 Vite 应用目录；将路径替换为实际生成的 tarball 绝对或相对路径
npm install -D /path/to/vite-plugin-react-router-routecraft-0.1.0.tgz
```

这会测试 npm 包实际包含的文件，而不是直接从源码目录导入。

## 3. 配置 Vite 插件

在 `vite.config.ts` 中将 Routecraft 放入插件数组：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import routecraft from "vite-plugin-react-router-routecraft";

export default defineConfig({
  plugins: [
    react(),
    routecraft({
      routesDir: "src/routes",
      typesDir: "src/types",
      defaultLazy: true,
      devTools: true,
    }),
  ],
});
```

此时 `src/routes` 必须存在。第一次启动或构建时，插件扫描文件、检查路由模块导出，成功后写入 `src/types/typed-router.d.ts`。若扫描或校验失败，修复诊断中的文件/规则后再启动。

## 4. 创建第一条路由

```text
src/
├── main.tsx
├── router.ts
└── routes/
    └── page.tsx
```

`src/routes/page.tsx`：

```tsx
export default function HomePage() {
  return <h1>欢迎使用 Routecraft</h1>;
}
```

约定页面文件使用默认导出 React 组件。`page.tsx` 表示所在目录的 index route；路由目录规则详见[目录与文件约定](/guides/routing-conventions)。

## 5. 将虚拟路由表交给 React Router

`src/router.ts`：

```ts
import { createBrowserRouter } from "react-router";
import { routeObjects } from "virtual:routecraft/routes";

export const router = createBrowserRouter(routeObjects);
```

`src/main.tsx`：

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";

const root = document.getElementById("root");
if (!root) throw new Error("找不到 #root 挂载节点。");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

### 虚拟模块到底是什么

`virtual:routecraft/routes` 是应用源码中的普通 ESM 导入标识符，但对应文件由插件在 Vite 的 `resolveId` 和 `load` 钩子中动态提供，不会要求你在磁盘上创建同名文件。只有经过配置 Routecraft 的 Vite 开发服务器或构建过程，这个 import 才能被解析。不要把它写成 `react-router` 的 import。

```text
src/router.ts 的 import
        │
        ▼
Routecraft Vite 插件 resolveId / load
        │
        ▼
扫描结果编译出的 routeObjects
        │
        ▼
createBrowserRouter(routeObjects)
```

## 6. 声明文件和 TypeScript

将类型声明输出目录纳入 `tsconfig.json`。常见 Vite React TS 配置已包含 `src`；如果项目使用自定义 `include`，确保它包含 `src/types/typed-router.d.ts`：

```json
{
  "include": ["src"]
}
```

该 `.d.ts` 是插件生成文件，不应手工编辑。它声明 `virtual:routecraft/routes` 和 `virtual:routecraft` 模块、当前路由 ID、页面 URL 参数与 `href()` 签名。它不会从业务 loader 实现中推导 `useLoaderData()` 返回对象的字段类型。

## 7. 确认插件运行

```sh
npm run dev
npm run build
npx tsc --noEmit
```

在开发服务器中启用 `devTools: true` 后打开 `/__routecraft`，核对路径、布局层级、源文件及每项属性的 eager/lazy 状态。DevTools 仅挂接开发服务器；生产包不会提供该页面。

## 下一步

- [配置参考](/guides/configuration)
- [目录约定与支持边界](/guides/routing-conventions)
- [Lazy、loader 与 action](/guides/lazy-and-data)
- [项目管理台完整示例](/examples/complete-app)

## 官方参考

- [Vite 插件与虚拟模块](https://vite.dev/guide/api-plugin#virtual-modules-convention)
- [React Router Data Mode 路由配置](https://reactrouter.com/start/data/routing)
