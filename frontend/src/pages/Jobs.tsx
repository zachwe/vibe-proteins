import { Link } from "react-router-dom";
import { useJobs } from "../lib/hooks";
import { useSession } from "../lib/auth";
import type { Job } from "../lib/api";

const statusStyles: Record<Job["status"], string> = {
  pending: "bg-slate-500",
  running: "bg-yellow-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

const typeLabels: Record<string, string> = {
  rfdiffusion3: "RFDiffusion3",
  boltz2: "Boltz-2",
  proteinmpnn: "ProteinMPNN",
  predict: "Predict",
  score: "Score",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatDuration(startMs: number, endMs: number): string {
  const durationMs = endMs - startMs;
  if (durationMs < 1000) return "<1s";
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

function getJobDuration(job: Job): string | null {
  if (!job.completedAt) return null;
  const start = new Date(job.createdAt).getTime();
  const end = new Date(job.completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return formatDuration(start, end);
}

function renderJobRow(job: Job) {
  return (
    <div
      key={job.id}
      className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-medium">
            {typeLabels[job.type] || job.type}
          </p>
          <p className="text-xs text-slate-400">
            {formatDate(job.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${statusStyles[job.status]}`}
          />
          <span className="text-sm text-slate-300 capitalize">{job.status}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 space-x-2">
          {job.costUsdCents !== null && (
            <span>Cost: ${(job.costUsdCents / 100).toFixed(2)}</span>
          )}
          {(() => {
            const duration = getJobDuration(job);
            if (duration) return <span>Duration: {duration}</span>;
            if (job.executionSeconds !== null && job.gpuType) {
              return <span>{job.executionSeconds.toFixed(1)}s on {job.gpuType}</span>;
            }
            if (job.status === "pending" || job.status === "running") {
              return <span>In progress...</span>;
            }
            return null;
          })()}
        </div>
        <Link
          to={`/jobs/${job.id}`}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          {job.status === "completed" ? "View results" : "View status"}
        </Link>
      </div>
    </div>
  );
}

export default function Jobs() {
  const { data: session, isPending: sessionLoading } = useSession();
  const { data: jobs, isLoading, error } = useJobs();

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-400">Loading jobs...</span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Your Jobs</h1>
          <p className="text-slate-400 mb-4">
            Sign in to view your active and completed jobs.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-400">Loading jobs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4">
          Failed to load jobs: {error.message}
        </div>
      </div>
    );
  }

  const sortedJobs = [...(jobs || [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const activeJobs = sortedJobs.filter(
    (job) => job.status === "pending" || job.status === "running"
  );
  const completedJobs = sortedJobs.filter(
    (job) => job.status === "completed" || job.status === "failed"
  );

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Your Jobs</h1>
          <p className="text-slate-400 text-sm">
            Track active runs and open results when they complete.
          </p>
        </div>
        <Link
          to="/challenges"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Start a new design
        </Link>
      </div>

      {sortedJobs.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center text-slate-400">
          No jobs yet. Submit a design to get started.
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm uppercase tracking-wide text-slate-400">
              In Progress
            </h2>
            {activeJobs.length === 0 ? (
              <p className="text-slate-500 text-sm">No active jobs.</p>
            ) : (
              <div className="grid gap-3">{activeJobs.map(renderJobRow)}</div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm uppercase tracking-wide text-slate-400">
              Completed
            </h2>
            {completedJobs.length === 0 ? (
              <p className="text-slate-500 text-sm">No completed jobs yet.</p>
            ) : (
              <div className="grid gap-3">{completedJobs.map(renderJobRow)}</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
