import { describe, expect, it } from "vitest";
import { parseDirectorySegment, toRoutePath } from "../../src/core/segments.js";

describe("目录段语法", () => {
  it("将普通目录识别为静态 URL 段", () => {
    expect(parseDirectorySegment("dashboard")).toEqual({
      kind: "static",
      name: "dashboard",
      path: "dashboard",
    });
  });

  it("将方括号单参数目录映射为 React Router 参数段", () => {
    expect(parseDirectorySegment("[projectId]")).toEqual({
      kind: "dynamic",
      name: "projectId",
      path: ":projectId",
    });
  });

  it("保留路由组层级但不将组名写入 URL", () => {
    expect(parseDirectorySegment("(workspace)")).toEqual({
      kind: "group",
      name: "workspace",
      path: null,
    });
  });

  it("将末尾 catch-all 映射到 React Router 的 splat", () => {
    expect(parseDirectorySegment("[...parts]")).toEqual({
      kind: "splat",
      name: "parts",
      path: "*",
    });
    expect(toRoutePath(["docs", "*"])).toBe("/docs/*");
  });

  it.each(["[[...parts]]", "[bad-name]", "broken)", "a.b"])(
    "拒绝不支持或非法的目录名 %s",
    (segment) => {
      expect(() => parseDirectorySegment(segment)).toThrow();
    },
  );
});
