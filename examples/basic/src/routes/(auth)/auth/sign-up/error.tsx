import { useRouteError } from "react-router";

export default function SignUpErrorBoundary() {
  const error = useRouteError();
  return (
    <>
      <h1>注册页面出错</h1>
      <pre>{error instanceof Error ? error.message : "未知错误"}</pre>
    </>
  );
}
