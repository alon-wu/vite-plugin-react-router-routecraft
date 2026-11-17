# 目录与文件约定

Routecraft 扫描 Vite 项目中配置的路由根目录，将约定文件编译为 React Router Data Mode 的路由对象树。本文说明 Routecraft 实际识别的目录、文件、校验规则及生成结果；未列出的文件不会被当作路由约定处理。

## 路由根目录与扫描范围

- `routesDir` 是路由文件扫描根目录，默认值为 `src/routes`，可在 Vite 插件配置中改为其他相对或绝对路径。
- 根目录自身代表共同路由根；它的约定文件作用于所有路由分支。
- 普通子目录按路径层级递归扫描。以下划线 `_` 或点 `.` 开头的目录及其全部后代会被跳过。
- 未包含 Routecraft 约定文件、也没有包含有效路由后代的普通目录不会生成路由节点。
- 扫描仅识别下表所列的 `.ts` / `.tsx` 文件；数据模块、中间件和目录配置只接受 `.ts`。
- 扫描结果按目录名排序，以确保生成结果稳定。`.d.ts` 文件（包括自动生成的 `typed-router.d.ts`）会被忽略。

## 目录段规则

| 目录名 | Routecraft 解释 | 生成的路径 |
| --- | --- | --- |
| `workspace/` | 静态路径段 | `workspace` |
| `[projectId]/` | 动态路径段；参数名须为合法 TypeScript 标识符 | `:projectId` |
| `[...parts]/` | 末尾通配路径段；参数名须为合法 TypeScript 标识符 | `*` |
| `(account)/` | 无 URL 路径的结构分组；名称仅用于组织目录 | 不生成 `path` |
| `_private/`、`.hidden/` | 私有或隐藏实现目录；整个子树跳过 | 不生成路由 |

### 静态段

静态目录名只允许 ASCII 字母、数字、下划线和连字符，即 `A-Z`、`a-z`、`0-9`、`_`、`-`。例如 `sign-in`、`workspace_v2` 合法；空格、点号和其他字符不符合当前校验规则。

### 动态段

以一对方括号包裹参数名，例如 `[projectId]`。参数名遵循 TypeScript 标识符格式。Routecraft 将其转换为 React Router 动态段；实际匹配参数由 React Router 提供给路由组件和数据函数。

### 通配段

`[...parts]` 将生成 React Router 的 `*` 路径段，读取值时使用 `params["*"]`。该目录必须是路由路径的最后一段，不能包含有效路由后代。`[[...parts]]` 不属于支持的目录语法。

### 结构分组

`(account)` 这样的目录会生成一个不含 `path` 的父路由节点。组名不出现在 URL 中，但节点可保留父子关系、目录级布局和中间件作用范围。不同分组若生成相同的可访问 URL，仍会发生路由冲突；分组名不会使 URL 唯一。

### 私有和隐藏目录

以下划线或点开头的目录会连同其后代一起排除在扫描之外。可用它们存放不会参与路由生成的实现文件。

## 约定文件与路由对象映射

Routecraft 会将同一目录内的文件按职责放到对应的路由节点上。页面是当前路径的索引子路由；布局、边界组件和中间件附着在目录对应的结构路由上。

