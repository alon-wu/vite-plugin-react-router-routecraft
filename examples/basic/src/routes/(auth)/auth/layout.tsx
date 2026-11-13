import { Link, Outlet } from "react-router";

export default function BlankLayout() {
  return (
    <main>
      <nav>
        <Link to="/">首页</Link>
        <Link to="/auth/sign-in">登录</Link>
        <Link to="/auth/sign-up">注册</Link>
      </nav>
      <section>
        <Outlet />
      </section>
    </main>
  );
}
