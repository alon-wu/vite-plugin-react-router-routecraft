# 完整示例：团队项目管理台

本示例围绕一个具体应用组织路由：产品首页和价格页、认证入口、工作区摘要、项目列表、新建项目 action、动态项目详情 loader。它明确展示多个独立布局分支、数据模块的可选性，以及**同一条路由内各属性分别采用 eager 或 lazy** 的方式。

示例使用本地演示数据，不冒充生产后端。登录和数据操作只演示 React Router Data Mode 的接法；真实应用必须由服务端实现持久化、会话和权限检查。

## 1. 页面清单与可访问 URL

| 页面 | URL | 外层布局 | 当前 route 数据模块 |
| --- | --- | --- | --- |
| 产品首页 | `/` | 产品站点布局 | 无 loader/action |
| 价格方案 | `/pricing` | 产品站点布局 | 无 loader/action |
| 登录 | `/auth/sign-in` | 认证布局 | 有 action，无 loader |
| 创建账号 | `/auth/sign-up` | 认证布局 | 无 loader/action |
| 工作区摘要 | `/workspace` | 工作区布局 | 页面自身无 loader/action；父布局有 loader |
| 项目目录 | `/workspace/projects` | 工作区布局 | 同一页面 route 有 loader 和 action |
| 项目详情 | `/workspace/projects/:projectId` | 工作区布局 | 有 loader，无 action |

## 2. 项目文件树

下列路径均相对于 `examples/complete-app/`。根目录放 Vite 应用配置；页面、数据和样式放在 `src/`。

```text
examples/complete-app/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── data/
    │   └── projects.ts
    ├── main.tsx
    ├── router.ts
    ├── style.css
    ├── types/
    │   └── typed-router.d.ts   # 插件生成，勿手改
    └── routes/
        ├── middleware.ts
        ├── hydrate-fallback.tsx
        ├── not-found.tsx
        ├── (public)/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   └── pricing/
        │       └── page.tsx
        ├── (auth)/
        │   └── auth/
        │       ├── layout.tsx
        │       ├── sign-in/
        │       │   ├── page.tsx
        │       │   ├── action.ts
        │       │   └── route.config.ts
        │       └── sign-up/
        │           └── page.tsx
        └── (workspace)/
            └── workspace/
                ├── layout.tsx
                ├── layout.loader.ts
                ├── route.config.ts
                ├── page.tsx
                └── projects/
                    ├── page.tsx
                    ├── loader.ts
                    ├── action.ts
                    ├── route.config.ts
                    └── [projectId]/
                        ├── page.tsx
                        ├── loader.ts
                        └── route.config.ts
```

三个 route group `(public)`、`(auth)`、`(workspace)` 不进入 URL。其下的 `layout.tsx` 各自建立不同的 React 组件布局边界；应用仍只创建一个 React Router。

## 项目基础文件

