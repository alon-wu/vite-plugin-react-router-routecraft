---
layout: home
title: Routecraft
titleTemplate: Vite 文件路由插件
hero:
  name: Routecraft
  text: 文件组织路由，React Router 负责运行
  tagline: 为 Vite + React Router Data Mode 生成可检查、可类型化的 RouteObject[]。
  actions:
    - theme: brand
      text: 开始使用
      link: /getting-started
    - theme: alt
      text: 阅读完整示例
      link: /examples/complete-app
    - theme: alt
      text: 查看架构设计
      link: /architecture/
features:
  - title: 目录到数据路由
    details: 用 page、layout、动态段和 pathless route group 表达路由树，再由 Vite 插件生成 React Router 路由对象。
  - title: 每个属性独立选择加载方式
    details: 页面、布局、loader、action、错误边界和 hydration fallback 均可分别设置 eager 或 lazy。
  - title: 可追溯的生成结果
    details: 类型声明和开发期 DevTools 都由同一份路由模型生成；错误诊断定位到冲突路径和源文件。
---

<div class="vp-doc">

## Routecraft 是什么

Routecraft 是一个 **Vite 插件**，不是新的路由运行时。它扫描配置的目录，把页面、布局及可选数据模块编译成 React Router Data Mode 接收的 `RouteObject[]`，生成 `typed-router.d.ts`，并可在开发服务器中提供 `/__routecraft` 检查页。

应用仍由 React Router 创建并运行路由器：

```tsx
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routeObjects } from "virtual:routecraft/routes";

const router = createBrowserRouter(routeObjects);

<RouterProvider router={router} />;
```

`virtual:routecraft/routes` 是 **Routecraft 插件通过 Vite 提供的虚拟模块**，不是 React Router 的导出，也不是可以直接交给 Node.js 的普通文件路径。详见[安装与快速开始](/getting-started#应用接入)。

## 版本与安装

当前源码包版本为 `0.1.0`。请通过[安装指南](/getting-started)选择 npm 发布版本、仓库示例或本地 tarball；实际可安装版本以 npm registry 页面为准。

## 从这里开始

- **首次接入：**[安装与快速开始](/getting-started)
- **查目录规则：**[目录与文件约定](/guides/routing-conventions)
- **看一个可读的完整应用：**[项目管理台示例](/examples/complete-app)
- **理解生成器如何工作：**[架构总览](/architecture/)
- **回到项目起点：**[灵机一动：原始设计方案](/design/routecraft-design)

</div>
