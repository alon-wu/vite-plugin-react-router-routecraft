import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { createBrowserRouter } from "react-router";
import { routeObjects } from "virtual:routecraft/routes";
import "./style.css";

const router = createBrowserRouter(routeObjects);
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("页面缺少 #root 挂载节点。");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
