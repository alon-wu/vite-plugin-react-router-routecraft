import { describe, expect, it } from "vitest";
import { analyzeModuleExports } from "../../src/core/exports.js";

describe("路由模块导出分析", () => {
  it("识别 default 组件与命名导出", () => {
    const result = analyzeModuleExports(
      `
        export default function Page() { return null; }
        export async function loader() { return null; }
        export const action = async () => null;
      `,
      "page.tsx",
      ["default", "loader", "action"],
    );

    expect(result).toEqual([]);
  });

  it("报告缺失导出且不执行路由源码", () => {
    const result = analyzeModuleExports(
      `throw new Error("不能执行"); export default function Page() { return null; }`,
      "page.tsx",
      ["default", "loader"],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe("RC_REQUIRED_EXPORT");
  });

  it("识别 export 别名", () => {
    const result = analyzeModuleExports(
      `const run = () => null; export { run as middleware };`,
      "middleware.ts",
      ["middleware"],
    );

    expect(result).toEqual([]);
  });

  it("识别 handle 命名导出并拒绝默认导出替代", () => {
    expect(
      analyzeModuleExports(
        "export const handle = { title: '首页' };",
        "handle.ts",
        ["handle"],
      ),
    ).toEqual([]);

    expect(
      analyzeModuleExports(
        "export default { title: '首页' };",
        "handle.ts",
        ["handle"],
      ),
    ).toEqual([
      expect.objectContaining({
        code: "RC_REQUIRED_EXPORT",
        file: "handle.ts",
      }),
    ]);
  });

  it("不把仅类型导出误认为运行时 handle", () => {
    expect(
      analyzeModuleExports(
        'export type { handle } from "./route-meta.js";',
        "handle.ts",
        ["handle"],
      ),
    ).toEqual([
      expect.objectContaining({
        code: "RC_REQUIRED_EXPORT",
        file: "handle.ts",
      }),
    ]);
  });

  it.each([
    "export declare const handle: { title: string };",
    "export declare function handle(): { title: string };",
    "export declare class handle {}",
  ])("不把 ambient declare %s 误认为运行时导出", (source) => {
    expect(analyzeModuleExports(source, "handle.ts", ["handle"])).toContainEqual(
      expect.objectContaining({
        code: "RC_REQUIRED_EXPORT",
        file: "handle.ts",
      }),
    );
  });

  it("识别解构绑定和命名空间重导出的运行时命名导出", () => {
    expect(
      analyzeModuleExports(
        "const source = { title: '首页' }; export const { handle } = { handle: source };",
        "handle.ts",
        ["handle"],
      ),
    ).toEqual([]);

    expect(
      analyzeModuleExports(
        'export * as handle from "./route-meta.js";',
        "handle.ts",
        ["handle"],
      ),
    ).toEqual([]);
  });
});