| 文件 | 导出要求 | 对应结果 |
| --- | --- | --- |
| `page.tsx` / `page.ts` | 默认导出页面组件 | 在当前目录路径下生成 `{ index: true, ... }` 子路由，并将组件映射到 `Component` 或 `lazy`。 |
| `layout.tsx` / `layout.ts` | 默认导出布局组件 | 映射为当前目录结构路由的 `Component` 或 `lazy`。布局需要渲染 `<Outlet />` 才能呈现子路由。 |
| `error.tsx` / `error.ts` | 默认导出错误边界组件 | 映射为当前结构路由的 `ErrorBoundary` 或 `lazy`。 |
| `hydrate-fallback.tsx` / `hydrate-fallback.ts` | 默认导出组件 | 映射为当前结构路由的 `HydrateFallback` 或 `lazy`，用于 hydration fallback。 |
| 根目录 `not-found.tsx` / `not-found.ts` | 默认导出组件；仅允许置于路由根 | 在共同路由根下生成 `path: "*"` 的通配叶子路由。 |
| `loader.ts` | 命名导出 `loader`；需同目录页面 | 映射为页面索引路由的 `loader`。 |
| `action.ts` | 命名导出 `action`；需同目录页面 | 映射为页面索引路由的 `action`。 |
| `layout.loader.ts` | 命名导出 `loader`；需同目录布局 | 映射为目录结构路由的 `loader`。 |
| `layout.action.ts` | 命名导出 `action`；需同目录布局 | 映射为目录结构路由的 `action`。 |
| `handle.ts` / `handle.tsx` | 命名导出 `handle`；需同目录页面 | 映射为页面索引路由的 `handle`。 |
| `layout.handle.ts` / `layout.handle.tsx` | 命名导出 `handle` | 映射为当前目录结构路由的 `handle`；无需存在 `layout.tsx`。 |
| 根目录 `not-found.handle.ts` / `.tsx` | 命名导出 `handle`；需根目录 `not-found.ts` / `.tsx` | 映射为根 `path: "*"` not-found 路由的 `handle`；仅允许放在路由根。 |
| `middleware.ts` | 命名导出 `middleware` | 映射为当前结构路由的 `middleware` 数组，始终静态导入。 |
| `route.config.ts` | 默认导出静态配置对象 | 调整当前目录受支持模块属性（包括三类 handle）的 eager/lazy 方式；本身不生成路由属性。 |

若约定组件文件或数据模块缺少必需导出、数据模块没有对应页面/布局、配置文件放置位置错误，Routecraft 会输出错误诊断。约定文件不能在同一目录重复出现 `.ts` 和 `.tsx` 两种版本。

### Handle 元信息文件的目标节点

handle 是应用提供给 React Router 的路由元信息。Routecraft 只识别文件、检查是否有命名导出 `handle`，并将这个导出挂到对应 Route Object；它不读取或解释 `title`、`breadcrumb` 等业务字段，也不会自动修改页面标题、合并父子 handle、执行权限判断或提供 SEO 管理。

```text
routes/
├── page.tsx
├── handle.ts                 → 根路径 index route.handle
├── layout.handle.ts          → 共同根结构 route.handle
├── (auth)/
│   ├── layout.handle.ts      → pathless 分组结构 route.handle
│   └── auth/
│       └── sign-in/
│           ├── page.tsx
│           └── handle.ts     → /auth/sign-in 的 index route.handle
├── not-found.tsx
└── not-found.handle.ts       → 根 path: "*" 路由.handle
```

`handle.ts` 必须与 `page.ts` / `page.tsx` 共置，否则会报告孤立 handle；`layout.handle.ts` 可单独为有子路由的目录或 route group 提供结构元信息，不要求对应布局组件；根 `not-found.handle.ts` 必须与根 not-found 页面共置，且非根目录不支持该约定。三类文件都只接受命名导出 `handle`，类型导出不算运行时导出；对应约定同时存在 `.ts` 和 `.tsx` 时会报重复文件诊断。

handle 文件不参与插件路径和 Route ID 的推导，也不生成页面。它只给已经确定的目标节点增加 `handle` 属性。应用可以自行定义业务契约并在模块中用 `satisfies` 校验，例如在 `src/routes/workspace/projects/handle.ts` 中：

```ts
import type { AppRouteHandle } from "../../../types/app-route-handle";

export const handle = {
  title: "项目详情",
  breadcrumb: "项目",
} satisfies AppRouteHandle;
```

若应用用 `useMatches()` 更新 document title，需由应用从当前匹配链中选择并使用相应 handle；`useMatches()` 不会把父子 handle 自动合并。懒加载的 handle 在其路由 lazy 模块加载前不应被当作完整的静态导航数据。加载策略分别由 `route.config.ts` 的 `handle`、`layoutHandle` 和 `notFoundHandle` 控制，详见[Lazy、loader 与 action](/guides/lazy-and-data)。

### 页面、布局与多分支

页面始终编译为其目录路径下的索引子路由。因此一个路径段可以同时拥有 `layout`、`page` 和更深层的路由后代。例如：

