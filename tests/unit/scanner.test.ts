import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanRoutes } from "../../src/core/scanner.js";

const temporaryDirectories: string[] = [];

function createRoutesDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), "routecraft-routes-"));
  temporaryDirectories.push(root);
  return root;
}

function addFile(root: string, relativePath: string): void {
  const filePath = join(root, relativePath);
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, "export default function Route() { return null; }\n");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("路由目录扫描", () => {
  it("只收集约定文件并按稳定顺序保留路由组层级", () => {
    const root = createRoutesDirectory();
    addFile(root, "(auth)/sign-in/page.tsx");
    addFile(root, "(auth)/layout.tsx");
    addFile(root, "(auth)/components/Field.tsx");
    addFile(root, "_private/page.tsx");
    addFile(root, "about/page.ts");

    const result = scanRoutes(root);
    const names = result.children.map((child) => child.name);

    expect(names).toEqual(["(auth)", "about"]);
    expect(result.children[0]?.files.layout).toContain("layout.tsx");
    expect(result.children[0]?.children[0]?.name).toBe("sign-in");
    expect(result.diagnostics).toEqual([]);
  });

  it("重复约定文件扩展名时报告错误，不做静默优先级选择", () => {
    const root = createRoutesDirectory();
    addFile(root, "page.ts");
    addFile(root, "page.tsx");

    const result = scanRoutes(root);

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "RC_DUPLICATE_CONVENTION_FILE",
    );
  });

  it("扫描器忽略声明生成物，避免类型文件触发路由", () => {
    const root = createRoutesDirectory();
    addFile(root, "typed-router.d.ts");

    const result = scanRoutes(root);

    expect(result.children).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("忽略没有任何路由文件的 colocated 普通目录", () => {
    const root = createRoutesDirectory();
    addFile(root, "ui kit/Field.tsx");

    const result = scanRoutes(root);

    expect(result.children).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("对未实现的 loading 文件给出不模拟其语义的提示", () => {
    const root = createRoutesDirectory();
    addFile(root, "loading.tsx");

    const result = scanRoutes(root);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RC_UNSUPPORTED_ROUTE_CONVENTION",
        level: "warning",
        message: "“loading.tsx”使用了 Routecraft 当前不支持的文件约定；该文件不会生成路由功能。",
      }),
    );
  });

  it("catch-all 目录之后存在路由子目录时给出错误", () => {
    const root = createRoutesDirectory();
    addFile(root, "[...parts]/nested/page.tsx");

    const result = scanRoutes(root);

    expect(result.diagnostics.map((item) => item.code)).toContain(
      "RC_SPLAT_NOT_TERMINAL",
    );
  });

  it("不把未支持的特殊目录误当 URL 段", () => {
    const root = createRoutesDirectory();
    addFile(root, "@modal/page.tsx");
    addFile(root, "(.)photo/page.tsx");

    const result = scanRoutes(root);

    expect(result.children).toEqual([]);
    expect(result.diagnostics.filter((item) => item.level === "error")).toEqual([]);
    expect(
      result.diagnostics.filter((item) => item.code === "RC_UNSUPPORTED_ROUTE_CONVENTION"),
    ).toHaveLength(2);
  });
});
