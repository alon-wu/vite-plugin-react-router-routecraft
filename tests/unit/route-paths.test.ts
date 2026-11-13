import { describe, expect, it } from "vitest";
import { createHrefModuleSource } from "../../src/core/route-paths.js";

describe("类型化路径辅助虚拟模块", () => {
  it("把路径插值交给 React Router generatePath", () => {
    const source = createHrefModuleSource();

    expect(source).toContain('import { generatePath } from "react-router"');
    expect(source).toContain("generatePath(path, params)");
    expect(source).toContain("export function href");
  });
});
