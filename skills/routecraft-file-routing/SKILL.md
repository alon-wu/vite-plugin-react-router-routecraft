---
name: routecraft-file-routing
description: "在 Vite 项目中使用 vite-plugin-react-router-routecraft 规划、新建、修改或排查页面与文件路由时使用；适用于目录路由、布局、动态段、loader/action、handle 元信息和 lazy 配置。不要把这些约定套用到未使用 Routecraft 的普通 React Router 项目。"
---

# Routecraft 文件路由

使用本 Skill 帮助维护者在现有 Vite 项目中按 Routecraft 约定组织页面与 React Router Data Mode 路由。Routecraft 是路由配置生成插件，不是新的路由运行时。

## 工作流程

1. **先检查项目现状。** 查看 `package.json` 中 Routecraft、React Router 和 Vite 的实际版本；检查 `vite.config.*` 中的 `routesDir`、`typesDir`、`defaultLazy` 与 `devTools`；检查现有路由入口及路由目录。不要假定默认目录，也不要覆盖用户已有的路由器或布局。
2. **按实际安装版本核对规则。** 在用户项目中，先从项目根目录检查 `node_modules/vite-plugin-react-router-routecraft/docs/guides/` 下的 `routing-conventions.md`、`lazy-and-data.md`、`configuration.md` 和 `type-generation.md`；npm 包将 `docs/` 随包发布。若该路径不存在（例如使用未物化 `node_modules` 的包管理器），先从项目依赖解析 `vite-plugin-react-router-routecraft` 的实际安装位置，再到该包目录下查找 `docs/guides/`，不要去猜插件仓库在用户机器上的位置。若正在 Routecraft 源码仓库中工作，则阅读仓库的 `docs/guides/`。若安装包内没有这些文档，不要把文档站上的最新版说成与安装版本一致；说明版本资料缺失，并以已安装版本、项目实际配置和本 Skill 的规则速查为准，无法确认时再请求补充信息。
3. **先规划目标路由，再做最小改动。** 沿用当前目录风格、已有布局及命名。任务涉及 URL 冲突、多个可能的布局归属或会影响多条路由时，先向用户说明冲突和选项。
4. **只创建需要的约定文件。** `page` 是页面入口；`layout` 是结构路由布局；`loader`、`action`、错误边界和 hydration fallback 都按实际需求添加。不要生成空 loader/action 或无需求的占位模块。
5. **需要路由元信息时先确定目标节点。** `handle.ts` 只能与同目录页面配套，进入页面 index route；`layout.handle.ts` 进入当前目录结构 route，即使没有 `layout.tsx`；根 `not-found.handle.ts` 只能与根 `not-found.ts`/`.tsx` 配套，进入根 catch-all not-found route。三者都只提供命名导出 `handle`。
6. **由应用拥有 handle 契约和消费逻辑。** 应用可定义 `AppRouteHandle` 并在各 handle 模块中使用 `satisfies`。需要标题、面包屑等行为时，由应用通过 React Router 的 `useMatches()` 读取当前匹配链并自行选择、合并或更新 `document.title`；不要把这些行为描述为插件自动提供，也不要假定父子 handle 会自动合并。
7. **逐项核对 handle 加载方式。** `route.config.ts` 的 `handle`、`layoutHandle`、`notFoundHandle` 分别控制三类 handle 的 eager/lazy 方式；它们与 `page`、`layout`、`loader` 等设置相互独立。只使用直接布尔字面量，不把页面组件的配置复制成 handle 配置。
8. **遵循插件生成边界。** 应用路由入口使用已安装版本文档所示的 Routecraft 虚拟模块；不要手写替代生成路由表，也不要手动编辑自动生成的 `typed-router.d.ts`。
9. **验证改动。** 根据项目 `package.json` 中存在的脚本运行相关类型检查和构建。若扫描错误、类型错误或构建错误，先修复再报告；不要声称未执行的验证已通过。

## 必须避免的误用

- 不要仅凭文件名或目录名推断 Routecraft 功能。未列入当前版本约定的文件和目录不会自动获得路由、数据或渲染语义；遇到警告时应依据 Routecraft 文档解释，不要模拟实现。
- 不要把 route group 当成独立 Router。它用于同一棵路由树中的无 URL 路径结构分组；多个分支可以有不同布局，但生成结果仍交给应用现有的 React Router 实例。
- 不要把 Routecraft middleware 描述成服务端鉴权边界。浏览器端路由与 middleware 不能代替服务端授权。
- 不要在 `page.tsx` 中额外导出 `handle` 来代替约定文件；Routecraft 只从 `handle.ts`、`layout.handle.ts` 和根 `not-found.handle.ts` 读取 handle。
- 不要让插件承担标题切换、面包屑合并、SEO/head 管理或 handle 业务字段校验；这些属于应用代码。
- 如果用户项目没有安装 Routecraft，先确认用户希望接入插件还是只讨论路由设计；不要悄悄安装依赖或重写当前路由方案。

## 参考资料

- Routecraft 的具体文件映射、命名约束和不支持的语义：[`references/routecraft-rules.md`](references/routecraft-rules.md)。
