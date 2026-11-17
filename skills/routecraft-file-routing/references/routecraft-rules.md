# Routecraft 路由规则速查

本文件是给 Agent Skill 使用的短版规则说明。它随 Skill 一起安装到用户项目中，可在无法读取完整指南时提供基本规则；涉及版本特性时，仍须核对用户实际安装的插件版本。

## 在用户项目中定位完整指南

Routecraft 的 npm 包将 `docs/` 目录一并发布。安装在应用项目中时，通常可直接查阅：

- `node_modules/vite-plugin-react-router-routecraft/docs/guides/routing-conventions.md`：目录、文件名、冲突和支持边界；
- `node_modules/vite-plugin-react-router-routecraft/docs/guides/lazy-and-data.md`：loader/action、布局数据模块及逐属性懒加载；
- `node_modules/vite-plugin-react-router-routecraft/docs/guides/configuration.md`：插件配置；
- `node_modules/vite-plugin-react-router-routecraft/docs/guides/type-generation.md`：生成声明与 `href()`。

如果项目没有上述直达路径，应从应用项目解析已安装包的位置，再在包根目录下查找 `docs/guides/`；不要假定用户本地存在 Routecraft 源码仓库。先核对应用锁文件或已安装包元数据中的 Routecraft 版本。文档站可能对应更新的仓库内容，不能在未确认版本一致时当作安装版本的权威规则。完整指南不可用时，以本文件的规则和项目中实际安装版本的行为为依据；超出已知范围的功能应明确标记为未确认，不要猜测。

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
| `handle.ts` / `.tsx` | 需要同目录页面；命名导出 `handle` 进入页面 index route。 |
| `layout.handle.ts` / `.tsx` | 命名导出 `handle` 进入当前目录结构 route；不要求有 layout 组件。 |
| 根 `not-found.handle.ts` / `.tsx` | 需要根 `not-found` 页面；命名导出 `handle` 进入根 not-found route。 |

普通目录可以代表嵌套路由段；是否生成页面由约定文件与路由后代决定。不要仅凭目录存在就假设它是一个可访问页面。

## 可选数据与加载方式

- `loader.ts`、`action.ts` 需要同目录 `page.ts`/`page.tsx`，分别导出命名的 `loader` / `action`；文件缺失时不生成对应属性。
- `layout.loader.ts`、`layout.action.ts` 需要同目录 layout。
- `route.config.ts` 是静态配置，只能用支持的直接布尔值覆盖 eager/lazy 选择；不可依赖运行时变量或执行配置代码。
- `handle`、`layoutHandle`、`notFoundHandle` 分别控制三类 handle 模块的 eager/lazy 方式，与页面和布局组件的设置相互独立。
- 页面、布局及支持的组件/数据属性可以按配置分别 eager 或 lazy；middleware 保持静态导入。具体字段以该版本 `lazy-and-data.md` 为准。

## Handle 与应用标题

Routecraft 只检查 handle 模块是否提供命名导出 `handle`，并把该导出挂到对应 React Router route；不解析对象字段，也不提供标题、面包屑或权限业务逻辑。应用应自行定义例如 `AppRouteHandle` 的类型，并可用 `satisfies` 校验对象。

需要动态标题时，应用在自己的布局组件中调用 `useMatches()`，从当前匹配链读取 `match.handle`，按应用规则选择标题，再由 `useEffect` 更新 `document.title`。父子 handle 不会由插件自动合并；lazy handle 在加载前也不是完整静态导航数据。

## 当前实现边界

- `loading`、`template`、`route`、`default` 等保留文件名不会创建路由功能；扫描器会跳过并给出警告。
- `@`、以 `(.)`、`(..)`、`(...)` 开头的目录及可选通配语法 `[[...parts]]` 不受支持。
- 插件不提供服务端组件、服务端操作、HTTP 请求处理器、框架级 metadata 或 React Router Framework Mode。
- `[...parts]` 按 React Router splat 规则读取 `params["*"]` 字符串。
- `useLoaderData()` 的业务返回值类型不做跨文件自动推导。
- middleware 不是可信的服务端鉴权机制。
- handle 只允许上述三个文件约定；不要把页面组件中的额外 `handle` 导出描述为 Routecraft 会自动收集。
- 插件不会自动更新 `document.title`，也不会解析或序列化 handle 的实际业务值。

遇到未支持的目录或文件约定时，应说明 Routecraft 当前边界，并提出可行的 React Router Data Mode 方案；不得通过新增同名文件暗示功能已经实现。
