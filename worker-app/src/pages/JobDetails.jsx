import { useParams } from "react-router-dom";
import WorkerWorkspacePage from "./WorkerWorkspace";

export default function JobDetailsPage() {
  const { jobId = "" } = useParams();

  return <WorkerWorkspacePage section="details" jobId={jobId} />;
}
