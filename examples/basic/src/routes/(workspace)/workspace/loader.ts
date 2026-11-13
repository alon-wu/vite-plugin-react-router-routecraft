import type { LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => ({
  title: "工作区概览",
  projects: 3,
});
