import { useParams } from "react-router";

export default function ProjectPage() {
  const { projectId } = useParams();
  return (
    <>
      <h2>项目详情</h2>
      <p>当前项目标识：{projectId}</p>
    </>
  );
}
