# 发布文档站到 GitHub Pages

仓库使用 VitePress 生成静态站点，并由 GitHub Actions 部署到仓库 Pages。站点源码在 `docs/`，构建产物位于 `docs/.vitepress/dist/`。

## 首次启用（仓库维护者操作一次）

在 GitHub 仓库打开 **Settings → Pages → Build and deployment**，将 **Source** 设为 **GitHub Actions**。不要选 `Deploy from a branch`，本仓库的 workflow 使用 Pages 部署 API 上传构建产物。

## 自动部署触发条件

`.github/workflows/docs.yml` 在以下情况运行：

- 推送到 `main` 且改动包含 `docs/**`、文档 workflow、根 `package.json` 或 `package-lock.json`；
- 在 Actions 页面手动运行 `Deploy documentation` workflow。

任务先执行 `npm ci`、配置 Pages 和 `npm run docs:build`，成功后上传 `docs/.vitepress/dist` 并部署 Pages。构建失败不会覆盖现有的已发布站点。

## 本地预览

```sh
npm install
npm run docs:dev
```

生产模式构建和预览：

```sh
npm run docs:build
npm run docs:preview
```

本仓库 Pages 子路径配置为 `/vite-plugin-react-router-routecraft/`，生产构建里的站内链接和图片资源会使用此前缀。

官方参考：[VitePress 部署指南](https://vitepress.dev/guide/deploy)、[GitHub Pages 自定义 workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 仓库迁移时需要修改的配置

如果仓库改名或转移 owner，需要同步修改：

1. `docs/.vitepress/config.ts` 中 `base` 和 GitHub 链接；
2. `package.json` 中 `homepage`；
3. `README.md` 中文档站链接；
4. 本 workflow 的默认分支触发名称（若默认分支不再是 `main`）。

GitHub Pages 发布本身由 GitHub 执行；在本地成功构建只能证明静态站点生成通过，不能证明远端仓库设置、Actions 权限和实际部署已完成。
