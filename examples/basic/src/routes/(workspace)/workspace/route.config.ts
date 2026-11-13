import type { RouteConfig } from "vite-plugin-react-router-routecraft";

export default {
  lazy: {
    layout: false,
    page: true,
    loader: false,
  },
} satisfies RouteConfig;
