import { describe, expect, it, vi } from "vitest";
import { createRefreshCoordinator } from "../../src/vite/refresh-coordinator.js";

describe("刷新协调器", () => {
  it("合并并发刷新请求，并在当前刷新期间收到新请求时再执行一次", async () => {
    let finishFirstRefresh: ((value: string) => void) | undefined;
    const firstRefresh = new Promise<string>((resolve) => {
      finishFirstRefresh = resolve;
    });
    const refreshSnapshot = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => firstRefresh)
      .mockResolvedValueOnce("最新路由快照");
    const refresh = createRefreshCoordinator(refreshSnapshot);

    const firstRequest = refresh();
    const concurrentRequest = refresh();
    finishFirstRefresh?.("初始路由快照");

    await expect(firstRequest).resolves.toBe("最新路由快照");
    await expect(concurrentRequest).resolves.toBe("最新路由快照");
    expect(refreshSnapshot).toHaveBeenCalledTimes(2);
  });
});
