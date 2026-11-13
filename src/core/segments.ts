import { errorDiagnostic, RoutecraftError } from "./diagnostics.js";

export type RouteSegment =
  | { kind: "static"; name: string; path: string }
  | { kind: "dynamic"; name: string; path: string }
  | { kind: "splat"; name: string; path: "*" }
  | { kind: "group"; name: string; path: null };

const identifierPattern = /^[$A-Z_a-z][$\w]*$/u;
const staticPattern = /^[A-Za-z0-9_-]+$/u;

/** 将单个目录名转换为 Routecraft 的路径段模型。 */
export function parseDirectorySegment(segment: string): RouteSegment {
  const groupMatch = /^\(([^()/]+)\)$/u.exec(segment);
  if (groupMatch) {
    const name = groupMatch[1]!;
    if (!staticPattern.test(name)) {
      throw new RoutecraftError([
        errorDiagnostic(
          "RC_SEGMENT_GROUP",
          `路由组名称“${name}”仅允许字母、数字、连字符和下划线。`,
          segment,
        ),
      ]);
    }
    return { kind: "group", name, path: null };
  }

  const splatMatch = /^\[\.\.\.([^\]]+)\]$/u.exec(segment);
  if (splatMatch) {
    const name = splatMatch[1]!;
    if (!identifierPattern.test(name)) {
      throw new RoutecraftError([
        errorDiagnostic(
          "RC_SEGMENT_SPLAT",
          `Catch-all 参数“${name}”必须是合法的 TypeScript 标识符。`,
          segment,
        ),
      ]);
    }
    return { kind: "splat", name, path: "*" };
  }

  const dynamicMatch = /^\[([^\[\]]+)\]$/u.exec(segment);
  if (dynamicMatch) {
    const name = dynamicMatch[1]!;
    if (!identifierPattern.test(name)) {
      throw new RoutecraftError([
        errorDiagnostic(
          "RC_SEGMENT_DYNAMIC",
          `动态参数“${name}”必须是合法的 TypeScript 标识符。`,
          segment,
        ),
      ]);
    }
    return { kind: "dynamic", name, path: `:${name}` };
  }

  if (!staticPattern.test(segment)) {
    throw new RoutecraftError([
      errorDiagnostic(
        "RC_SEGMENT_STATIC",
        `静态目录段“${segment}”仅允许字母、数字、连字符和下划线。`,
        segment,
      ),
    ]);
  }
  return { kind: "static", name: segment, path: segment };
}

/** 将分段路径拼成 React Router 接收的绝对路径。 */
export function toRoutePath(parts: readonly string[]): string {
  return parts.length === 0 ? "/" : `/${parts.join("/")}`;
}

/** 将路径段归一化成用于冲突比较的形状。 */
export function normalizePathShape(parts: readonly string[]): string {
  return parts
    .map((part) => {
      if (part.startsWith(":")) return ":param";
      if (part === "*") return "*";
      return part;
    })
    .join("/");
}
