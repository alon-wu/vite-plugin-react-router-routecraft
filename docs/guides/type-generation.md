# 类型声明与 `href()`

Routecraft 在插件首次成功编译路由树时生成 `<typesDir>/typed-router.d.ts`。默认位置为 `src/types/typed-router.d.ts`。

## 声明文件包含什么

基于当前实现，声明文件包括：

- `"virtual:routecraft/routes"` 的模块声明及 `routeObjects: RouteObject[]`；
- `RouteId` 路由 ID 字符串联合类型；
- `RoutePath` 可访问页面的路径联合类型；
- `ParamsFor<P>` 页面路径参数对象类型；
- `"virtual:routecraft"` 的 `href(path, params?)` 类型签名。

`RoutePath` 从页面 index route 收集，不代表每个纯布局/前缀 route；根 `not-found.tsx` 生成的 `/*` fallback 也不是页面 index path，不包含在该联合中。

## 使用类型化路径辅助

```ts
import { href } from "virtual:routecraft";

const home = href("/");
const project = href("/workspace/projects/:projectId", {
  projectId: "proj-42",
});
```

路径字符串受生成联合约束；缺少必要参数或参数名错误会触发 TypeScript 错误。底层 URL 插值调用 React Router 的 `generatePath`，不是 Routecraft 重写路由匹配。

## 安装 TypeScript 声明

确认 `tsconfig.json` 的 `include` 覆盖类型输出目录。标准 Vite React TS 模板的 `src` 包含规则通常已涵盖默认目录。

```json
{
  "include": ["src"]
}
```

如果你把 `typesDir` 放到 `src` 之外，需明确将其加入 `include`：

```json
{
  "include": ["src", "route-types"]
}
```

## 管理生成文件

生成声明是真实磁盘文件，因为 TypeScript 语言服务需能读取它；路由对象则通过 Vite 虚拟模块提供。**不要手动编辑** `typed-router.d.ts`。可将其纳入版本控制，以便编辑器在首次运行 Vite 前也能解析 `virtual:` 导入，但需要确保它随路由变化重新生成且没有陈旧内容。

插件只在生成内容改变时改写文件。扫描失败时，构建会失败并报告诊断；不应以旧声明仍存在为由认为新路由已通过校验。

## 类型边界

`RouteId`、URL 路径及 URL 参数类型来自路由树。业务 loader/action 参数及返回值由 React Router 的类型签名约束，但当前 Routecraft 不从任意用户 loader 实现推断 `useLoaderData()` 的具体结果类型。
