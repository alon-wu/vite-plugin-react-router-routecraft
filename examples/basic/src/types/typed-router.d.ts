// Routecraft 自动生成的声明文件；请勿手工编辑。
declare module "virtual:routecraft/routes" {
  import type { RouteObject } from "react-router";

  export const routeObjects: RouteObject[];
  export type RouteId = "routecraft:(auth)" | "routecraft:(auth):auth" | "routecraft:(auth):auth:sign-in" | "routecraft:(auth):auth:sign-in:index" | "routecraft:(auth):auth:sign-up" | "routecraft:(auth):auth:sign-up:index" | "routecraft:(workspace)" | "routecraft:(workspace):workspace" | "routecraft:(workspace):workspace:index" | "routecraft:(workspace):workspace:projects" | "routecraft:(workspace):workspace:projects:[projectId]" | "routecraft:(workspace):workspace:projects:[projectId]:index" | "routecraft:index" | "routecraft:root";
  export type RoutePath = "/" | "/auth/sign-in" | "/auth/sign-up" | "/workspace" | "/workspace/projects/:projectId";

  type RouteParamMap = {
    "/": {};
    "/auth/sign-in": {};
    "/auth/sign-up": {};
    "/workspace": {};
    "/workspace/projects/:projectId": { "projectId": string };
  };
  export type ParamsFor<P extends RoutePath> = RouteParamMap[P];
}

declare module "virtual:routecraft" {
  import type { ParamsFor, RoutePath } from "virtual:routecraft/routes";

  export function href<P extends RoutePath>(
    path: P,
    ...args: keyof ParamsFor<P> extends never ? [] : [params: ParamsFor<P>]
  ): string;
}
