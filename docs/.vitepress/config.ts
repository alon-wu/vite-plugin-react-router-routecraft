import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Routecraft",
  description: "Vite + React Router 文件路由插件的正式使用文档与架构说明",
  lang: "zh-CN",
  base: "/vite-plugin-react-router-routecraft/",
  cleanUrls: true,
  srcExclude: ["superpowers/**"],
  themeConfig: {
    siteTitle: "Routecraft",
    nav: [
      { text: "开始使用", link: "/getting-started" },
      { text: "完整示例", link: "/examples/complete-app" },
      { text: "架构设计", link: "/architecture/" },
      { text: "灵机一动", link: "/design/routecraft-design" },
      {
        text: "GitHub",
        link: "https://github.com/alon-wu/vite-plugin-react-router-routecraft",
      },
    ],
    sidebar: {
      "/": [
        {
          text: "开始使用",
          items: [
            { text: "项目简介", link: "/" },
            { text: "安装与快速开始", link: "/getting-started" },
            { text: "配置参考", link: "/guides/configuration" },
          ],
        },
        {
          text: "路由规则",
          items: [
            { text: "目录与文件约定", link: "/guides/routing-conventions" },
            { text: "Lazy、loader 与 action", link: "/guides/lazy-and-data" },
            { text: "类型声明与 href", link: "/guides/type-generation" },
            { text: "开发者工具", link: "/guides/devtools" },
          ],
        },
        {
          text: "完整示例",
          items: [{ text: "项目管理台（从目录到运行）", link: "/examples/complete-app" }],
        },
        {
          text: "实现架构",
          items: [
            { text: "架构总览", link: "/architecture/" },
            { text: "模块与代码映射", link: "/architecture/modules" },
          ],
        },
        {
          text: "项目起点",
          items: [{ text: "灵机一动", link: "/design/routecraft-design" }],
        },
        {
          text: "仓库维护",
          items: [{ text: "GitHub Pages 发布", link: "/maintainers/github-pages" }],
        },
      ],
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/alon-wu/vite-plugin-react-router-routecraft",
      },
    ],
    footer: {
      message: "以当前仓库实现为准；React Router 负责运行路由，Routecraft 负责生成路由配置。",
      copyright: "Copyright © Routecraft contributors",
    },
    search: { provider: "local" },
    outline: { label: "本页目录" },
    docFooter: { prev: "上一页", next: "下一页" },
    lastUpdated: true,
  },
});
