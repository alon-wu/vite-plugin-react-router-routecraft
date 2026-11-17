import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <main>
      <h1>没有找到这个页面</h1>
      <p>请检查地址，或返回首页继续浏览。</p>
      <Link to="/">返回首页</Link>
    </main>
  );
}
