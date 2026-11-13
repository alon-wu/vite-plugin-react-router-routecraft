import { describe, expect, it } from "vitest";
import { resolveNpmInvocation } from "../../scripts/npm-command.mjs";

describe("npm 命令启动方式", () => {
  it("通过当前 Node.js 进程启动 npm CLI，避免 Windows 直接 spawn .cmd", () => {
    expect(
      resolveNpmInvocation(
        "win32",
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
      ),
    ).toEqual({
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: ["C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js"],
      shell: false,
    });
  });

  it("未通过 npm 生命周期启动时，为 Windows 命令脚本启用 shell", () => {
    expect(resolveNpmInvocation("win32", "node.exe", undefined)).toEqual({
      command: "npm.cmd",
      args: [],
      shell: true,
    });
  });

  it("在类 Unix 系统上直接运行 npm", () => {
    expect(resolveNpmInvocation("darwin", "node", undefined)).toEqual({
      command: "npm",
      args: [],
      shell: false,
    });
  });
});
