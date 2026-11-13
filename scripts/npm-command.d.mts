export interface NpmInvocation {
  command: string;
  args: string[];
  shell: boolean;
}

export function resolveNpmInvocation(
  platform: NodeJS.Platform,
  nodeExecutable: string,
  npmExecPath: string | undefined,
): NpmInvocation;
