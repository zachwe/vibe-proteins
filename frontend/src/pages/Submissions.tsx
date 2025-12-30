import { Link } from "react-router-dom";
import { useSubmissions } from "../lib/hooks";
import { useSession } from "../lib/auth";
import type { Submission } from "../lib/api";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function renderSubmissionRow(submission: Submission) {
  const hasScore = submission.score !== null;

  return (
    <div
      key={submission.id}
      className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-3"
    >
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
            className={`w-2.5 h-2.5 rounded-full ${
              hasScore ? "bg-green-500" : "bg-yellow-500"
            }`}
          />
          <span className="text-sm text-slate-300">
            {hasScore ? "Scored" : "Pending"}
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

      {/* Score if available */}
      {hasScore && (
        <div className="flex items-center gap-4 bg-slate-700/50 rounded-lg p-2">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              Score
            </p>
            <p className="text-lg font-semibold text-green-400">
              {submission.score?.toFixed(2)}
            </p>
          </div>
          {submission.feedback && (
            <p className="text-sm text-slate-300 flex-1">{submission.feedback}</p>
          )}
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
        <Link
          to={`/challenges/${submission.challengeId}`}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          View Challenge
        </Link>
      </div>
    </div>
  );
}

export default function Submissions() {
  const { data: session, isPending: sessionLoading } = useSession();
  const { data: submissions, isLoading, error } = useSubmissions();

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
        <Link
          to="/challenges"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Start a new design
        </Link>
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
          {sortedSubmissions.map(renderSubmissionRow)}
        </div>
      )}
    </div>
  );
}
