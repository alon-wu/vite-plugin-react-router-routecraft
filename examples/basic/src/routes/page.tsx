import { Link } from "react-router";

export default function HomePage() {
  return (
    <main>
      <p className="notice">Routecraft 文件路由示例</p>
      <h1>同一套路由表，多个独立布局</h1>
      <p>
        认证分支与工作区分支分别使用自己的布局；目录组名称不会进入公开 URL。
      </p>
      <nav>
        <Link to="/auth/sign-in">登录</Link>
        <Link to="/auth/sign-up">注册</Link>
        <Link to="/workspace">工作区</Link>
        <Link to="/workspace/projects/routecraft">项目详情</Link>
      </nav>
    </main>
  );
}