```text
src/routes/
├── (auth)/
│   └── auth/
│       ├── layout.tsx
│       ├── sign-in/
│       │   └── page.tsx
│       └── sign-up/
│           └── page.tsx
└── (workspace)/
    └── workspace/
        ├── layout.tsx
        ├── page.tsx
        └── projects/
            └── [projectId]/
                └── page.tsx
```

上例形成两个共享共同路由根的分支：认证分支由 `auth/layout.tsx` 包裹，工作区分支由 `workspace/layout.tsx` 包裹；各分支仍由应用创建的同一个 React Router 实例管理。`(auth)` 和 `(workspace)` 仅用于组织结构，不进入公开 URL。示意映射如下：

```text
共同路由根
├── pathless group
│   └── path: "auth"        Component: AuthLayout
│       ├── path: "sign-in"  └── index: true, Component: SignIn
│       └── path: "sign-up"  └── index: true, Component: SignUp
└── pathless group
    └── path: "workspace"  Component: WorkspaceLayout
        ├── index: true, Component: WorkspaceHome
        └── path: "projects"
            └── path: ":projectId"
                └── index: true, Component: ProjectDetails
```

对应的 URL 分别为 `/auth/sign-in`、`/auth/sign-up`、`/workspace` 和 `/workspace/projects/:projectId`。此图省略自动生成的 `id`、模块导入和数据属性；完整对象形状取决于每个模块的 lazy 配置。

## 可选数据模块与逐属性懒加载

`loader.ts`、`action.ts`、`layout.loader.ts` 和 `layout.action.ts` 都是可选的。文件不存在时，生成对象中不会出现对应属性，也不会创建空函数或占位导入。页面组件、布局、数据函数、错误边界和 hydration fallback 可分别选择 eager 或 lazy。

- 插件选项 `defaultLazy`（默认 `true`）为未被目录配置覆盖的模块属性提供默认值。
- 同目录 `route.config.ts` 的 `lazy` 对象可用 `true` / `false` 分别覆盖 `layout`、`layoutLoader`、`layoutAction`、`page`、`loader`、`action`、`handle`、`layoutHandle`、`notFoundHandle`、`error`、`hydrateFallback`。
- 目录配置只影响该目录中实际存在的相应文件；不存在的模块不会产生属性。
- `middleware.ts` 始终静态导入，不接受 lazy 配置。
- 路由匹配需要的 `id`、`path`、`index` 和 `children` 保持在路由对象静态部分。

配置只允许默认导出静态对象字面量，`lazy` 的每项必须是直接的布尔字面量；只允许 `import type`，不执行配置文件。完整例子和字段行为见 [Lazy、loader 与 action](/guides/lazy-and-data)。

## 冲突与错误规则

- 同一 URL 形状只能对应一条可访问路由。`users/[id]` 与 `users/[slug]` 会被视为相同路径形状并产生错误；动态参数名不同不构成区分。
- 路由组不进入 URL，因此不同组下相同的 URL 也会冲突。
- 同一路径中不能重复使用同一个动态参数名。
- 通配段必须处于路径末尾。
- `not-found` 约定文件仅允许放在路由根。
- 不识别的普通文件不会创建路由。`loading`、`template`、`route`、`default` 等保留名称的文件，以及 `@` 或以 `(.)`、`(..)`、`(...)` 开头的目录，会作为不支持的约定跳过并产生警告；不会被转换成其他功能。

有错误诊断时，插件不会将存在错误的部分结果伪装为有效路由表；请先处理 DevTools 或构建输出中的诊断。

## 生成结果由谁负责

Routecraft 负责扫描、校验并生成 React Router Data Mode 可消费的路由对象；URL 匹配、数据函数调用、中间件调度和 UI 渲染由 React Router 执行。`loader`/`action` 的业务返回值不会被跨文件推导为组件专属类型；Data Mode 中的业务代码也不因此获得服务端安全边界。

查看 [完整项目示例](/examples/complete-app) 了解一组端到端目录和业务代码；查看[架构设计](/architecture/)了解扫描器、路由中间表示与生成器的实现关系。
