# 更新记录

本文件记录 Routecraft 的面向用户变更。

## 0.1.2

- 修复生成的路由类型声明中不符合 TypeScript 通用写法的问题，并增强声明文件的类型契约测试。
- 稳定 Ubuntu、Windows 和 macOS 上的跨平台验证流程。
- 恢复锁文件中的 peer 依赖元数据，确保依赖安装与发布包验证一致。

## 0.1.1

- 完善 AI 使用指南与 Skill 对已安装插件版本文档的定位说明，明确文档缺失或版本不匹配时的处理方式。

## 0.1.0

- 实现 Routecraft 目录约定到 React Router Data Mode `RouteObject[]` 的编译。
- 支持多路由组与布局、动态段、末尾 splat、可选 loader/action、错误边界、HydrateFallback 和 middleware。
- 支持按模块逐属性选择 eager/lazy，生成 `typed-router.d.ts` 和类型化 `href` 辅助接口。
- 提供目录扫描诊断、Vite HMR、可选开发期 DevTools、中文使用指南和可构建示例。
- 添加单元、集成、类型契约及覆盖率测试；升级到已审计修复的 Vitest 5.1.0。
