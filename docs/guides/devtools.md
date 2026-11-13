# 开发者工具（DevTools）

DevTools 是 Routecraft Vite 插件的**开发期只读检查界面**。它复用插件当前编译快照，帮助确认目录扫描和 `RouteObject` 映射，不参与应用路由运行，也不替代 React Router DevTools。

## 启用和访问

```ts
routecraft({
  devTools: true,
});
```

启动 Vite 开发服务器后，在同一个 host 和 port 下打开：

- 页面：`/__routecraft`
- 只读 JSON 快照：`/__routecraft/data`

默认 `devTools: false` 时，上述路由不会注册，也不会加载 DevTools 专用客户端。

## 可以检查什么

- Route Object 的嵌套树、ID、页面 URL、index route 和 pathless route group；
- 节点来源目录、组件/loader/action/错误边界/fallback 模块；
- 每个路由属性独立的 `eager` 或 `lazy` 状态；
- middleware 文件映射；
- 类型声明文件相对路径；
- 诊断代码、级别、源文件、URL 与修复建议。

列表显示的是编译快照元数据，不会执行或展示 loader/action 的业务数据，也不返回路由源码、环境变量或绝对文件系统路径。

## 目录更改后的行为

插件监听路由根目录的文件变化。修改、增加或删除路由文件后会重新扫描和校验；成功时路由虚拟模块失效并触发页面完整刷新，DevTools 读取新的快照。失败时开发服务器报告诊断，快照会进入错误状态；修复错误后再次更新即可恢复。

## 访问控制提示

此页面只适合本地开发。Vite 开发服务器若暴露到局域网或公网，`/__routecraft/data` 也会在同一开发服务下可请求；应依照项目开发网络安全策略限制服务暴露范围。

## 代码对应

- JSON 快照序列化：`src/devtools/data.ts`
- HTML UI：`src/devtools/html.ts`
- 开发服务端点：`src/devtools/middleware.ts`
- Vite 注册、文件监听与更新：`src/vite/plugin.ts`
