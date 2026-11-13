/** 协调对同一份路由快照的并发刷新请求。 */
export function createRefreshCoordinator<T>(
  refreshSnapshot: () => Promise<T>,
): () => Promise<T> {
  let currentRefresh: Promise<T> | undefined;
  let refreshAgain = false;

  return () => {
    if (currentRefresh) {
      refreshAgain = true;
      return currentRefresh;
    }

    const runRefreshes = async (): Promise<T> => {
      let latestSnapshot: T;
      do {
        refreshAgain = false;
        latestSnapshot = await refreshSnapshot();
      } while (refreshAgain);
      return latestSnapshot;
    };

    currentRefresh = runRefreshes().finally(() => {
      currentRefresh = undefined;
    });
    return currentRefresh;
  };
}