以下示例假定将项目保存于 Routecraft 仓库的 `examples/complete-app`，因此本地插件依赖通过 `file:../..` 指向仓库根目录。独立应用按[安装指南](/getting-started#安装方式)安装发布版本；也可在仓库根目录运行 `npm pack`，再安装生成的 tarball，以验证当前源码构建出的包。

`examples/complete-app/package.json`：

```json
{
  "name": "routecraft-team-projects-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "typecheck": "vite build && tsc --noEmit",
    "build": "vite build && tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-router": "^8.5.1",
    "vite-plugin-react-router-routecraft": "file:../.."
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.9.3",
    "vite": "^7.0.0"
  }
}
```

`examples/complete-app/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f5f7fb" />
    <title>栈桥 Studio · 团队项目管理</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`examples/complete-app/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

`src/types/typed-router.d.ts` 在 Vite 插件扫描路由时生成。示例把 `typecheck` 设计为先运行一次 Vite 构建，再由 TypeScript 检查刚生成的声明和业务代码；因此首次使用时直接运行 `npm run typecheck` 即可，无需手工创建虚拟模块声明。该生成文件由 `include` 纳入检查，但不可手工编辑。以下样式文件覆盖上文组件使用的布局、表单和卡片 class：

`src/style.css`：

```css
:root {
  font-family: Inter, "Noto Sans SC", system-ui, sans-serif;
  color: #202b3c;
  background: #f5f7fb;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}
* { box-sizing: border-box; }
body { min-width: 320px; min-height: 100vh; margin: 0; }
a { color: #3157bd; text-decoration: none; }
a:hover { text-decoration: underline; }
button, input { font: inherit; }
h1, h2, p { margin-top: 0; }
h1 { margin-bottom: 16px; font-size: clamp(2rem, 5vw, 3.8rem); line-height: 1.1; }
h2 { font-size: 1.15rem; }
.site-header, .site-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px max(24px, calc((100vw - 1120px) / 2));
  background: #fff;
}
.site-header nav, .button-row { display: flex; align-items: center; gap: 22px; }
.brand { color: #202b3c; font-size: 1.1rem; font-weight: 750; }
.site-footer { color: #69778a; border-top: 1px solid #e6eaf0; }
.marketing-page, .content-page { width: min(100% - 40px, 1000px); margin: 76px auto; }
.marketing-page > p:not(.eyebrow) { max-width: 620px; color: #69778a; font-size: 1.1rem; line-height: 1.8; }
.eyebrow, .sidebar-label { color: #536a9f; font-size: .8rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.button {
  display: inline-flex; min-height: 44px; align-items: center; justify-content: center;
  padding: 0 18px; color: #fff; background: #3157bd; border: 0; border-radius: 9px;
  cursor: pointer; font-weight: 650;
}
.button:disabled { cursor: wait; opacity: .65; }
.button-secondary { color: #3157bd; background: #e9efff; }
.metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 36px 0; }
.metric-grid article, .panel, .plan-card, .project-card {
  padding: 22px; background: #fff; border: 1px solid #e6eaf0; border-radius: 14px;
}
.metric-grid article { display: grid; gap: 9px; color: #69778a; }
.metric-grid strong { color: #202b3c; font-size: 1.8rem; }
.metric-grid small, .muted, .project-card small { color: #778397; }
.plan-card { max-width: 440px; }
.auth-shell { display: grid; min-height: 100vh; place-content: center; justify-items: center; gap: 24px; padding: 24px; }
.auth-card { width: min(100%, 440px); padding: 36px; background: #fff; border: 1px solid #e6eaf0; border-radius: 18px; box-shadow: 0 18px 60px #22324a12; }
.form-stack { display: grid; gap: 16px; margin: 24px 0; }
.form-stack label { display: grid; gap: 7px; font-size: .9rem; font-weight: 600; }
.form-stack input, .create-project input { min-height: 44px; padding: 0 12px; border: 1px solid #d9e0ea; border-radius: 8px; }
.form-error { color: #b42336; }
.workspace-shell { display: grid; min-height: 100vh; grid-template-columns: 248px 1fr; }
.sidebar { position: sticky; top: 0; display: flex; height: 100vh; flex-direction: column; gap: 28px; padding: 26px 20px; background: #fff; border-right: 1px solid #e6eaf0; }
.sidebar nav { display: grid; gap: 10px; }
.sidebar nav a { padding: 11px 12px; border-radius: 8px; }
.sidebar nav a:hover { background: #f1f4fa; text-decoration: none; }
.profile-chip { display: flex; align-items: center; gap: 10px; margin-top: auto; }
.avatar { display: grid; width: 36px; height: 36px; place-items: center; color: #3157bd; background: #e9efff; border-radius: 50%; font-weight: 700; }
.workspace-main { width: min(100%, 1080px); margin: 0 auto; padding: 48px clamp(22px, 5vw, 64px); }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
.page-heading h1 { margin-bottom: 0; font-size: clamp(1.8rem, 4vw, 2.7rem); }
.panel { margin-top: 28px; }
.create-project { display: flex; gap: 12px; margin: 24px 0; }
.create-project input { flex: 1; }
.project-list { display: grid; gap: 12px; }
.project-card { display: grid; grid-template-columns: 12px 1fr auto; align-items: center; gap: 14px; color: inherit; }
.project-card h2 { margin-bottom: 6px; }
.project-card p { margin-bottom: 8px; color: #69778a; }
.status-dot { width: 10px; height: 10px; background: #1d9a69; border-radius: 50%; }
.status-dot.status-paused { background: #d49124; }
.status-pill { padding: 6px 10px; color: #14734e; background: #e5f5ed; border-radius: 999px; }
.status-pill.status-paused { color: #976118; background: #fff3d9; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
.hydration-fallback { display: grid; min-height: 100vh; place-content: center; justify-items: center; color: #69778a; }
.spinner { width: 28px; height: 28px; border: 3px solid #dfe6f2; border-top-color: #3157bd; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 760px) {
  .workspace-shell { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; }
  .sidebar nav { grid-template-columns: repeat(3, 1fr); }
  .profile-chip { margin-top: 0; }
  .workspace-main { padding-top: 32px; }
  .metric-grid { grid-template-columns: 1fr; }
  .site-header { align-items: flex-start; gap: 18px; }
  .site-header nav { flex-wrap: wrap; justify-content: flex-end; gap: 12px; }
}
```

## 3. 插件配置与应用入口

`vite.config.ts`：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import routecraft from "vite-plugin-react-router-routecraft";

export default defineConfig({
  plugins: [
    react(),
    routecraft({
      routesDir: "src/routes",
      typesDir: "src/types",
      defaultLazy: true,
      devTools: true,
    }),
  ],
});
```

`src/router.ts`：

```ts
import { createBrowserRouter } from "react-router";
import { routeObjects } from "virtual:routecraft/routes";

export const router = createBrowserRouter(routeObjects);
```

`virtual:routecraft/routes` 是 Vite 开发/构建期间由 Routecraft 插件提供的虚拟模块；它不是 React Router 导出，也不需要在磁盘上手工创建同名文件。`src/main.tsx`：

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";
import "./style.css";

const root = document.getElementById("root");
if (!root) throw new Error("找不到 #root 挂载节点。");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

## 4. 公开页面分支：独立站点布局

`src/routes/(public)/layout.tsx`：

```tsx
import { Link, Outlet } from "react-router";

export default function PublicLayout() {
  return (
    <>
      <header className="site-header">
        <Link className="brand" to="/">栈桥 Studio</Link>
        <nav aria-label="主导航">
          <Link to="/">产品</Link>
          <Link to="/pricing">价格</Link>
          <Link to="/auth/sign-in">登录</Link>
        </nav>
      </header>
      <Outlet />
      <footer className="site-footer">让团队项目进展清晰可见。</footer>
    </>
  );
}
```

`src/routes/(public)/page.tsx`：

```tsx
import { Link } from "react-router";

export default function HomePage() {
  return (
    <main className="marketing-page">
      <p className="eyebrow">团队项目管理</p>
      <h1>从第一次计划，到每一次交付，都清清楚楚。</h1>
      <p>
        用一个轻量工作区跟踪项目、负责人和近期更新，
        不再靠散落的表格同步进度。
      </p>
      <div className="button-row">
        <Link className="button" to="/auth/sign-up">创建团队</Link>
        <Link className="button button-secondary" to="/pricing">查看方案</Link>
      </div>
      <section className="metric-grid" aria-label="示例指标">
        <article><strong>12</strong><span>本周推进项目</span></article>
        <article><strong>4.8 天</strong><span>平均反馈周期</span></article>
        <article><strong>1 个工作区</strong><span>进度统一可见</span></article>
      </section>
    </main>
  );
}
```

`src/routes/(public)/pricing/page.tsx`：

```tsx
export default function PricingPage() {
  return (
    <main className="content-page">
      <p className="eyebrow">简单透明</p>
      <h1>从小团队开始，按需扩展。</h1>
      <article className="plan-card">
        <h2>团队版</h2>
        <p><strong>¥ 99</strong> / 人 / 月</p>
        <ul>
          <li>不限项目与任务</li>
          <li>团队活动记录</li>
          <li>基础项目报告</li>
        </ul>
      </article>
    </main>
  );
}
```

上述两个页面目录没有 `loader.ts` 或 `action.ts`。Routecraft 只生成实际存在的 `Component` 等属性，不会添加空数据处理函数。

## 5. 认证分支：登录有 action、没有 loader

`src/routes/(auth)/auth/layout.tsx`：

```tsx
import { Link, Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <main className="auth-shell">
      <Link className="brand" to="/">栈桥 Studio</Link>
      <section className="auth-card"><Outlet /></section>
      <p className="muted">团队协作，从清晰的项目状态开始。</p>
    </main>
  );
}
```

`src/routes/(auth)/auth/sign-in/page.tsx`：

```tsx
import { Form, Link, useActionData, useNavigation } from "react-router";

