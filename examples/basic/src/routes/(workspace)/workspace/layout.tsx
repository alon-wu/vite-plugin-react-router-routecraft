import { Link, Outlet } from "react-router";

export default function BasicLayout() {
  return (
    <main>
      <h1>工作区布局</h1>
      <nav>
        <Link to="/">首页</Link>
        <Link to="/workspace">概览</Link>
        <Link to="/workspace/projects/routecraft">项目详情</Link>
      </nav>
      <Outlet />
    </main>
  );
}
