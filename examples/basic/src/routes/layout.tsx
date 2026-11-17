import { useEffect } from "react";
import { Outlet, useMatches } from "react-router";
import { getDocumentTitle } from "../route-handle";

/** 示例应用从当前匹配链读取 handle 并维护 document.title。 */
export default function RootLayout() {
  const matches = useMatches();
  const title = getDocumentTitle(matches.map((match) => match.handle));

  useEffect(() => {
    document.title = title;
  }, [title]);

  return <Outlet />;
}