interface SignInActionData {
  error?: string;
}

export default function SignInPage() {
  const actionData = useActionData() as SignInActionData | undefined;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <>
      <p className="eyebrow">欢迎回来</p>
      <h1>登录你的工作区</h1>
      <Form method="post" className="form-stack">
        <label>
          工作邮箱
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          密码
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {actionData?.error && (
          <p role="alert" className="form-error">{actionData.error}</p>
        )}
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "正在提交…" : "登录"}
        </button>
      </Form>
      <p className="muted">
        还没有账号？ <Link to="/auth/sign-up">创建账号</Link>
      </p>
    </>
  );
}
```

`src/routes/(auth)/auth/sign-in/action.ts`：

```ts
import { redirect, type ActionFunction } from "react-router";

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // 仅用于演示表单提交；真实身份验证必须由服务端完成。
  if (!email || password.length < 8) {
    return { error: "请输入有效邮箱和至少 8 位密码。" };
  }

  return redirect("/workspace");
};
```

`src/routes/(auth)/auth/sign-in/route.config.ts`：

```ts
import type { RouteConfig } from "vite-plugin-react-router-routecraft";

export default {
  lazy: {
    page: true,
    action: false,
  },
} satisfies RouteConfig;
```

此路由有 `action.ts`，无 `loader.ts`：页面组件进入 `lazy`，action 静态导入。`/auth/sign-up` 页面也没有数据文件，生成的路由不包含 loader/action。

## 6. 工作区分支：布局 loader 与无数据页面

`src/routes/(workspace)/workspace/layout.tsx`：

```tsx
import { Link, Outlet, useRouteLoaderData } from "react-router";

