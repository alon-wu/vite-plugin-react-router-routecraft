export type DiagnosticLevel = "error" | "warning" | "info";

export interface RoutecraftDiagnostic {
  code: string;
  level: DiagnosticLevel;
  message: string;
  file?: string;
  routePath?: string;
  suggestion?: string;
}

export class RoutecraftError extends Error {
  readonly diagnostics: RoutecraftDiagnostic[];

  constructor(diagnostics: RoutecraftDiagnostic[]) {
    super(diagnostics.map((item) => `${item.code}: ${item.message}`).join("\n"));
    this.name = "RoutecraftError";
    this.diagnostics = diagnostics;
  }
}

export function errorDiagnostic(
  code: string,
  message: string,
  file?: string,
): RoutecraftDiagnostic {
  return {
    code,
    level: "error",
    message,
    ...(file === undefined ? {} : { file }),
  };
}
