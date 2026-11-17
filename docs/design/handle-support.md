# 路由 handle 支持设计

本文记录已确认的路由元信息设计，适用于 Routecraft 的 React Router Data Mode 文件路由。

## 文件与目标节点

| 约定文件 | 必需命名导出 | 目标 | 限制 |
| --- | --- | --- | --- |
| `handle.ts` / `handle.tsx` | `handle` | 同目录页面的 index 路由 | 需要同目录 `page.ts` / `page.tsx` |
| `layout.handle.ts` / `layout.handle.tsx` | `handle` | 当前目录结构路由；根目录对应共同根 | 不要求存在布局组件 |
| `not-found.handle.ts` / `not-found.handle.tsx` | `handle` | 根目录的 `path: "*"` 路由 | 仅根目录允许，需要根 not-found 组件 |

同一约定不能同时存在 `.ts` 与 `.tsx`。文件缺省时不生成 `handle` 属性，不从页面组件额外收集 `handle` 导出。类型导出不算运行时导出。

## 加载与配置

`route.config.ts` 只解析静态配置，不存放 handle 对象、不执行应用代码：

```ts
export default {
  lazy: {
    handle: false,
    layoutHandle: true,
    notFoundHandle: false,
  },
};
```

三项分别控制对应的元信息模块，缺省时继承插件级 `defaultLazy`。与 Component、loader、action 的加载方式相互独立。不存在模块时不生成占位属性。

Eager 使用静态导入和 `handle: module.handle`；lazy 使用现有对象式 `lazy.handle`。匹配字段仍静态生成。

## 架构

```text
约定文件 → scanner → 导出/关联校验 → Route IR modules.handle
                                      ├─ compile-routes → RouteObject.handle / lazy.handle
                                      └─ DevTools → 来源、目标节点、加载方式
```

复用 `RouteModuleRef`，扩展 `RouteProperty`，不额外引入元信息运行时、字段解析器或路由树后处理。DevTools 不导入、执行或序列化 handle 的实际值。

## 类型与应用边界

- 保持 `routeObjects: RouteObject[]` 和原有路径、ID、href 声明契约。
- 应用定义自己的元信息类型，在 handle 模块中使用 `satisfies` 校验。
- 插件不强制 title、breadcrumb 等字段，不自动修改 document.title，不提供权限执行和 SEO/head 管理。
- `useMatches()` 仅返回当前匹配链；父子 handle 不自动合并；lazy handle 在加载前不可当作完整静态菜单数据。
- 新功能不自动修改包版本，也不代表已发布。

## 验收

覆盖 TS/TSX、三种节点、根与分组、无布局结构节点、孤立/重复/类型导出诊断、独立加载、默认继承、真实路由器读取、DevTools 安全快照、文件增删改刷新，以及声明回归和打包消费者。同步使用文档、完整示例和 AI 指引；保留原有 URL 与 ID 规则。
