import { Link, useNavigate, useParams } from "react-router-dom";
import { useJob } from "../lib/hooks";
import ResultsPanel from "../components/ResultsPanel";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading, error } = useJob(id || "");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-400">Loading job...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="mb-6">
          <Link to="/jobs" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Jobs
          </Link>
        </div>
        <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4">
          Failed to load job: {error.message}
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="mb-6">
          <Link to="/jobs" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Jobs
          </Link>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-slate-400">
          Job not found.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6">
        <Link to="/jobs" className="text-blue-400 hover:text-blue-300">
          &larr; Back to Jobs
        </Link>
      </div>
      <ResultsPanel
        job={job}
        onClose={() => navigate("/jobs")}
        onNewDesign={() => navigate(`/challenges/${job.challengeId}`)}
      />
    </div>
  );
}
