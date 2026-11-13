/** 生成 href 虚拟模块源码；路径插值交由 React Router 原生实现。 */
export function createHrefModuleSource(): string {
  return [
    "// Routecraft 路径辅助模块；路径规则由 React Router 处理。",
    'import { generatePath } from "react-router";',
    "",
    "export function href(path, params) {",
    "  return params === undefined",
    "    ? generatePath(path)",
    "    : generatePath(path, params);",
    "}",
    "",
  ].join("\n");
}
