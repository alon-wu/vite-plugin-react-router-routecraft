# 目录与文件约定

本文先说明 Next.js App Router 本身的约定，再划出 Routecraft 实际借鉴的组织方式，最后按 Routecraft 的扫描器和编译器规则，逐项说明目录如何生成 React Router Data Mode 路由对象。三个层次不应混为一谈。

## 1. Next.js App Router 的目录模型

Next.js App Router 以 `app/` 下的目录段构成嵌套路由。页面入口 `page` 使该段可呈现页面；`layout` 在段及其子路由之间建立持续布局；特殊文件为 loading、error、not-found、metadata、HTTP route 等提供 Next 框架级语义。

```text
app/
├── layout.tsx                   # 根布局：Next 文档壳、html/body 等
├── page.tsx                     # /
├── dashboard/
│   ├── layout.tsx               # /dashboard 子树共享布局
│   ├── page.tsx                 # /dashboard
│   └── projects/
│       └── [projectId]/
│           └── page.tsx         # /dashboard/projects/:projectId
└── (marketing)/
    └── about/
        └── page.tsx             # /about；组名不出现在 URL
```

### 1.1 页面、布局与嵌套

- **目录段**组织 URL 层级；目录名本身不是充分的页面声明。
- **`page.tsx`** 使所在路由段有页面入口。
- **`layout.tsx`** 按目录嵌套包围页面及后代；Next.js 根布局还有 HTML 文档职责，普通布局可保留跨导航状态。
- **`template.tsx`** 与 layout 的重新挂载语义不同。
- **`loading.tsx`**、**`error.tsx`** 和 **`not-found.tsx`** 在 Next.js 中是框架识别的边界文件，不只是普通 React 组件。

### 1.2 路由组、私有目录和 URL 段

- `(group)` 是 route group，用于组织路由、分组布局等，组名不进入 URL。不同组如果形成相同 URL，仍然冲突。
- `_private` 是 private folder，目录及其子树不参与路由。
- `[slug]` 是动态段。
- `[...slug]` 是 catch-all；`[[...slug]]` 是 optional catch-all。
- `@slot` 是 Parallel Routes slot，`(.)`、`(..)`、`(...)` 等用于 Intercepting Routes。这些语法需要 Next.js 的并行/拦截渲染运行时，不是普通 URL 段别名。

### 1.3 Next.js 服务端与元数据能力

App Router 中的 `route.ts` 是 HTTP Route Handler；Server Components、Server Actions、`generateMetadata`/metadata 文件、`loading` 与 `error` 边界等由 Next.js 框架编译和运行。它们不是能仅凭目录结构转换成一个通用客户端路由对象的约定。

