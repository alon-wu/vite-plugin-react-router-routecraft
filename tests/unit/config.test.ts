import { describe, expect, it } from "vitest";
import { parseRouteConfigSource } from "../../src/core/config.js";

describe("静态路由配置", () => {
  it("解析可静态求值的 satisfies 配置对象", () => {
    const result = parseRouteConfigSource(`
      import type { RouteConfig } from "vite-plugin-react-router-routecraft";
      export default {
        lazy: { page: true, loader: false, hydrateFallback: true },
      } satisfies RouteConfig;
    `);

    expect(result.lazy).toEqual({
      page: true,
      loader: false,
      hydrateFallback: true,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("拒绝变量引用、spread 和执行式配置", () => {
    const result = parseRouteConfigSource(`
      const lazy = { page: true };
      export default { lazy: { ...lazy } };
    `);

    expect(result.diagnostics.map((item) => item.code)).toContain(
      "RC_CONFIG_STATIC_ONLY",
    );
  });

  it("拒绝非布尔字段和未知字段", () => {
    const result = parseRouteConfigSource(`
      export default { lazy: { page: process.env.LAZY, unknown: true } };
    `);

    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["RC_CONFIG_BOOLEAN", "RC_CONFIG_UNKNOWN_KEY"]),
    );
  });

  it("允许类型导入但禁止运行时导入", () => {
    const result = parseRouteConfigSource(`
      import { readFileSync } from "node:fs";
      export default { lazy: { page: true } };
    `);

    expect(result.diagnostics.map((item) => item.code)).toContain(
      "RC_CONFIG_RUNTIME_IMPORT",
    );
  });
});
