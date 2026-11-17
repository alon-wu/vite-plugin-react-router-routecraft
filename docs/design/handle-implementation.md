# handle 支持实现清单

依据：同目录的 `handle-support.md`。不改版本、不自动提交或发布。

## 1. 扫描与路由合同

- [x] 在 scanner、config、exports、route-tree 测试中添加新合同，先观察缺少功能导致的失败。
- [x] 扫描 handle、layout.handle、not-found.handle 的 TS/TSX 文件，沿用重复文件诊断。
- [x] 扩展 lazy 配置，静态校验运行时 handle 导出、页面关联与根 404 关联。
- [x] 将模块挂到正确的 `modules.handle`，保持路径、ID 和既有模块行为。

## 2. 编译与运行时

- [x] 先补 eager/lazy 混合编译、真实路由器匹配读取和 DevTools 测试。
- [x] 复用编译器生成静态 handle 或 lazy.handle，不执行应用元信息。
- [x] 补文件增删改的 Vite 刷新回归与 DevTools 的只读来源展示。

## 3. 示例、文档和消费者

- [x] 示例提供页面、结构、404 元信息、自定义类型和动态标题，覆盖 TSX 与 eager/lazy。
- [x] 同步目录规则、配置、加载说明、架构、完整示例与 AI 指引。
- [x] 扩展包消费者验证，确保生成的类型声明继续通过 TS/ESLint 社区规则检查。

## 4. 最终验证

- [x] `npm run typecheck`、`npm run example:build`
- [x] `npm run verify`
- [x] `npm run test:pack`
- [x] `npm run test:pack:min`
- [x] `npm run docs:build`
- [x] `npm run pack:check`
- [x] `git diff --check`

## 本轮验证记录

验证日期：2026-11-16。

- `npm test -- tests/unit/scanner.test.ts tests/unit/config.test.ts tests/unit/exports.test.ts tests/unit/route-tree.test.ts tests/unit/compile-routes.test.ts tests/integration/vite-plugin.test.ts tests/integration/example-project.test.ts`：7 个测试文件、49 项测试通过。
- 测试先行记录：新增示例路由映射断言首次运行时有 2 项失败，原因是示例尚无页面/结构/404 handle；新增标题选择断言首次运行时因 `getDocumentTitle` 尚未实现而失败。补齐应用示例后，集成测试 6 项通过。
- `npm run typecheck`：通过。
- `npm run verify`：通过；含类型检查、覆盖率测试（13 个文件、70 项）、包构建与示例生产构建。
- `npm run example:build`：示例 TypeScript 检查与 Vite 生产构建通过。
- `npm run test:pack`：安装当前 tarball 的消费项目类型检查、生产构建、生成声明 ESLint 检查、已安装包运行时 handle 断言及 DevTools 路由元数据断言通过。
- `npm run test:pack:min`：同一消费者流程在最低 peer 版本组合（Vite 7.0.0、React Router 8.5.1）通过；消费者 SSR 检查服务器关闭了不必要的依赖自动发现，测试输出无取消构建提示。
- `npm run docs:build`：通过。
- `npm run pack:check`：在最新消费者脚本改动后通过；打包清单包含生成产物及随包文档。
- `git diff --check`：通过。
- `tests/skills/routecraft-file-routing.md` 是人工 Skill 行为评估集；已增加 handle 与动态标题用例，但本轮没有在外部支持 Agent Skill 的助手/隔离消费项目中执行该人工评估。
- [ ] 在隔离消费项目中实际运行新增的人工 Skill 行为用例。
- 环境记录：包消费者相关命令首次在受限环境下因 npm 缓存目录权限失败；获准在沙箱外重跑后通过。npm 提示 esbuild 安装脚本尚未获准，但 Vite 生产构建和消费者检查均成功。
- 未提交、未推送、未修改版本，也未执行发布。
