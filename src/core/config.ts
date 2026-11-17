import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  errorDiagnostic,
  type RoutecraftDiagnostic,
} from "./diagnostics.js";
import type { RouteLazyConfig } from "../types.js";

export interface ParsedRouteConfig {
  lazy: RouteLazyConfig;
  diagnostics: RoutecraftDiagnostic[];
}

const supportedKeys = new Set<keyof RouteLazyConfig>([
  "layout",
  "layoutLoader",
  "layoutAction",
  "layoutHandle",
  "page",
  "loader",
  "action",
  "handle",
  "notFoundHandle",
  "error",
  "hydrateFallback",
]);

/** 读取并静态分析目录配置；不执行用户模块。 */
export function readRouteConfig(filePath: string): ParsedRouteConfig {
  return parseRouteConfigSource(readFileSync(filePath, "utf8"), filePath);
}

/** 从源码直接解析静态配置，便于单元测试和调用方复用。 */
export function parseRouteConfigSource(
  source: string,
  filePath = "route.config.ts",
): ParsedRouteConfig {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics: RoutecraftDiagnostic[] = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly) {
      diagnostics.push(
        errorDiagnostic(
          "RC_CONFIG_RUNTIME_IMPORT",
          "route.config.ts 仅允许 import type，不允许运行时导入。",
          filePath,
        ),
      );
    }
  }
  const assignment = sourceFile.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && !statement.isExportEquals,
  );
  if (!assignment) {
    return {
      lazy: {},
      diagnostics: [
        errorDiagnostic(
          "RC_CONFIG_DEFAULT_EXPORT",
          "route.config.ts 必须默认导出一个静态配置对象。",
          filePath,
        ),
      ],
    };
  }

  const expression = unwrapExpression(assignment.expression);
  if (!ts.isObjectLiteralExpression(expression)) {
    return {
      lazy: {},
      diagnostics: [
        errorDiagnostic(
          "RC_CONFIG_STATIC_ONLY",
          "route.config.ts 的默认导出必须是对象字面量，不能使用变量、函数或运行时表达式。",
          filePath,
        ),
      ],
    };
  }

  const lazyProperty = expression.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && getPropertyName(property.name) === "lazy",
  );
  if (
    expression.properties.filter(
      (property) => getPropertyName(property.name) === "lazy",
    ).length > 1
  ) {
    diagnostics.push(
      errorDiagnostic(
        "RC_CONFIG_DUPLICATE_KEY",
        "route.config.ts 中 lazy 配置项不能重复。",
        filePath,
      ),
    );
  }
  const otherProperties = expression.properties.filter(
    (property) => getPropertyName(property.name) !== "lazy",
  );
  if (otherProperties.length > 0) {
    diagnostics.push(
      errorDiagnostic(
        "RC_CONFIG_UNKNOWN_KEY",
        `不支持 route.config.ts 配置项：${otherProperties
          .map((property) => getPropertyName(property.name) ?? "未知属性")
          .join(", ")}。`,
        filePath,
      ),
    );
  }
  if (!lazyProperty) return { lazy: {}, diagnostics };

  const lazyExpression = unwrapExpression(lazyProperty.initializer);
  if (!ts.isObjectLiteralExpression(lazyExpression)) {
    diagnostics.push(
      errorDiagnostic(
        "RC_CONFIG_LAZY_OBJECT",
        "route.config.ts 的 lazy 配置必须是对象字面量。",
        filePath,
      ),
    );
    return { lazy: {}, diagnostics };
  }

  const lazy: RouteLazyConfig = {};
  const seenKeys = new Set<string>();
  for (const property of lazyExpression.properties) {
    if (!ts.isPropertyAssignment(property)) {
      diagnostics.push(
        errorDiagnostic(
          "RC_CONFIG_STATIC_ONLY",
          "lazy 配置仅支持直接的布尔属性，不支持展开、方法或访问器。",
          filePath,
        ),
      );
      continue;
    }
    const name = getPropertyName(property.name);
    if (!name || !supportedKeys.has(name as keyof RouteLazyConfig)) {
      diagnostics.push(
        errorDiagnostic(
          "RC_CONFIG_UNKNOWN_KEY",
          `不支持 lazy 配置项“${name ?? "未知属性"}”。`,
          filePath,
        ),
      );
      continue;
    }
    if (seenKeys.has(name)) {
      diagnostics.push(
        errorDiagnostic(
          "RC_CONFIG_DUPLICATE_KEY",
          `lazy 配置项“${name}”不能重复。`,
          filePath,
        ),
      );
      continue;
    }
    seenKeys.add(name);
    const value = unwrapExpression(property.initializer);
    if (value.kind !== ts.SyntaxKind.TrueKeyword && value.kind !== ts.SyntaxKind.FalseKeyword) {
      diagnostics.push(
        errorDiagnostic(
          "RC_CONFIG_BOOLEAN",
          `lazy.${name} 必须是 true 或 false 字面量。`,
          filePath,
        ),
      );
      continue;
    }
    lazy[name as keyof RouteLazyConfig] = value.kind === ts.SyntaxKind.TrueKeyword;
  }
  return { lazy, diagnostics };
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function getPropertyName(name: ts.PropertyName | undefined): string | undefined {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}
