# `routecraft-file-routing` 行为测试

本文件是人工运行的提示词评估集，不是只检查 Markdown 字符串的单元测试。每次调整 Skill 的触发描述、规则或参考文档后，使用支持 Agent Skills 的编码助手在临时 Vite + React Router 项目中逐项测试，并记录助手实际生成的文件、解释与验证结果。

## 执行要求

1. 使用临时项目或隔离分支，不在真实应用中直接试验。
2. 正向用例应安装 Routecraft，并配置一个非默认 `routesDir`，以检验助手是否读取配置。
3. 将“不应发生”项作为硬性失败；对需要修改文件的用例，检查最终文件树和构建结果，而不只看助手的口头说明。
4. 每个用例记录助手/模型、日期、是否触发 Skill、结果和失败说明；不要把单一模型的通过视为所有助手均兼容。

## 用例

### 1. 读取项目配置后新增页面（正向）

**提示词**

> 在当前 Routecraft 项目中，为 `/workspace/projects/:projectId` 增加项目详情页面。先检查现有目录、布局和 Vite 配置，再按项目既有结构添加，不要调整其他路由。

**通过条件**

- Skill 被触发；助手读取实际 `routesDir`，未假定 `src/routes`。
- 页面落在正确布局分支，使用正确的动态段约定和 `page.tsx` 默认导出。
- 没有改动不相关路由或手工编辑生成的类型文件。
- 助手运行项目中实际存在的类型检查/构建脚本，准确报告结果。

### 2. 可选 loader 与逐属性 lazy（正向）

**提示词**

> 给现有订单详情页面添加 loader，页面组件继续 eager 加载，但 loader 用 lazy。不要为它创建 action。

**通过条件**

- 助手先查当前版本的 `lazy-and-data.md` 与目录配置。
- 只添加需要的 loader 导出和配置；未创建空 action。
- 页面组件与 loader 的加载方式独立配置，且配置符合插件静态字面量规则。

### 3. 多分支不同布局（正向）

**提示词**

> 认证页面使用空白布局，工作区页面使用主布局；它们继续由当前应用路由器统一管理。请先解释会新增的目录分支，再实现。

**通过条件**

- 通过 pathless route group 或项目已有目录模式表达不同布局。
- 布局组件保留 `<Outlet />`。
- 助手没有创建第二个 Router 实例，也没有让 group 名进入 URL。
- 助手检查并避免路由组导致的重复 URL。

### 4. 插件缺席时不套用约定（负向）

**提示词**

> 请帮我加一个 `/settings` 页面，最好用 page.tsx 和 layout.tsx。

**测试项目条件**

项目未安装 Routecraft，仅使用普通 React Router。

**通过条件**

- Skill 不应把 Routecraft 约定直接套用到项目。
- 助手先确认是要安装/接入 Routecraft，还是按当前 React Router 结构实现。
- 未经请求不安装依赖、不重写路由入口。

### 5. 拒绝伪造未实现的路由能力（负向）

**提示词**

> 在这个 Routecraft 项目里创建 `@modal/(.)photo/[id]/page.tsx`，实现多槽位并行渲染和拦截式导航。

**通过条件**

- Skill 被触发；助手说明当前 Routecraft 不支持这些目录约定，也不会由它们实现并行渲染或拦截式导航。
- 没有创建看似受支持但实际不会按该语义工作的目录。
- 助手可提出基于当前 React Router Data Mode 的替代设计，并清楚标注差异。

### 6. 路由冲突先诊断（边界）

**提示词**

> 我已经有 `users/[id]/page.tsx`，再加一个 `users/[slug]/page.tsx`，让两个页面各自独立。

**通过条件**

- 助手识别两个动态参数位置可能产生相同 URL 形状。
- 先说明冲突并询问期望行为，或提出不冲突的 URL 设计。
- 不创建第二个看似独立、实际无法区分的动态路由。

### 7. 从消费项目定位版本匹配文档（正向）

**提示词**

> 请按当前安装的 Routecraft 版本给我添加一个懒加载详情页，先确认对应的目录规则。

**测试项目条件**

该项目安装 Routecraft，但没有 Routecraft 源码仓库；包管理器在项目的 `node_modules` 中提供已安装包。

**通过条件**

- 助手先核对项目当前安装版本，再从 `node_modules/vite-plugin-react-router-routecraft/docs/guides/` 读取随包文档。
- 助手不要求用户另行克隆插件源码仓库，也不把文档站最新版默认当成与已安装版本一致。
- 如果包管理器未提供直达路径，助手会先解析实际安装位置；若无法定位或文档缺失，会明确说明，不会假装已读取。

### 8. 为页面、结构路由和 404 添加应用元信息（正向）

**提示词**

> 为首页、认证分组和 404 页面添加标题元信息。项目希望使用 `useMatches()` 根据当前匹配路由更新 document.title。认证分组没有 layout 组件。请先核对当前安装版本的 Routecraft 文档，再实现并说明加载配置。

**通过条件**

- 助手核对 Routecraft 版本和其实际文档，使用 `handle.ts`、`layout.handle.ts`、根 `not-found.handle.ts` 约定，并分别关联页面 index route、认证结构节点和根 not-found 节点。
- 助手为应用定义自己的 `AppRouteHandle` 类型，并在 handle 模块中使用 `satisfies`；不要求 Routecraft 内建或推导业务 handle 字段。
- 认证分组即使没有 `layout.tsx`，仍能通过 `layout.handle.ts` 为结构节点提供 handle。
- 助手解释 `useMatches()` 只提供当前匹配链，handle 不会自动合并；document.title 的选择和更新逻辑由应用负责。
- 对 `handle`、`layoutHandle`、`notFoundHandle` 分别配置 eager/lazy，不能假定它们跟页面组件或彼此绑定。
- 没有把 handle 的业务值、title 解析、breadcrumb 合并、权限执行或 SEO 管理描述为插件行为。
- 助手运行当前项目实际存在的类型检查与构建，并准确报告结果。
