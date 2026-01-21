import { Link } from "react-router-dom";
import { useSubmissions, useRetrySubmission } from "../lib/hooks";
import { useSession } from "../lib/auth";
import type { Submission } from "../lib/api";
import Spinner from "../components/Spinner";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getStatusDisplay(submission: Submission) {
  const status = submission.status || "pending";
  switch (status) {
    case "completed":
      return { color: "bg-green-500", label: "Scored" };
    case "failed":
      return { color: "bg-red-500", label: "Failed" };
    case "running":
      return { color: "bg-blue-500 animate-pulse", label: "Scoring..." };
    case "pending":
    default:
      return { color: "bg-yellow-500", label: "Pending" };
  }
}

function isStuckPending(submission: Submission): boolean {
  if (submission.status !== "pending") return false;
  const createdAt = new Date(submission.createdAt);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return createdAt < fiveMinutesAgo;
}

function canRetry(submission: Submission): boolean {
  return submission.status === "failed" || isStuckPending(submission);
}

interface SubmissionRowProps {
  submission: Submission;
  onRetry: (id: string) => void;
  isRetrying: boolean;
}

function SubmissionRow({ submission, onRetry, isRetrying }: SubmissionRowProps) {
  const statusDisplay = getStatusDisplay(submission);
  const showRetry = canRetry(submission);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-medium">
            Challenge: {submission.challengeId}
          </p>
          <p className="text-xs text-slate-400">
            {formatDate(submission.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${statusDisplay.color}`}
          />
          <span className="text-sm text-slate-300">
            {statusDisplay.label}
          </span>
        </div>
      </div>

      {/* Sequence preview */}
      <div className="bg-slate-700/50 rounded-lg p-2">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">
          Binder Sequence
        </p>
        <p className="font-mono text-xs text-slate-300 truncate">
          {submission.designSequence.slice(0, 60)}
          {submission.designSequence.length > 60 ? "..." : ""}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {submission.designSequence.length} residues
        </p>
      </div>

      {/* Scores if available */}
      {submission.status === "completed" && submission.compositeScore !== null && (
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-6 mb-2">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                Composite Score
              </p>
              <p className="text-lg font-semibold text-green-400">
                {submission.compositeScore?.toFixed(1)}
              </p>
            </div>
            {submission.ipSaeScore !== null && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                  ipSAE
                </p>
                <p className="text-sm font-medium text-slate-200">
                  {submission.ipSaeScore?.toFixed(1)}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            {submission.interfaceArea !== null && (
              <span>Interface: {submission.interfaceArea?.toFixed(0)} A²</span>
            )}
            {submission.shapeComplementarity !== null && (
              <span>SC: {submission.shapeComplementarity?.toFixed(2)}</span>
            )}
            {submission.plddt !== null && (
              <span>pLDDT: {submission.plddt?.toFixed(1)}</span>
            )}
            {submission.ptm !== null && (
              <span>pTM: {submission.ptm?.toFixed(2)}</span>
            )}
          </div>
        </div>
      )}

      {/* Error if failed */}
      {submission.status === "failed" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 flex items-center justify-between">
          <p className="text-xs text-red-400">
            {submission.error || "Scoring failed. Please try again."}
          </p>
        </div>
      )}

      {/* Stuck pending warning */}
      {isStuckPending(submission) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
          <p className="text-xs text-yellow-400">
            This submission has been pending for a while. You can retry scoring.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {submission.designPdbUrl ? (
            <span className="text-green-400">Structure available</span>
          ) : (
            <span>Sequence only</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showRetry && (
            <button
              onClick={() => onRetry(submission.id)}
              disabled={isRetrying}
              className="text-sm text-orange-400 hover:text-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRetrying ? "Retrying..." : "Retry Scoring"}
            </button>
          )}
          {submission.status === "completed" && submission.designStructureSignedUrl && (
            <Link
              to={`/view/submission/${submission.id}`}
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              View 3D
            </Link>
          )}
          <Link
            to={`/challenges/${submission.challengeId}`}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            View Challenge
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Submissions() {
  const { data: session, isPending: sessionLoading } = useSession();
  const { data: submissions, isLoading, error } = useSubmissions();
  const retryMutation = useRetrySubmission();

  const handleRetry = (submissionId: string) => {
    retryMutation.mutate(submissionId);
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
        <span className="ml-3 text-slate-400">Loading submissions...</span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Your Submissions</h1>
          <p className="text-slate-400 mb-4">
            Sign in to view your submitted designs.
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
        <Spinner size="lg" />
        <span className="ml-3 text-slate-400">Loading submissions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4">
          Failed to load submissions: {error.message}
        </div>
      </div>
    );
  }

  const sortedSubmissions = [...(submissions || [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Your Submissions</h1>
          <p className="text-slate-400 text-sm">
            Designs you've submitted for scoring.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/submit"
            className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Submit Your Own
          </Link>
          <Link
            to="/challenges"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Use Design Tools
          </Link>
        </div>
      </div>

      {sortedSubmissions.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-400 mb-4">
            No submissions yet. Complete a design and submit it for scoring!
          </p>
          <Link
            to="/challenges"
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Browse Challenges
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {sortedSubmissions.map((submission) => (
            <SubmissionRow
              key={submission.id}
              submission={submission}
              onRetry={handleRetry}
              isRetrying={retryMutation.isPending && retryMutation.variables === submission.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
