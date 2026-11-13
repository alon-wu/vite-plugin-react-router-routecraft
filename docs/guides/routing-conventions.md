# 目录路由约定

Routecraft 借鉴 Next.js App Router 的段目录、方括号动态段、route group、private folder、`page` 和 `layout` 命名，但输出与运行契约完全以 React Router Data Mode 为准。

## 支持的目录与特殊文件

| 输入 | 生成含义 |
| --- | --- |
| `page.tsx` / `page.ts` | 当前 URL 的 index route，默认导出组件 |
| `layout.tsx` / `layout.ts` | 当前目录结构路由的 `Component`，组件使用 `<Outlet />` 渲染子路由 |
| `(group)/` | 无 `path` 的 pathless 父路由；保留独立布局边界，不进入 URL |
| `_private/` | 排除整个目录子树 |
| `[param]/` | URL 动态段，编译成 `:param` |
| `[...parts]/` | URL 末尾 splat，编译成 `*`，运行时通过 `params["*"]` 读取字符串 |
| `error.tsx` | 对应结构路由的 `ErrorBoundary`，通过 `useRouteError()` 获取错误 |
| `hydrate-fallback.tsx` | 对应结构路由的 `HydrateFallback`，只用于初始 hydration fallback |
| `middleware.ts` | 对应结构路由的 `middleware` 数组；根目录文件挂共同合成根 |
| `loader.ts` / `action.ts` | 同目录 `page` index route 的可选数据处理函数 |
| `layout.loader.ts` / `layout.action.ts` | 同目录结构路由的可选数据处理函数 |
| `route.config.ts` | 当前目录页面/布局模块的静态逐属性 lazy 配置 |
| 未约定的普通文件 | 不生成路由，可在路由目录中 colocate |

默认导出组件/loader/action 的接口均由 React Router Data Mode 决定。Routecraft 不改写 loader、action、middleware 参数，也不执行业务模块。

## Lazy 配置

默认 `defaultLazy: true` 时，各约定模块分别按动态导入处理。可在当前目录使用 `route.config.ts` 精确覆盖：

```ts
import type { RouteConfig } from "vite-plugin-react-router-routecraft";

export default {
  lazy: {
    layout: false,
    page: true,
    loader: false,
    action: true,
    error: true,
    hydrateFallback: false,
  },
} satisfies RouteConfig;
```

每个字段只控制一项 RouteObject 属性。比如 page 组件可以 lazy、loader 可以 eager、action 可以 lazy。文件/命名导出不存在时，不会生成占位字段。`middleware.ts` 始终静态导入，不参与 lazy 配置。

Routecraft 输出 React Router v8 的对象式 lazy 形式：

```ts
{
  index: true,
  loader: eagerLoader,
  lazy: {
    Component: async () => (await import("./page.tsx")).default,
    action: async () => (await import("./action.ts")).action,
  },
}
```

匹配树必须在初始化时可见，因此 `path`、`index`、`id`、`children` 不进入 lazy。Routecraft 只输出 React Router 支持的 lazy route properties。

## 边界说明

- `layout.tsx` 是普通组件，使用 `<Outlet />`，不是 Next.js 接收 `children` 的布局契约。
- `loading.tsx` 不会自动生成 Suspense 或导航 fallback；导航状态由应用使用 `useNavigation()` 等 API 呈现。
- `hydrate-fallback.tsx` 不是 `loading.tsx` 的等价物，只用于 React Router 的初始 hydration 流程。
- `middleware.ts` 运行于当前 React Router Data Mode 应用配置中，不构成服务端安全边界。服务端 API 必须自行鉴权和授权。
- 根 `middleware.ts` 位于共同 pathless 根，影响所有 route groups；需要分支级 middleware 时放在相应 group 或 URL 目录中。
- `[...parts]` 按 React Router splat 工作，不保留 Next catch-all 的数组参数与非空约束；`[[...parts]]` 不支持。
- `route.ts`、Parallel Routes、Intercepting Routes、`template.tsx`、Next.js metadata、Server Components 等不映射到 RouteObject。
- 同一个 URL 形状不能由多个路由重复声明；route group 名和动态参数名称不用于区分冲突。