interface WorkspaceLayoutData {
  currentUser: { name: string; initials: string };
  workspaceName: string;
}

export default function WorkspaceLayout() {
  const data = useRouteLoaderData(
    "routecraft:(workspace):workspace",
  ) as WorkspaceLayoutData;

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <Link className="brand" to="/workspace">栈桥</Link>
        <p className="sidebar-label">{data.workspaceName}</p>
        <nav aria-label="工作区导航">
          <Link to="/workspace">概览</Link>
          <Link to="/workspace/projects">所有项目</Link>
          <Link to="/">返回产品首页</Link>
        </nav>
        <div className="profile-chip">
          <span className="avatar">{data.currentUser.initials}</span>
          <span>{data.currentUser.name}</span>
        </div>
      </aside>
      <main className="workspace-main"><Outlet /></main>
    </div>
  );
}
```

`src/routes/(workspace)/workspace/layout.loader.ts`：

```ts
import type { LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => ({
  currentUser: { name: "林知夏", initials: "知" },
  workspaceName: "栈桥设计组",
});
```

`src/routes/(workspace)/workspace/route.config.ts`：

```ts
import type { RouteConfig } from "vite-plugin-react-router-routecraft";

export default {
  lazy: {
    layout: false,
    layoutLoader: false,
    page: true,
  },
} satisfies RouteConfig;
```

本例通过实际生成的 ID `routecraft:(workspace):workspace` 从 layout loader 读取数据。配置中的 `layoutLoader` 控制 `layout.loader.ts`；配置中的 `loader` 才控制同目录页面 index route 的 `loader.ts`。

`src/routes/(workspace)/workspace/page.tsx`：

```tsx
import { Link } from "react-router";

export default function WorkspaceHomePage() {
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">星期一 · 团队概览</p><h1>早上好，知夏</h1></div>
        <Link className="button" to="/workspace/projects">查看项目</Link>
      </div>
      <section className="metric-grid">
        <article><span>进行中的项目</span><strong>08</strong><small>较上周 +2</small></article>
        <article><span>待处理更新</span><strong>03</strong><small>其中 1 项即将到期</small></article>
        <article><span>本周已完成</span><strong>14</strong><small>团队节奏稳定</small></article>
      </section>
      <section className="panel">
        <h2>最近动态</h2>
        <p>陈嘉宁更新了「客户门户改版」的项目计划。</p>
        <p>王一帆完成了「移动端体验优化」的交付评审。</p>
      </section>
    </>
  );
}
```

工作区首页自身无 `loader.ts`/`action.ts`，但父布局有 `layout.loader.ts`。它说明“子页面没有 loader”与“祖先布局有数据”并不冲突。

## 7. 项目目录：同一页面有 loader 和 action

`src/data/projects.ts` 提供本地演示数据。它在当前浏览器模块内存中维护，页面刷新会恢复初始值，并非数据库。

```ts
export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused";
  owner: string;
  updatedAt: string;
}

