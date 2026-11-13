# Routecraft DevTools

在 Vite 插件选项中启用：

```ts
routecraft({ devTools: true });
```

开发服务器运行后打开 `/__routecraft`。页面包括：

- 路由树：查看 URL、index route、pathless group 和父子层级；
- 路由详情：查看稳定 ID、来源目录、模块映射、middleware；
- 加载方式：区分每个 `Component`、`loader`、`action`、错误边界与 hydration fallback 的 eager/lazy 状态；
- 类型输出位置：查看 `typed-router.d.ts` 的相对路径；
- 诊断：查看错误码、文件、公开 URL 和修复建议；
- 筛选：按 URL、ID 或来源文件过滤。

插件仅通过当前 Vite 开发服务器提供 DevTools，不注入生产构建。数据接口 `GET /__routecraft/data` 只返回路由元数据和诊断，不返回源代码、环境变量或 loader/action 数据。若开发服务器暴露在局域网或公网，应依照项目安全策略限制访问。

关闭 `devTools` 时，不注册 DevTools 页面、JSON 端点或专用 HMR 客户端。
