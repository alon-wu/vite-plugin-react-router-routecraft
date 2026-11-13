# Routecraft 配置指南

## 安装与版本要求

Routecraft 面向 React Router 8 Data Mode 和 Vite 7+，要求 Node.js 22.22.0 或更高版本。使用时，宿主项目需要安装 Vite、React、React DOM 和 React Router；插件不替代它们。

```sh
npm install react react-dom react-router
npm install -D vite @vitejs/plugin-react typescript
npm install -D vite-plugin-react-router-routecraft
```

发布前阶段可在本地项目使用 `file:` 依赖指向 Routecraft 项目目录；见 `examples/basic/package.json`。

## Vite 配置

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import routecraft from "vite-plugin-react-router-routecraft";

export default defineConfig({
  plugins: [
    react(),
    routecraft({
      routesDir: "src/routes",
      typesDir: "src/types",
      defaultLazy: true,
      devTools: true,
    }),
  ],
});
```

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `routesDir` | `string` | `src/routes` | 相对于 Vite 项目根目录的目录路由根 |
| `typesDir` | `string` | `src/types` | `typed-router.d.ts` 输出目录 |
| `defaultLazy` | `boolean` | `true` | 约定模块未覆盖时的默认逐属性加载策略 |
| `devTools` | `boolean` | `false` | 是否启用仅开发期的独立检查页面 |

路径可传绝对路径或相对 Vite 根目录的路径。路由根目录必须存在；类型输出目录会自动创建。

## 应用路由入口

```ts
import { createBrowserRouter } from "react-router";
import { routeObjects } from "virtual:routecraft/routes";

export const router = createBrowserRouter(routeObjects);
```

`virtual:routecraft/routes` 是由 Routecraft Vite 插件提供的虚拟 ESM 模块，不是独立 npm 包。插件会将其编译为扫描结果对应的 RouteObject 数组。必须通过 Vite 执行构建或开发服务器，单独使用 Node.js 原生解析器不会识别该模块。

## 类型声明

插件写入 `<typesDir>/typed-router.d.ts`。确认 `tsconfig.json` 的 `include` 覆盖该目录；生成文件可纳入版本控制，但不要手工编辑。路由目录变化时，Vite 会重写该声明。

## 错误行为

配置无效、导出缺失或公开 URL 冲突会产生含稳定诊断码的错误。开发期错误显示在 Vite 诊断/DevTools 中；生产构建失败，不生成貌似有效的部分路由树。修复错误后再次构建即可重新生成。
