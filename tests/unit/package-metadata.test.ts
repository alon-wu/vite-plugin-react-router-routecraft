import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"),
) as {
  name: string;
  type: string;
  repository: { type: string; url: string };
  homepage: string;
  bugs: { url: string };
  engines: { node: string };
  exports: Record<string, { types: string; import: string }>;
  files: string[];
  scripts: Record<string, string>;
  peerDependencies: Record<string, string>;
};
const npmIgnore = readFileSync(resolve(import.meta.dirname, "../../.npmignore"), "utf8");
const docsNpmIgnore = readFileSync(
  resolve(import.meta.dirname, "../../docs/.npmignore"),
  "utf8",
);

describe("发布元数据", () => {
  it("声明 ESM 包入口、类型入口和 Node.js 运行基线", () => {
    expect(packageJson.name).toBe("vite-plugin-react-router-routecraft");
    expect(packageJson.type).toBe("module");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/alon-wu/vite-plugin-react-router-routecraft.git",
    });
    expect(packageJson.homepage).toBe(
      "https://alon-wu.github.io/vite-plugin-react-router-routecraft/",
    );
    expect(packageJson.bugs.url).toBe(
      "https://github.com/alon-wu/vite-plugin-react-router-routecraft/issues",
    );
    expect(packageJson.engines.node).toContain("22.22");
    expect(packageJson.exports["."]).toMatchObject({
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    });
  });

  it("不将宿主框架重复打包，并提供发布前验证脚本", () => {
    expect(packageJson.peerDependencies).toHaveProperty("vite");
    expect(packageJson.peerDependencies).toHaveProperty("react-router");
    expect(packageJson.scripts).toHaveProperty("verify");
    expect(packageJson.scripts).toHaveProperty("pack:check");
    expect(packageJson.files).toContain("dist");
    expect(packageJson.peerDependencies["react-router"]).toBe("^8.5.1");
  });

  it("发布正式 Markdown 文档，但排除站点配置和内部实施计划", () => {
    expect(packageJson.files).toContain("docs");
    expect(docsNpmIgnore).toContain(".vitepress/");
    expect(docsNpmIgnore).toContain("superpowers/");
    expect(npmIgnore).not.toContain("docs/.vitepress/");
  });
});
