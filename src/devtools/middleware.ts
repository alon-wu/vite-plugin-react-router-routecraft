import type { IncomingMessage, ServerResponse } from "node:http";
import { createDevtoolsHtml } from "./html.js";
import type { DevtoolsSnapshot } from "./data.js";

export type DevtoolsNext = (error?: Error) => void;
export type DevtoolsMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: DevtoolsNext,
) => void | Promise<void>;
export type DevtoolsHtmlTransform = (html: string) => Promise<string>;

/** 创建仅暴露路由元数据与诊断的只读开发服务器中间件。 */
export function createDevtoolsMiddleware(
  getSnapshot: () => DevtoolsSnapshot,
  transformHtml: DevtoolsHtmlTransform,
): DevtoolsMiddleware {
  return async function routecraftDevtoolsMiddleware(request, response, next) {
    const pathname = new URL(request.url ?? "/", "http://routecraft.local").pathname;
    if (pathname === "/__routecraft") {
      try {
        const html = await transformHtml(createDevtoolsHtml());
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(html);
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }
    if (pathname === "/__routecraft/data") {
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(JSON.stringify(getSnapshot()));
      return;
    }
    next();
  };
}
