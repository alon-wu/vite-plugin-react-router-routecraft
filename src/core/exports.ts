import ts from "typescript";
import {
  errorDiagnostic,
  type RoutecraftDiagnostic,
} from "./diagnostics.js";

/** 通过 TypeScript AST 检查所需导出，不执行用户模块代码。 */
export function analyzeModuleExports(
  source: string,
  filePath: string,
  requiredExports: readonly string[],
): RoutecraftDiagnostic[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const exports = collectExports(sourceFile);

  return requiredExports
    .filter((name) => !exports.has(name))
    .map((name) =>
      errorDiagnostic(
        "RC_REQUIRED_EXPORT",
        `路由模块必须导出“${name}”。`,
        filePath,
      ),
    );
}

function collectExports(sourceFile: ts.SourceFile): Set<string> {
  const exports = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      exports.add("default");
      continue;
    }

    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        exports.add("default");
      } else if (statement.name) {
        exports.add(statement.name.text);
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exports.add(declaration.name.text);
      }
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          exports.add(element.name.text);
        }
      }
    }
  }

  return exports;
}

function hasModifier(
  node: ts.Node,
  kind: ts.SyntaxKind.ExportKeyword | ts.SyntaxKind.DefaultKeyword,
): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)
  );
}
