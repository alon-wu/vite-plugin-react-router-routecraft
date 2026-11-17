# 架构总览

Routecraft 的目标是让实际运行的路由、TypeScript 看见的路由契约和 DevTools 展示的路由树来自同一次扫描及同一份中间表示，避免多套逻辑分别解释文件系统。

## 系统边界

![Routecraft 从 Vite 配置到路由对象、类型声明和 DevTools 的生成链路；React Router 消费和执行生成结果。](/images/routecraft-pipeline.svg)

| 参与者 | 职责 |
| --- | --- |
| Routecraft | 解析配置、扫描并校验约定文件、构造 Route IR、生成虚拟模块与声明文件，并可提供开发期只读检查页。 |
| Vite | 管理插件生命周期、模块解析和加载、文件变化通知及应用构建。 |
| React Router | 消费 `RouteObject[]`，负责 URL 匹配、导航、loader/action 调用、中间件调度和 UI 渲染。 |
| 应用开发者 | 提供页面组件、数据处理、业务验证和受信任的服务端安全措施。 |

**Routecraft 生成路由定义；React Router 执行路由。** 插件不提供新的路由运行时。

## 一次扫描、多个消费者

![scanner、route-tree、IR 与三个输出消费者的顺序关系。](/images/routecraft-compiler.svg)

1. **配置归一化**：`src/vite/options.ts` 将 `routesDir` 与 `typesDir` 相对 Vite `root` 解析为绝对路径，并确定声明文件名。
2. **目录扫描**：`src/core/scanner.ts` 递归读取路由目录，以稳定顺序识别约定文件；跳过私有/隐藏子目录，并收集诊断。
3. **语法和模块校验**：`src/core/segments.ts` 解析静态段、动态段、splat 和 route group；`src/core/config.ts` 静态解析 `route.config.ts`；`src/core/exports.ts` 使用 TypeScript AST 检查所需导出，不执行用户模块。
4. **建立 Route IR**：`src/core/route-tree.ts` 把扫描结果组合为父子节点、文件到 Route Object 属性的映射，并检测冲突和无效组合。
5. **三个消费者**：`src/core/compile-routes.ts` 生成路由虚拟 ESM 模块；`src/core/generate-types.ts` 生成声明；`src/devtools/data.ts` 序列化诊断和显示所需的路由元数据。
6. **Vite 适配**：`src/vite/plugin.ts` 调用这些纯逻辑模块，维护快照，暴露虚拟模块、监听变化、在开发期挂接 DevTools。

## Route IR：生成契约的唯一共同输入

定义在 `src/core/ir.ts` 的 `RouteIR` 是生成阶段使用的中间表示：

- `RouteNode` 包含节点 `id`、种类、来源目录、计算路径、可选 `path`/`index`、Route Object 属性映射与子节点。
- `RouteModuleRef` 保留源码文件、需要的导出名、生成目标属性，以及该属性是否 lazy。
- 页面、结构和 not-found 元信息都以普通 `RouteModuleRef` 表示：`handle.ts` 对应页面 index route，`layout.handle.ts` 对应目录结构 route，根 `not-found.handle.ts` 对应根 not-found route。
- `MiddlewareModuleRef` 保存 middleware 源文件和 `middleware` 导出名；当前实现将 middleware 静态导入。
- `RouteIR` 汇总共同根节点、生成的路由 ID、可访问页面路径和诊断。

它不是 `RouteObject[]` 的简单复制：IR 还保留源路径及加载决定，便于类型输出与诊断。路由对象、类型信息、DevTools 都从这棵统一树读取，不应各自重新扫描目录。

Routecraft 不在 IR 中解释 handle 的业务结构，也不运行或序列化其导出值。应用可自行定义 `AppRouteHandle` 并用 TypeScript `satisfies` 检查；例如标题更新、面包屑选择或权限判断都属于应用代码。

## 目录如何成为多布局路由树

![route group、URL segment、layout 和 page index route 在 Routecraft 与 React Router 中的对应。](/images/routecraft-route-mapping.svg)

Routecraft 为路由根产生共同的 pathless 根对象；`(auth)`、`(workspace)` 等 route group 也是无 path 的结构节点；普通目录生成 URL segment route；`page.tsx` 生成该目录对应的 index route。布局附着在目录结构路由的 `Component`，React 组件需通过 `<Outlet />` 渲染子页面。

