import type { RouteConfig } from "vite-plugin-react-router-routecraft";

export default {
  lazy: {
    page: false,
    handle: true,
    notFoundHandle: true,
  },
} satisfies RouteConfig;
