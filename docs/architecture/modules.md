# 模块与代码映射

本页将架构图中的模块映射到仓库源码，便于从某个目录入口追踪到 Vite 提供给应用的虚拟路由表。

## 源码模块清单

| 层 | 源文件 | 输入 | 输出/职责 |
| --- | --- | --- | --- |
| 公开 API | `src/index.ts`、`src/types.ts` | 调用方选项 | 插件工厂与 TypeScript 配置类型。 |
| Vite 配置适配 | `src/vite/options.ts` | Vite root、选项 | 绝对路径形式的 `ResolvedRoutecraftOptions`。 |
| 目录扫描 | `src/core/scanner.ts` | `routesDir` 文件系统 | `ScanResult`、约定文件引用及扫描诊断。 |
| 段语法 | `src/core/segments.ts` | 目录名、路径片段 | `RouteSegment`、React Router path 片段与冲突比较形状。 |
| 配置解析 | `src/core/config.ts` | `route.config.ts` 文本 | 静态 `RouteLazyConfig` 与配置错误；不执行配置模块。 |
| 模块导出分析 | `src/core/exports.ts` | TS/TSX 源码、必需导出名 | 基于 TypeScript AST 的缺失导出诊断。 |
| 诊断定义 | `src/core/diagnostics.ts` | 各阶段诊断信息 | 统一诊断结构及 `RoutecraftError`。 |
| 中间表示 | `src/core/ir.ts` | 树、模块和路径概念 | `RouteNode`、`RouteModuleRef`、`MiddlewareModuleRef`、`RouteIR`。 |
| 路由树构造 | `src/core/route-tree.ts` | 扫描结果、`defaultLazy` | 父子 Route IR、页面/布局/数据模块组合及路径冲突诊断。 |
| Route Object 编译 | `src/core/compile-routes.ts` | `RouteNode` | 静态导入、对象式 `lazy` 和 `children` 的 TS 虚拟模块源码。 |
| 类型生成 | `src/core/generate-types.ts` | `RouteIR` | 虚拟模块声明、Route ID、页面路径、参数及 `href` 签名。 |
| 路径辅助 | `src/core/route-paths.ts` | 固定的生成请求 | 导入 React Router `generatePath` 的 `href()` 虚拟模块源码。 |
| 虚拟 ID | `src/vite/virtual-modules.ts` | 模块公开名与插件内部名 | `virtual:routecraft/*` 和 Vite 内部 `\0` ID。 |
| Vite 适配层 | `src/vite/plugin.ts` | Vite hooks、resolved root、文件变更 | 扫描触发、错误上报、虚拟模块解析/加载、声明文件输出、watch/HMR 和 DevTools 注册。 |
| DevTools 数据 | `src/devtools/data.ts` | Route IR、diagnostics | 去除磁盘绝对路径后的 JSON 快照模型。 |
| DevTools UI | `src/devtools/html.ts` | 页面模板 | 开发期路由检查页。 |
| DevTools 服务 | `src/devtools/middleware.ts` | 当前快照回调、HTML 转换器 | `GET /__routecraft` 与 `GET /__routecraft/data`。 |

## 调用关系

```text
routecraft(options)
  └─ configResolved(config.root)
       └─ resolveRoutecraftOptions()

buildStart / 虚拟模块 load / 路由文件 handleHotUpdate
  └─ buildRouteTree(routesDir, { defaultLazy })
       ├─ scanRoutes()
       ├─ parseDirectorySegment()
       ├─ readRouteConfig()
       ├─ analyzeModuleExports()
       └─ RouteIR + diagnostics
            ├─ compileRouteObjects() ──► virtual:routecraft/routes
            ├─ generateTypedRouter() ──► typesDir/typed-router.d.ts
            └─ createDevtoolsSnapshot() ► /__routecraft/data
```

`buildRouteTree()` 是构建逻辑的汇合点。文件遍历和 AST 分析产生统一 IR 和诊断；它们不依赖浏览器 DOM 或 DevTools 页面模板。

## 虚拟模块与真实声明文件

| 产物 | 磁盘上是否存在 | 谁读取 | 生成/提供方 |
| --- | --- | --- | --- |
| `virtual:routecraft/routes` | 不需要存在同名文件 | Vite 模块图，最终由应用路由入口导入 | `resolveId` 将公开 id 指向内部 `\0routecraft:routes`；`load` 返回当前编译结果。 |
| `virtual:routecraft` | 不需要存在同名文件 | 导入 `href()` 的应用模块 | `resolveId`/`load` 返回 `generatePath` 封装源码。 |
| `typesDir/typed-router.d.ts` | 存在真实文件 | TypeScript 静态分析 | Routecraft 在成功生成路由树后写入，仅内容有变化才写。 |
| `/__routecraft` | 是开发服务器 HTTP 页面，不是应用源码文件 | 开发者浏览器 | `devTools: true` 时由 Vite middleware 生成/转换。 |

应用不能直接在 Node.js 原生模块解析环境中执行 `virtual:` 导入；这类 ID 由正确配置的 Vite 插件提供。

## 一个目录节点何时生成

`scanner.ts` 遍历可见子目录并识别特殊文件；对既无约定文件、也无路由后代的空目录不会保留节点。`route-tree.ts` 再按节点层级决定路由语义：

- group segment 的 `path` 为 `null`，因而生成 pathless route。
- 普通静态/动态/splat segment 生成 `path` route。
- 目录中的 `layout.tsx` 设置当前结构节点的 `Component`。
- 目录中的 `page.tsx` 另建 `index: true` 子 route。
- page 相关 loader/action 附着到 index 子 route；layout 数据文件附着到结构 route。
- 根 not-found 页面单独生成 `/*` catch-all route。

这也是 `layout.loader.ts` 与 `loader.ts` 不能混称“当前页面 loader”的原因：前者属于父结构 route，后者属于该目录页面 index route。

## 文件变化和插件快照

`src/vite/plugin.ts` 持有当前 `PluginSnapshot`，包含路由源码、Route IR 和诊断。`refresh()` 通过 `buildRouteTree()` 重建；若无 error，写类型文件并生成虚拟模块源码。开发服务监听根目录变化后，处理在根目录内的相关文件更新，刷新快照，失效虚拟模块并广播 Vite 更新事件。成功时目前发送 full reload，因此不需要把 route objects 原位更新到已实例化的 React Router。

错误时插件清空当前可编译路由快照并保留诊断，避免把旧路由冒充为新目录结构的成功编译结果。

## 测试代码位置

| 测试主题 | 测试文件 |
| --- | --- |
| 路径段语法和路由树构建 | `tests/unit/segments.test.ts`、`route-tree.test.ts` |
| 目录扫描规则 | `tests/unit/scanner.test.ts` |
| Route Object 代码生成 | `tests/unit/compile-routes.test.ts` |
| 路由类型声明生成 | `tests/unit/generate-types.test.ts` |
| 插件选项归一化 | `tests/unit/config.test.ts` |
| Vite hook/DevTools/插件接入 | `tests/integration/vite-plugin.test.ts` |
| 仓库示例编译契约 | `tests/integration/example-project.test.ts` |

如文档与这些实现或测试不一致，应在发布前先核对代码并修正相应说明。
