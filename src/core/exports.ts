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
      if (
        !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
        hasModifier(statement, ts.SyntaxKind.DeclareKeyword)
      ) {
        continue;
      }
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        exports.add("default");
      } else if (statement.name) {
        exports.add(statement.name.text);
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      if (
        !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
        hasModifier(statement, ts.SyntaxKind.DeclareKeyword)
      ) {
        continue;
      }
      for (const declaration of statement.declarationList.declarations) {
        for (const name of collectBindingNames(declaration.name)) {
          exports.add(name);
        }
      }
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (statement.isTypeOnly) continue;
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (element.isTypeOnly) continue;
          exports.add(element.name.text);
        }
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        exports.add(statement.exportClause.name.text);
      }
    }
  }

  return exports;
}

function collectBindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];

  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : collectBindingNames(element.name),
  );
}

function hasModifier(
  node: ts.Node,
  kind:
    | ts.SyntaxKind.ExportKeyword
    | ts.SyntaxKind.DefaultKeyword
    | ts.SyntaxKind.DeclareKeyword,
): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)
  );
}
