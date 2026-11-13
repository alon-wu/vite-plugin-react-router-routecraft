/** 根据当前平台和 npm 生命周期信息选择兼容的 npm 启动方式。 */
export function resolveNpmInvocation(platform, nodeExecutable, npmExecPath) {
  if (npmExecPath) {
    return {
      command: nodeExecutable,
      args: [npmExecPath],
      shell: false,
    };
  }

  if (platform === "win32") {
    return {
      command: "npm.cmd",
      args: [],
      shell: true,
    };
  }

  return {
    command: "npm",
    args: [],
    shell: false,
  };
}
