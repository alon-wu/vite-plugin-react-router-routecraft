import type { RoutecraftDiagnostic } from "./diagnostics.js";

export type RouteNodeKind = "root" | "segment" | "index" | "not-found";
export type RouteProperty =
  | "Component"
  | "loader"
  | "action"
  | "ErrorBoundary"
  | "HydrateFallback";

export interface RouteModuleRef {
  file: string;
  exportName: string;
  property: RouteProperty;
  lazy: boolean;
}

export interface MiddlewareModuleRef {
  file: string;
  exportName: "middleware";
}

export interface RouteNode {
  id: string;
  kind: RouteNodeKind;
  sourcePath: string;
  routePath: string;
  path?: string;
  index?: true;
  modules: Partial<Record<RouteProperty, RouteModuleRef>>;
  middleware?: MiddlewareModuleRef;
  children: RouteNode[];
}

export interface RouteIR {
  root: RouteNode;
  routeIds: string[];
  routePaths: string[];
  diagnostics: RoutecraftDiagnostic[];
}
