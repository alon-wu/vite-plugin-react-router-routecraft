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
});
