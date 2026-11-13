import { useLoaderData } from "react-router";

export default function WorkspacePage() {
  const data = useLoaderData() as { title: string; projects: number };
  return (
    <>
      <h2>{data.title}</h2>
      <p>项目数：{data.projects}</p>
    </>
  );
}
