# Routecraft

**Routecraft** 是一个 Vite 插件：按约定目录生成 React Router v8 Data Mode 的 `RouteObject[]`，自动更新路由类型声明，并在开发期提供独立 DevTools 页面。

> Routecraft 面向 React Router Data Mode；接入前请确认项目使用的 React Router 与 Vite 版本符合 peer dependency 要求。Routecraft 不实现 React Router Framework Mode，也不提供服务端鉴权或数据运行时。

**文档站：**[Routecraft 文档](https://alon-wu.github.io/vite-plugin-react-router-routecraft/) · [完整示例](https://alon-wu.github.io/vite-plugin-react-router-routecraft/examples/complete-app) · [架构设计](https://alon-wu.github.io/vite-plugin-react-router-routecraft/architecture/)

## 特性

- Next.js App Router 风格的目录与 `page.tsx`、`layout.tsx` 约定，但仅实现可对应到 React Router Data Mode 的语义；
- 路由组 `(group)`、私有目录 `_private`、`[param]` 动态段及末尾 `[...parts]` splat；
- 多分支、多布局；不同 route group 可各自拥有 layout；
- 组件、loader、action、错误边界与 hydration fallback 逐属性选择 eager/lazy；
- 不存在的 loader/action 不生成空属性或虚假导入；
- 生成 `typed-router.d.ts`，声明路由 ID、URL 参数及类型化 `href` 辅助；
- 可关闭的开发期路由树、加载方式和诊断 UI。

## 仓库内文档

- [灵机一动：项目起点与原始设计方案](docs/design/routecraft-design.md)
- [配置指南](docs/guides/configuration.md)
- [目录路由约定](docs/guides/routing-conventions.md)
- [DevTools 指南](docs/guides/devtools.md)

## 试用示例

仓库中的 `examples/basic` 是用于插件自动化验证的精简夹具，不是完整产品教程。完整、具体的应用级示例请阅读[项目管理台完整示例](https://alon-wu.github.io/vite-plugin-react-router-routecraft/examples/complete-app)。

从源码运行仓库内的集成示例：

```sh
npm install
npm run build
cd examples/basic
npm install
npm run dev
```

打开 Vite 地址查看应用；开发服务器运行时可在同一主机打开 `/__routecraft` 查看路由树和诊断。应用路由入口使用方式：

```tsx
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routeObjects } from "virtual:routecraft/routes";

const router = createBrowserRouter(routeObjects);
```

`virtual:routecraft/routes` 是 Routecraft 插件提供的 Vite 虚拟模块，不是 React Router 自带 API。Vite 的 `resolveId`/`load` 钩子将该导入编译为当前路由树；TypeScript 声明则写入配置的 typesDir。

## 在 Vite 项目中配置

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

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `routesDir` | `src/routes` | 相对于 Vite 项目根目录的路由根 |
| `typesDir` | `src/types` | `typed-router.d.ts` 输出目录 |
| `defaultLazy` | `true` | 约定模块的默认懒加载策略 |
| `devTools` | `false` | 是否启用开发期 DevTools |

## 开发与验证

```sh
npm install
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run pack:check
```

`npm run verify` 会执行类型检查、自动化测试和构建；`npm run pack:check` 仅预览 npm 包内容，不会发布。源代码注释与项目文档以中文编写。

## 已知边界

- `loading.tsx` 不会自动建立导航 loading UI；应用可用 React Router 的 `useNavigation()` 实现。
- `hydrate-fallback.tsx` 只用于 React Router 初始 hydration fallback，不等于 Next.js `loading.tsx`。
- 根 `middleware.ts` 位于共同合成路由根，影响所有分支。middleware 不是服务端安全边界。
- `[...parts]` 使用 React Router splat 的 `params["*"]` 字符串语义，不等价于 Next.js catch-all 字符串数组；`[[...parts]]` 不支持。
- 不提供 Next.js Server Components、Server Actions、HTTP Route Handler、Parallel/Intercepting Routes、Next metadata 或 Framework Mode typegen。
- `useLoaderData()` 的业务返回值类型不做跨文件自动推导。

详见[目录规则与语义边界](docs/guides/routing-conventions.md)。