因此多个 group 可以各自拥有布局，合并进单一 `routeObjects`，供一个 `createBrowserRouter(routeObjects)` 使用。route group 只提供嵌套和布局边界，不贡献 URL 片段。

## Lazy 的代码生成边界

![Component、loader、action 等实现属性可分别选择静态导入或 route.lazy 动态导入；path、index、id、children 和 middleware 保持静态。](/images/routecraft-lazy-properties.svg)

`src/core/compile-routes.ts` 遍历 IR 节点并生成源码：

- eager 模块被收集为静态 namespace import，其导出绑定到 route 对象字段。
- lazy 模块不成为静态导入；其对应字段被放进 React Router `lazy` 函数返回的属性集合。
- handle 按 IR 指定的节点和加载方式输出为 `handle` 或 `lazy.handle`；`handle`、`layoutHandle`、`notFoundHandle` 分别配置，不由组件的 lazy 设置推导。
- 匹配所需的 `id`、`path`、`index`、`children` 直接写在 route 对象上。
- 没有相应文件时 IR 不含模块引用，因此也不生成 loader/action 等空字段。
- middleware 当前始终静态导入。

加载选项定义于 `src/types.ts` 的 `RouteLazyConfig`，默认值在目录构树时由 `defaultLazy` 提供，`route.config.ts` 的静态字面量覆盖单个目录内的对应属性。对应用而言，`useMatches()` 提供当前匹配链；Routecraft 不合并链上的 handle，也不负责 `document.title` 更新。详见 [Lazy、loader 与 action](/guides/lazy-and-data)。

## 类型输出与虚拟模块的分工

| 产物 | 物理文件 | 消费者 | 代码位置 |
| --- | --- | --- | --- |
| `virtual:routecraft/routes` | 无需同名磁盘文件；Vite `resolveId`/`load` 提供源码 | Vite 应用模块图 | `src/vite/virtual-modules.ts`、`src/vite/plugin.ts`、`src/core/compile-routes.ts` |
| `virtual:routecraft` | 无需同名磁盘文件；插件提供轻量 `href()` 源码 | Vite 应用模块图 | `src/core/route-paths.ts`、`src/vite/plugin.ts` |
| `typed-router.d.ts` | **真实文件**，由插件写入 `typesDir` | TypeScript 语言服务和类型检查器 | `src/core/generate-types.ts`、`src/vite/plugin.ts` |
| `/__routecraft` 与 JSON 数据端点 | 不进入生产应用文件 | Vite 开发服务器与开发者浏览器 | `src/devtools/` |

虚拟模块解决“构建期从插件获得代码”；声明文件必须落盘，TypeScript 才能静态解析虚拟模块名称和路由类型。两者由同一份 IR 生成。

## 错误诊断和失败策略

诊断统一采用 `src/core/diagnostics.ts` 定义的 `RoutecraftDiagnostic`：稳定代码、`error`/`warning`/`info` 级别、消息、文件、路由路径和可选建议。路由树汇总目录扫描、配置、导出、段语法和公开 URL 冲突的诊断。

- 有 error 时插件不把有错误的 IR 编译成“成功”快照；生产构建报错并终止。
- 开发服务器将诊断写入 Vite 日志，DevTools 快照可呈现错误原因。
- 未注册的保留文件名和特殊目录按当前实现产生 warning，并跳过，不生成路由节点。
- 修复错误后重新扫描，重新生成路由和声明文件。

## 开发期变更和刷新

1. `configureServer` 将 `routesDir` 加入 Vite watcher。
2. `handleHotUpdate` 仅处理该目录下且不是生成声明文件本身的事件。
3. 插件重新扫描并生成新的 route snapshot。
4. 成功时失效相关虚拟模块、通过 Vite WebSocket 广播更新并触发完整页面刷新；这使应用重新创建路由器。
5. DevTools 的 HTML 与 JSON 端点从当前内存快照读取数据。

这是**整页刷新**，不是 React Router 实例的原地热替换。启用工具的说明见[DevTools 指南](/guides/devtools)。

## 依据与源码追踪

Route Object 的匹配和嵌套模型见 React Router 官方[路由配置](https://reactrouter.com/start/data/routing)及 [Route Object API](https://reactrouter.com/start/data/route-object)。虚拟模块钩子见 [Vite 插件 API](https://vite.dev/guide/api-plugin#virtual-modules-convention)。实际实现文件、测试位置与逐步调用关系列于[模块与代码映射](/architecture/modules)。
