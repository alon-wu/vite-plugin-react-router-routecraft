/** 可在目录级 route.config.ts 中使用的懒加载覆盖项。 */
export interface RouteLazyConfig {
  layout?: boolean;
  layoutLoader?: boolean;
  layoutAction?: boolean;
  layoutHandle?: boolean;
  page?: boolean;
  loader?: boolean;
  action?: boolean;
  handle?: boolean;
  notFoundHandle?: boolean;
  error?: boolean;
  hydrateFallback?: boolean;
}

/** route.config.ts 只接受静态字面量配置，不会执行该文件。 */
export interface RouteConfig {
  lazy?: RouteLazyConfig;
}

/** Routecraft Vite 插件配置。 */
export interface RoutecraftOptions {
  /** 路由目录，相对于 Vite 项目根目录。 */
  routesDir?: string;
  /** typed-router.d.ts 输出目录，相对于 Vite 项目根目录。 */
  typesDir?: string;
  /** 路由实现模块默认是否采用动态导入。 */
  defaultLazy?: boolean;
  /** 是否启用开发期独立 DevTools 页面。 */
  devTools?: boolean;
}
