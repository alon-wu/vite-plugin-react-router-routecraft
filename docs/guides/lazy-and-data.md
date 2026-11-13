# Lazy、loader 与 action

本页把三个不同问题分开说明：哪些 Route Object 属性存在、属性所指模块如何加载、React Router 何时调用数据处理函数。Routecraft 只负责生成对象结构与 import 方式；业务行为仍由 React Router 和应用代码决定。

## 1. loader/action 是可选模块

约定文件与命名导出如下：

| 约定文件 | 必需导出 | 属性目标 |
| --- | --- | --- |
| `loader.ts`（需同目录 `page`） | `export const loader = ...` | 页面 index route 的 `loader` |
| `action.ts`（需同目录 `page`） | `export const action = ...` | 页面 index route 的 `action` |
| `layout.loader.ts`（需同目录 `layout`） | `export const loader = ...` | 当前目录结构 route 的 `loader` |
| `layout.action.ts`（需同目录 `layout`） | `export const action = ...` | 当前目录结构 route 的 `action` |

若文件不存在，Routecraft **不生成对应属性**，不插入 `undefined`、空函数或占位 import。若存在 `loader.ts`/`action.ts` 却没有同目录页面，或存在 layout 数据模块却没有同目录 layout，会在构建前报错。

```text
routes/projects/page.tsx + loader.ts
  → projects 路径节点的 children
      → index route { loader, Component }

routes/projects/layout.tsx + layout.loader.ts
  → projects 路径节点 { loader, Component, children }
```

## 2. 一条路由上可以混合 eager 和 lazy

插件级 `defaultLazy` 是没有被目录覆盖的模块属性默认值；`route.config.ts` 用静态布尔字段逐项覆盖。配置只影响本目录对应的 route 模块。

```ts
// 与 layout.tsx 共置的 route.config.ts
import type { RouteConfig } from "vite-plugin-react-router-routecraft";

export default {
  lazy: {
    layout: false, // 布局组件静态导入
    layoutLoader: false, // 布局 loader 静态导入
    page: true, // 页面组件由 lazy 属性动态导入
    loader: false, // 页面 loader 静态导入
    action: true, // 若有 action.ts，则其 action 由 lazy 属性动态导入
    error: true,
    hydrateFallback: false,
  },
} satisfies RouteConfig;
```

### 可配置字段

| 配置键 | 目标属性 | 是否要求文件存在 |
| --- | --- | --- |
| `layout` | `layout.tsx` 的 `Component` | 无文件时忽略，不创建组件。 |
| `layoutLoader` | `layout.loader.ts` 的 `loader` | 无文件时忽略。 |
| `layoutAction` | `layout.action.ts` 的 `action` | 无文件时忽略。 |
| `page` | `page.tsx` 的 `Component` | 无页面时不会生成页面。 |
| `loader` | `loader.ts` 的 `loader` | 无文件时忽略。 |
| `action` | `action.ts` 的 `action` | 无文件时忽略。 |
| `error` | `error.tsx` 的 `ErrorBoundary` | 无文件时忽略。 |
| `hydrateFallback` | `hydrate-fallback.tsx` 的 `HydrateFallback` | 无文件时忽略。 |

Routecraft 在 AST 层读取 `route.config.ts`，不执行该文件。必须默认导出对象字面量；`lazy` 下只能是直接布尔字面量属性。允许 TypeScript `satisfies`，但只允许 `import type`。不允许依赖运行时变量、函数调用、对象展开或普通运行时 import。未知/重复字段会得到错误诊断。

## 3. 生成形式与 React Router 的关系

假设 `page: true`、`loader: false`，且两个文件均存在，Routecraft 输出的形态是：

```ts
{
  index: true,
  loader: __routecraft_module_0.loader,
  lazy: {
    Component: async () =>
      (await import("/absolute/path/to/page.tsx")).default,
  },
}
```

若反过来配置 `page: false`、`loader: true`，则静态导入页面组件，并将 loader 放进 Route Object 的对象式 `lazy` 字段。Routecraft 可独立决定 `Component`、`loader`、`action`、`ErrorBoundary` 和 `HydrateFallback`。

匹配阶段需要预先可见的 `path`、`index`、`id`、`children` 保持在 route 对象外层，不放进 lazy。`middleware.ts` 始终静态导入，不属于上述配置字段。

React Router 官方允许保留静态匹配信息，同时用 route `lazy` 延迟加载实现属性；Routecraft 的对象形状按当前仓库实现生成。参考 [React Router Route Object：lazy](https://reactrouter.com/start/data/route-object)。

## 4. loader/action 的执行与类型责任

- React Router 负责匹配后调用 `loader`/`action`、处理导航和重验证。
- Routecraft 不包装这些函数，不把它们改造成服务端 API。
- 当前生成的 `typed-router.d.ts` **不推导**业务 `loader` 的返回对象类型。页面侧 `useLoaderData()` 可能需要显式类型说明或应用自己的类型工具。
- 在 Data Mode 浏览器路由里，loader/action 是浏览器可调用的应用代码。敏感数据、写操作及授权必须由服务端 API 再次验证；不应把客户端路由或 middleware 当作安全边界。

更多可运行的目录组合和业务示例见[完整项目示例](/examples/complete-app)。
