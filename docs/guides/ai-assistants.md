# 使用 AI 编码助手

Routecraft 提供一个可安装的 Agent Skill，帮助 AI 编码助手在现有 Vite 项目中正确规划和维护 Routecraft 文件路由。Skill 是面向 AI 的操作指引，不会修改 Vite 插件运行时，也不会代替 React Router。

## 安装 `routecraft-file-routing`

先进入使用 Routecraft 的应用项目，再运行：

```sh
npx skills add alon-wu/vite-plugin-react-router-routecraft --skill routecraft-file-routing
```

安装工具会引导选择可用的编码助手和安装方式。默认按项目安装，便于团队共享；安装完成后请检查它新增或更新的 Skill 文件、助手目录链接和 `skills-lock.json`，只提交你希望团队共享的项目级文件。若要安装到个人环境供多个项目使用，可以加 `--global`。也可指定目标助手，例如：

```sh
npx skills add alon-wu/vite-plugin-react-router-routecraft \
  --skill routecraft-file-routing \
  --agent codex
```

`skills` 命令行工具及各 AI 助手的支持范围可能变化；请以安装时工具提供的选项为准。该命令从 GitHub 获取 Skill，不会安装或更新 `vite-plugin-react-router-routecraft` npm 依赖，也不会改写应用的 Vite 配置。

## 更新和移除

在应用项目目录中更新：

```sh
npx skills update routecraft-file-routing
```

移除项目级安装：

```sh
npx skills remove routecraft-file-routing
```

如果之前使用了全局安装，按工具提示选择全局范围或为对应目标助手移除。

## 使用示例

安装后，可以用自然语言请求 AI：

- “在当前 Routecraft 项目里，为工作区增加一个项目详情页，沿用已有布局，并使用动态项目 ID。”
- “检查这组页面的 loader 和 lazy 设置，只调整项目详情路由，不要改其他布局。”
- “根据当前 Routecraft 版本核对这个路由目录是否符合约定；遇到不支持的目录或文件约定时先解释，不要模拟实现。”

Skill 会要求助手先检查项目中 Routecraft 的实际版本、Vite 配置、路由目录和现有入口。插件完整指南随 npm 包发布，通常可在应用项目的 `node_modules/vite-plugin-react-router-routecraft/docs/guides/` 中查阅；若包管理器未提供这一直接路径，助手应先解析实际安装位置，而不是假设用户本地存在插件源码仓库。若完整指南不可用，Skill 会要求助手说明资料缺口，不把文档站最新版误称为安装版本文档。它不会替用户安装插件、覆盖现有路由架构或假设所有 React Router 项目都使用 Routecraft。

## 不使用 Skill CLI 时

可以从仓库的 `skills/routecraft-file-routing/` 目录手动安装 `SKILL.md` 及整个目录到所用 AI 助手支持的项目级或个人级 Skills 目录。各产品的目录和刷新方式不同，请查看相应助手的当前文档。

## 相关资料

- [安装与快速开始](/getting-started)
- [目录与文件约定](/guides/routing-conventions)
- [Lazy、loader 与 action](/guides/lazy-and-data)
- [配置参考](/guides/configuration)
- [类型声明与 `href()`](/guides/type-generation)
- [Agent Skills 格式规范](https://agentskills.io/specification)
- [Skills CLI 命令参考](https://github.com/vercel-labs/skills/blob/main/docs/commands.md)
