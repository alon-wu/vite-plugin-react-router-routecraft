/** 示例应用自己的路由元信息契约；Routecraft 不内建或推导这些业务字段。 */
export interface AppRouteHandle {
  title: string;
  breadcrumb?: string;
}

/** 从 React Router 当前匹配链中选择最近的标题，由应用负责更新浏览器标题。 */
export function getDocumentTitle(handles: readonly unknown[]): string {
  const currentTitle = [...handles].reverse().find(isAppRouteHandle)?.title;

  return currentTitle
    ? `${currentTitle} | Routecraft 示例`
    : "Routecraft 示例";
}

function isAppRouteHandle(value: unknown): value is AppRouteHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    typeof value.title === "string" &&
    value.title.trim().length > 0
  );
}