const projects: Project[] = [
  {
    id: "routecraft-docs",
    name: "Routecraft 文档站",
    description: "整理安装指南、目录约定和插件架构。",
    status: "active",
    owner: "林知夏",
    updatedAt: "2026-11-10",
  },
  {
    id: "customer-portal",
    name: "客户门户改版",
    description: "为客户提供项目进度和交付物入口。",
    status: "paused",
    owner: "陈嘉宁",
    updatedAt: "2026-11-08",
  },
];

export async function listProjects(): Promise<Project[]> {
  return [...projects];
}

export async function findProject(
  id: string | undefined,
): Promise<Project | undefined> {
  return projects.find((project) => project.id === id);
}

export async function createProject(name: string): Promise<Project> {
  const project: Project = {
    id: `project-${projects.length + 1}`,
    name,
    description: "新建项目，请补充项目说明。",
    status: "active",
    owner: "当前用户",
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  projects.unshift(project);
  return project;
}
```

`src/routes/(workspace)/workspace/projects/loader.ts`：

```ts
import type { LoaderFunction } from "react-router";
import { listProjects } from "../../../../data/projects";

export const loader: LoaderFunction = async () => ({
  projects: await listProjects(),
});
```

`src/routes/(workspace)/workspace/projects/action.ts`：

```ts
import { redirect, type ActionFunction } from "react-router";
import { createProject } from "../../../../data/projects";

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "项目名称至少需要 2 个字符。" };

  const project = await createProject(name);
  return redirect(`/workspace/projects/${project.id}`);
};
```

`src/routes/(workspace)/workspace/projects/route.config.ts`：

```ts
import type { RouteConfig } from "vite-plugin-react-router-routecraft";

export default {
  lazy: {
    page: true,
    loader: false,
    action: true,
  },
} satisfies RouteConfig;
```

`src/routes/(workspace)/workspace/projects/page.tsx`：

```tsx
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type { Project } from "../../../../data/projects";

interface ProjectListData {
  projects: Project[];
}

interface CreateProjectActionData {
  error?: string;
}