参考：Next.js 官方[项目结构](https://nextjs.org/docs/app/getting-started/project-structure)、[页面与布局](https://nextjs.org/docs/app/getting-started/layouts-and-pages)、[动态路由段](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)。

## 2. Routecraft 借鉴什么，不移植什么

### 2.1 借鉴并重新定义为 Routecraft 规则

| 组织想法 | Routecraft 中的落地定义 |
| --- | --- |
| URL 段按目录嵌套 | 普通目录段拼接成 React Router `path`。 |
| `page` 表示页面入口 | `page.tsx`/`page.ts` 生成 React Router index route，页面组件为默认导出。 |
| 目录布局 | `layout.tsx`/`layout.ts` 附着在对应目录结构路由的 `Component`；布局组件必须渲染 `<Outlet />`。 |
| 无 URL 的路由分组 | `(group)` 编译为无 `path` 的 pathless 父路由；组名保留在 ID/来源信息，但不进入 URL。 |
| 私有实现子树 | `_private` 开头的子目录整棵跳过；点开头目录也跳过。 |
| 方括号动态段 | `[projectId]` 编译为 `:projectId`。 |
| 错误边界/fallback 模块 | `error.tsx` 映射 `ErrorBoundary`；`hydrate-fallback.tsx` 映射 `HydrateFallback`。 |
| 路由数据模块 | 可选 `loader.ts`、`action.ts` 映射对应路由对象属性，实际函数契约由 React Router 规定。 |

### 2.2 不做语义仿真的 Next 功能

| Next.js 特性 | Routecraft 处理 |
| --- | --- |
| 根布局输出 `<html>`/`<body>` | 不实现；文档壳仍由 Vite `index.html` 和 React 挂载入口负责。 |
| `loading.tsx` | 不支持；不推断自动 Suspense/loading UI。应用可使用 React Router 导航状态 API 自行呈现导航提示。 |
| `template.tsx` | 不支持。 |
| `route.ts` Route Handler | 不支持；Routecraft 不提供服务端 HTTP 处理器。 |
| Parallel/Intercepting Routes（`@slot`、`(.)` 等） | 不模拟多槽渲染或拦截路由；当前实现会跳过相关目录并产生警告。 |
| Server Components/Server Actions | 不支持；不是 Vite + React Router Data Mode 的等价路由字段。 |
| Next metadata、静态参数生成等 | 不支持；不生成 metadata 或 Next 构建工作流。 |
| Optional catch-all `[[...parts]]` | 不支持。 |

## 3. Routecraft 当前实现规则

### 3.1 文件与目录表

| 项目 | 匹配规则 | 扫描/校验要求 | 路由对象结果 |
| --- | --- | --- | --- |
| 路由根目录 | `routesDir` | 必须已存在且是目录。 | 所有扫描结果合入共同根路由对象。 |
| 页面 | `page.tsx` 或 `page.ts` | 必须有默认导出。 | 同目录结构路由的 `children` 中新增 `{ index: true, ... }`。 |
| 布局 | `layout.tsx` 或 `layout.ts` | 必须有默认导出；应渲染 `<Outlet />`。 | 当前目录结构路由的 `Component`。 |
| route group | `(name)/` | 名称仅允许 ASCII 字母、数字、`_`、`-`。 | `{ id, children }` 无 `path`；保留父子与布局边界。 |
| 私有目录 | `_name/` | 整棵子树不扫描。 | 不生成节点。 |
| 隐藏目录 | `.name/` | 整棵子树不扫描。 | 不生成节点。 |
| 静态段 | `workspace/`、`sign-in/` | 仅 ASCII 字母、数字、`_`、`-`。 | `{ path: "workspace", children: [...] }`。 |
| 动态段 | `[projectId]/` | 参数名须是合法 TS 标识符。 | `{ path: ":projectId", children: [...] }`；React Router 将其放入匹配参数。 |
| splat 段 | `[...parts]/` | 参数名须合法；必须是路由路径末尾，不能有后代段。 | `{ path: "*", children: [...] }`；匹配值按 React Router 的 `params["*"]` 字符串读取。 |
| 错误边界 | `error.tsx`/`.ts` | 默认导出组件。 | 当前结构路由 `ErrorBoundary`。 |
| Hydration fallback | `hydrate-fallback.tsx`/`.ts` | 默认导出组件。 | 当前结构路由 `HydrateFallback`。不是导航 loading 状态组件。 |
| 404 页面 | 仅路由根 `not-found.tsx`/`.ts` | 默认导出组件；放在非根目录是错误。 | 根共同路由的 `*` catch-all 叶子；不是 Next `not-found` 冒泡模型。 |
| 页面 loader/action | 同目录 `loader.ts`、`action.ts` | 分别需命名导出 `loader`/`action`；同目录必须有 `page`。 | 页面 index route 对应的属性。缺文件就省略该属性。 |
| 布局 loader/action | 同目录 `layout.loader.ts`、`layout.action.ts` | 需要同目录 layout；分别命名导出 `loader`/`action`。 | 目录结构路由对应的属性。 |
| middleware | `middleware.ts` | 必须命名导出 `middleware`；静态导入。 | 当前结构路由的 `middleware: [middleware]`；根文件放共同根。 |
| 加载配置 | `route.config.ts` | 与 `page`、`layout`、`error`、`hydrate-fallback` 或根 `not-found` 共置。只能用允许的静态配置对象。 | 影响本目录模块的独立 eager/lazy 决策，不生成 route 属性。 |
| 普通 colocated 文件 | 其他名称，如 `components.tsx`、`styles.css` | 不属于特殊文件约定。 | 不单独生成路由。 |

仅扫描 `.ts`/`.tsx` 约定文件；数据、middleware 与配置模块必须是 `.ts`，组件模块可用 `.ts` 或 `.tsx`。

### 3.2 命名约束与冲突

- 静态段只接受 `A-Z`、`a-z`、`0-9`、`_`、`-`。空格、点号、Unicode 字母等不符合当前扫描器验证规则。
- 动态段 `[id]` 内是 TS 标识符；动态参数重复名称会产生诊断。
- 动态段名称不用于区分 URL 冲突：`[projectId]` 和 `[slug]` 在相同位置属于同一 URL 形状。
- `(public)/about/page.tsx` 与 `about/page.tsx` 等若产生相同的可访问 URL，会发生冲突；组名不能防止冲突。
- `[...parts]` 有后代目录时会失败；可选 catch-all `[[...parts]]` 不支持。
- 根 `page.tsx` 生成 `/` index 页面；其他页面都生成其父路径的 index route。
- 文件夹只有普通文件、没有路由约定文件且没有路由后代时，不生成节点。

### 3.3 不支持文件警告

当前扫描器会对 Next 命名 `loading`、`template`、`route`、`default` 的 `.ts`/`.tsx` 文件显示“未模拟 Next 语义”的 warning。`@slot` 与以 `(.)`、`(..)`、`(...)` 开头的目录同样跳过并显示 warning。不要仅因文件名相似，就假设 Next.js 行为存在。

## 4. 从目录到 React Router 对象：逐级映射

React Router Data Mode 接收 `createBrowserRouter(routes)` 的 Route Object 树；path/index/children 表达匹配与嵌套，布局组件通过 `<Outlet />` 呈现子节点。索引路由是无 path 的 `{ index: true }` 子路由。见 React Router 官方[路由配置](https://reactrouter.com/start/data/routing)。

例如：

```text
src/routes/
├── (auth)/
│   └── auth/
│       ├── layout.tsx
│       └── sign-in/
│           ├── page.tsx
│           ├── loader.ts
│           └── route.config.ts
└── (workspace)/
    └── workspace/
        ├── layout.tsx
        └── projects/
            └── [projectId]/
                └── page.tsx
```

会形成如下逻辑树（省略自动生成 ID 和模块引用）：

```ts
[
  {
    // (auth) 是无 URL path 的结构父节点
    children: [
      {
        path: "auth",
        Component: AuthLayout,
        children: [
          {
            path: "sign-in",
            children: [
              {
                index: true,
                loader: signInLoader,
                lazy: { Component: /* 页面组件导入 */ },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    // 第二个 route group 不与认证分支共用布局
    children: [
      {
        path: "workspace",
        Component: WorkspaceLayout,
        children: [
          {
            path: "projects",
            children: [
              {
                path: ":projectId",
                children: [{ index: true, lazy: { Component: /* 页面组件导入 */ } }],
              },
            ],
          },
        ],
      },
    ],
  },
]
```

它代表两个不同布局分支，公开路径分别是 `/auth/sign-in` 与 `/workspace/projects/:projectId`。`(auth)`、`(workspace)` 不进入 URL。`lazy` 的具体规则见 [Lazy、loader 与 action](/guides/lazy-and-data)。

## 5. 当前实现边界摘要

Routecraft 输出数据路由配置；匹配、loader/action 调用、中间件调度和渲染由 React Router 执行。Routecraft 不实现 Framework Mode 路由模块导入/类型生成契约、不推断业务 loader 数据返回类型，也不把浏览器 middleware 当成可信服务端授权边界。

如要查看逐文件的大型项目和实际代码，请读[项目管理台完整示例](/examples/complete-app)；如要查看扫描器、IR 和生成器的代码关系，请读[架构设计](/architecture/)。
