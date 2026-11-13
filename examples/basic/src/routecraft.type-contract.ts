import { href } from "virtual:routecraft";
import type { RoutePath, RouteId } from "virtual:routecraft/routes";

// 该文件由示例项目的 TypeScript 检查一起验证，不参与运行时逻辑。
const staticPath: RoutePath = "/auth/sign-in";
const dynamicPath: RoutePath = "/workspace/projects/:projectId";
const dynamicHref: string = href("/workspace/projects/:projectId", {
  projectId: "project-42",
});
const staticHref: string = href("/auth/sign-in");
const routeId: RouteId = "routecraft:(workspace):workspace:projects:[projectId]:index";

// @ts-expect-error 未登记的路径必须被类型系统拒绝。
href("/not-a-route");

// @ts-expect-error 动态路由必须提供对应参数。
href("/workspace/projects/:projectId");

// @ts-expect-error 参数名称必须与目录动态段一致。
href("/workspace/projects/:projectId", { id: "project-42" });

// @ts-expect-error 不存在的路由 ID 必须被类型系统拒绝。
const invalidRouteId: RouteId = "routecraft:missing";

void [staticPath, dynamicPath, dynamicHref, staticHref, routeId, invalidRouteId];