export default function ProjectsPage() {
  const data = useLoaderData() as ProjectListData;
  const actionData = useActionData() as CreateProjectActionData | undefined;
  const navigation = useNavigation();

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">项目组合</p><h1>所有项目</h1></div>
        <span>{data.projects.length} 个项目</span>
      </div>
      <Form method="post" className="create-project">
        <label className="sr-only" htmlFor="project-name">新项目名称</label>
        <input
          id="project-name"
          name="name"
          placeholder="例如：品牌官网重设计"
          required
        />
        <button className="button" disabled={navigation.state === "submitting"}>
          {navigation.state === "submitting" ? "创建中…" : "新建项目"}
        </button>
      </Form>
      {actionData?.error && (
        <p role="alert" className="form-error">{actionData.error}</p>
      )}
      <div className="project-list">
        {data.projects.map((project) => (
          <Link
            className="project-card"
            to={`/workspace/projects/${project.id}`}
            key={project.id}
          >
            <span className={`status-dot status-${project.status}`} />
            <div>
              <h2>{project.name}</h2>
              <p>{project.description}</p>
              <small>
                负责人：{project.owner} · 更新于 {project.updatedAt}
              </small>
            </div>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </>
  );
}
```

该页面 route 同时有 loader 和 action。配置结果：`loader` eager、页面 `Component` lazy、`action` lazy。`page.tsx` 上的 `useLoaderData()`/`useActionData()` 通过显式的应用类型说明展示业务形状，因为 Routecraft 当前不从模块实现推导这些返回类型。

## 8. 动态项目详情：有 loader、没有 action

目录 `projects/[projectId]/` 编译为 React Router `path: ":projectId"`。此段的 `page.tsx` 会成为该路径下的 index route。

`src/routes/(workspace)/workspace/projects/[projectId]/route.config.ts`：

```ts
import type { RouteConfig } from "vite-plugin-react-router-routecraft";

export default {
  lazy: {
    page: true,
    loader: false,
  },
} satisfies RouteConfig;
```

`src/routes/(workspace)/workspace/projects/[projectId]/loader.ts`：

```ts
import { type LoaderFunction } from "react-router";
import { findProject } from "../../../../../data/projects";

export const loader: LoaderFunction = async ({ params }) => {
  const project = await findProject(params.projectId);
  if (!project) {
    throw new Response("找不到这个项目。", {
      status: 404,
      statusText: "Not Found",
    });
  }
  return project;
};
```

`src/routes/(workspace)/workspace/projects/[projectId]/page.tsx`：

```tsx
import { Link, useLoaderData } from "react-router";
import type { Project } from "../../../../../data/projects";

export default function ProjectDetailPage() {
  const project = useLoaderData() as Project;

  return (
    <>
      <Link to="/workspace/projects">← 返回所有项目</Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">项目详情 · {project.id}</p>
          <h1>{project.name}</h1>
        </div>
        <span className={`status-pill status-${project.status}`}>
          {project.status}
        </span>
      </div>
      <section className="panel">
        <h2>项目说明</h2>
        <p>{project.description}</p>
        <dl>
          <dt>负责人</dt><dd>{project.owner}</dd>
          <dt>最近更新</dt><dd>{project.updatedAt}</dd>
        </dl>
      </section>
    </>
  );
}
```

这条路由有 loader、没有 action。若项目 ID 不存在，loader 抛出 404 Response；实际应用可在该 route 目录增加 `error.tsx`，该组件映射到 `ErrorBoundary`。此处省略它，避免把每条示例路由重复成相同边界。

## 9. 根 middleware、fallback 与 404

`src/routes/middleware.ts`：

```ts
import type { MiddlewareFunction } from "react-router";

export const middleware: MiddlewareFunction = async ({ request }, next) => {
  const startedAt = performance.now();
  await next();
  const elapsed = Math.round(performance.now() - startedAt);
  console.info(
    `[demo] ${request.method} ${new URL(request.url).pathname} ${elapsed}ms`,
  );
};
```

根 middleware 挂到共同合成根节点，覆盖三个 route group。它仅用于演示计时，不做鉴权。浏览器中的 middleware 不是可信服务端授权边界。

`src/routes/hydrate-fallback.tsx`：

```tsx
export default function HydrationFallback() {
  return (
    <main className="hydration-fallback" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>正在准备工作区…</p>
    </main>
  );
}
```

该文件生成根结构路由的 `HydrateFallback`，只对应 React Router 支持的 hydration fallback，不等同 Next.js `loading.tsx` 或应用内导航 loading UI。

`src/routes/not-found.tsx`：

```tsx
import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <main className="content-page">
      <p className="eyebrow">404 · 页面不存在</p>
      <h1>我们没有找到这条路线。</h1>
      <Link className="button" to="/">返回首页</Link>
    </main>
  );
}
```

当前实现只接受**根目录** `not-found.tsx`，并将它生成 React Router `/*` catch-all 叶子；不是 Next.js 的 `not-found` 边界继承模型。

## 10. 文件属性到 Route Object 对照

| 源文件 | 生成属性/节点 | 本示例的加载方式 |
| --- | --- | --- |
| `(public)/layout.tsx` | pathless group 的 `Component` | 使用 `defaultLazy: true` 时 lazy |
| `(public)/page.tsx` | `/` 的 index route `Component` | lazy |
| `pricing/page.tsx` | `/pricing` 下的 index `Component` | lazy |
| `(auth)/auth/sign-in/page.tsx` | `/auth/sign-in` index `Component` | lazy |
| `sign-in/action.ts` | 同一 index route 的 `action` | eager |
| `(workspace)/workspace/layout.tsx` | `/workspace` segment 的 `Component` | eager |
| `workspace/layout.loader.ts` | 同一 segment route 的 `loader` | eager |
| `workspace/page.tsx` | `/workspace` 下 index `Component` | lazy |
| `projects/page.tsx` | `/workspace/projects` index `Component` | lazy |
| `projects/loader.ts` | 同一 index route 的 `loader` | eager |
| `projects/action.ts` | 同一 index route 的 `action` | lazy |
| `[projectId]/page.tsx` | `:projectId` segment 下 index `Component` | lazy |
| `[projectId]/loader.ts` | 动态页面 index route 的 `loader` | eager |
| 根 `middleware.ts` | 共同根的 `middleware` 数组 | 始终静态导入 |
| 根 `hydrate-fallback.tsx` | 共同根 `HydrateFallback` | 默认 lazy |

生成结果省略自动 ID 后，其核心形状如下；eager/lazy 的模块函数由 Vite 编译输出：

```ts
[
  {
    // 根 middleware 和 hydration fallback 挂在共同根
    middleware: [rootMiddleware],
    lazy: { HydrateFallback: loadHydrationFallback },
    children: [
      {
        // route group 不带 path，保持自己的 layout 边界
        children: [
          {
            path: "auth",
            Component: AuthLayout,
            children: [
              {
                path: "sign-in",
                children: [
                  {
                    index: true,
                    action: signInAction,
                    lazy: { Component: loadSignInPage },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        children: [
          {
            path: "workspace",
            Component: WorkspaceLayout,
            loader: workspaceLayoutLoader,
            children: [
              {
                index: true,
                lazy: { Component: loadWorkspacePage },
              },
              {
                path: "projects",
                children: [
                  {
                    index: true,
                    loader: projectsLoader,
                    lazy: {
                      Component: loadProjectsPage,
                      action: loadProjectsAction,
                    },
                  },
                  {
                    path: ":projectId",
                    children: [
                      {
                        index: true,
                        loader: projectLoader,
                        lazy: { Component: loadProjectPage },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
```

这是表达映射关系的示意形状；Routecraft 实际还会为每个节点生成稳定 `id`，并按其编译规则生成静态 import 和 `lazy` 函数。不存在的 `loader`/`action` 不会加入对象。

## 11. 运行和检查

本页代码对应的完整应用目录是 `examples/complete-app`。在仓库根目录按本页创建各文件后，执行：

```sh
npm --prefix examples/complete-app install
npm --prefix examples/complete-app run typecheck
npm --prefix examples/complete-app run dev
```

浏览器打开 Vite 输出的本地地址后，可依次检查 `/`、`/pricing`、`/auth/sign-in`、`/auth/sign-up`、`/workspace`、`/workspace/projects` 与项目详情路径。开发服务器运行期间，还可以打开同源 `/__routecraft` 查看扫描结果和路由树。

仓库中的 `examples/basic` 仍是自动化验证夹具，不包含本页的演示业务页面。由于本示例包清单使用 `"vite-plugin-react-router-routecraft": "file:../.."`，请将完整示例文件放在上述仓库相对目录下安装和运行。独立于该仓库使用时，可通过[安装指南](/getting-started#安装方式)安装发布版本，或在插件仓库执行 `npm pack` 后安装生成的 tarball。

## 12. 演示边界

- 登录 action 不建立 session、不验证账号；生产身份校验必须在服务端完成。
- 项目数组在前端内存中，刷新后重置；生产项目数据应经由经过授权的服务端 API 访问。
- Routecraft 当前生成 URL、参数和 Route ID 类型，不推断业务 loader/action 返回类型。
- Data Mode 的浏览器 loader/action 是路由应用代码，不是 Next Server Action 或后端 HTTP endpoint。
