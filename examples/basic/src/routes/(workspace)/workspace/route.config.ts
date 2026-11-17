import type { RouteConfig } from "vite-plugin-react-router-routecraft";

export default {
  lazy: {
    layout: false,
    layoutHandle: true,
    page: true,
    handle: false,
    loader: false,
  },
} satisfies RouteConfig;
