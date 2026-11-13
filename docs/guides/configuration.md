# 配置参考

Routecraft 通过 `routecraft(options)` 创建 Vite 插件实例。当前公开选项由 [`src/types.ts`](https://github.com/alon-wu/vite-plugin-react-router-routecraft/blob/main/src/types.ts) 定义，并由 `src/vite/options.ts` 解析。

## 完整配置

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
      devTools: false,
    }),
  ],
});
```

## 选项表

| 选项 | 类型 | 默认值 | 实际作用 |
| --- | --- | --- | --- |
| `routesDir` | `string` | `"src/routes"` | 路由扫描根目录；相对路径以 Vite `root` 为基准，也接受绝对路径。目录不存在时产生错误诊断。 |
| `typesDir` | `string` | `"src/types"` | `typed-router.d.ts` 输出目录；相对路径以 Vite `root` 为基准，插件会递归创建目录。 |
| `defaultLazy` | `boolean` | `true` | 尚未在当前目录 `route.config.ts` 覆盖的每个路由模块属性的默认值。 |
| `devTools` | `boolean` | `false` | 是否注册开发期 `/__routecraft` HTML 页和 `/__routecraft/data` JSON 端点。 |

### `routesDir`

扫描根目录的根约定文件可包括 `middleware.ts`、`hydrate-fallback.tsx`、`page.tsx` 和 `not-found.tsx`。具体识别规则见[目录与文件约定](/guides/routing-conventions)。点开头和下划线开头的子目录会被跳过；生成的 `.d.ts` 也不会参与路由识别。

### `typesDir`

输出文件固定命名为 `typed-router.d.ts`，不能通过选项修改文件名。生成使用内容比对和临时文件重命名，只有内容变化时才覆盖目标文件。若输出目录位于路由目录内部，扫描器仍忽略声明文件，但建议将声明放在路由实现目录之外以保持项目清晰。

### `defaultLazy`

默认值是 `true`。该选项不是一个只能整页切换的二选一：`route.config.ts` 可以分别覆盖布局、页面、loader、action 等实现属性。不存在的模块不会生成虚假的 Route Object 属性。详见[Lazy、loader 与 action](/guides/lazy-and-data)。

### `devTools`

默认为关闭。打开后 DevTools 只通过 Vite `configureServer` 开发服务器中间件提供；插件不会将工具页面、API 或专用浏览器客户端加入生产构建。

## Vite 插件顺序

现有示例将官方 `@vitejs/plugin-react` 放在 Routecraft 之前：

```ts
plugins: [react(), routecraft({ devTools: true })]
```

Routecraft 本身设置 `enforce: "pre"`。应用仍需按 Vite/React 的正常方式配置 JSX 转换、依赖和其他插件。

## 错误行为

- 路由根目录不存在、特殊文件导出缺失、配置语法无效或公开 URL 冲突：生成错误诊断；生产构建失败，不输出有效外观的部分路由表。
- `route.config.ts` 只读取静态对象字面量，不执行配置模块。
- `loading.tsx`、`template.tsx`、`route.tsx`、`default.tsx` 等未实现的约定名称会产生警告并被跳过，不会自动转换为其他功能。
- 支持项和“不支持”边界以[目录规则表](/guides/routing-conventions#routecraft-当前实现规则)为准。

## 当前 peer 范围

仓库 `package.json` 当前声明：

```json
{
  "engines": { "node": ">=22.22.0" },
  "peerDependencies": {
    "vite": "^7.0.0",
    "react-router": "^8.5.1"
  }
}
```

这是本仓库当前包元数据，不是对未来发布版本的承诺。安装前请核对所用 Routecraft 版本的实际 peer dependency。
