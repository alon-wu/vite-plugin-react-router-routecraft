# Routecraft 路由规则速查

本文件是给 Agent Skill 使用的短版索引。**实际改动前必须以用户项目安装版本随包提供的文档为准**；Routecraft 源码仓库文档仅在开发该仓库或没有可用安装文档时使用。

优先查阅：

- `docs/guides/routing-conventions.md`：目录、文件名、冲突和支持边界；
- `docs/guides/lazy-and-data.md`：loader/action、布局数据模块及逐属性懒加载；
- `docs/guides/configuration.md`：插件配置；
- `docs/guides/type-generation.md`：生成声明与 `href()`。

## 目录到路由

| 项目结构 | Routecraft 语义 |
| --- | --- |
| `page.tsx` / `page.ts` | 默认导出页面组件；生成当前目录路径的 index route。 |
| `layout.tsx` / `layout.ts` | 默认导出布局组件；附着到当前结构 route，布局需渲染 `<Outlet />`。 |
| `(group)/` | 无 URL `path` 的结构父路由；组名不进入 URL。不同分组若生成相同 URL，仍会冲突。 |
| `_private/`、`.hidden/` | 整个目录子树不扫描。 |
| `[projectId]/` | 动态路径段，映射到 `:projectId`。 |
| `[...parts]/` | 末尾 splat，映射到 `*`；读取方式遵循 React Router 的 `params["*"]` 字符串语义。 |
| `error.tsx` | 对应 route 的 `ErrorBoundary`。 |
| `hydrate-fallback.tsx` | 对应 route 的 `HydrateFallback`，不等于导航 loading UI。 |
| 根目录 `not-found.tsx` | 生成根 catch-all fallback；仅允许出现在路由根。 |

普通目录可以代表嵌套路由段；是否生成页面由约定文件与路由后代决定。不要仅凭目录存在就假设它是一个可访问页面。

## 可选数据与加载方式

- `loader.ts`、`action.ts` 需要同目录 `page.ts`/`page.tsx`，分别导出命名的 `loader` / `action`；文件缺失时不生成对应属性。
- `layout.loader.ts`、`layout.action.ts` 需要同目录 layout。
- `route.config.ts` 是静态配置，只能用支持的直接布尔值覆盖 eager/lazy 选择；不可依赖运行时变量或执行配置代码。
- 页面、布局及支持的组件/数据属性可以按配置分别 eager 或 lazy；middleware 保持静态导入。具体字段以该版本 `lazy-and-data.md` 为准。

## 当前实现边界

- `loading`、`template`、`route`、`default` 等保留文件名不会创建路由功能；扫描器会跳过并给出警告。
- `@`、以 `(.)`、`(..)`、`(...)` 开头的目录及可选通配语法 `[[...parts]]` 不受支持。
- 插件不提供服务端组件、服务端操作、HTTP 请求处理器、框架级 metadata 或 React Router Framework Mode。
- `[...parts]` 按 React Router splat 规则读取 `params["*"]` 字符串。
- `useLoaderData()` 的业务返回值类型不做跨文件自动推导。
- middleware 不是可信的服务端鉴权机制。

遇到未支持的目录或文件约定时，应说明 Routecraft 当前边界，并提出可行的 React Router Data Mode 方案；不得通过新增同名文件暗示功能已经实现。
