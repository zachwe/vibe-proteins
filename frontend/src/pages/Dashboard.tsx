import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useSession, signOut } from "../lib/auth";
import { useCurrentUser, useSubmissions, useJobs, useChallenges } from "../lib/hooks";
import { usersApi } from "../lib/api";
import type { Submission, Job } from "../lib/api";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    case "running":
      return "bg-blue-500 animate-pulse";
    case "pending":
    default:
      return "bg-yellow-500";
  }
}

function getJobTypeLabel(type: string) {
  switch (type) {
    case "rfdiffusion3":
      return "RFDiffusion3";
    case "boltz2":
      return "Boltz-2";
    case "proteinmpnn":
      return "ProteinMPNN";
    case "predict":
      return "Predict";
    case "score":
      return "Score";
    default:
      return type;
  }
}

// Stats card component
function StatCard({ label, value, subtext, color = "text-white" }: {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  );
}

// Quick action link component
function QuickLink({ to, icon, label, description }: {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4 hover:bg-slate-700/50 hover:border-slate-600 transition-colors group"
    >
      <div className="text-blue-400 group-hover:text-blue-300 transition-colors mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-white font-medium group-hover:text-blue-300 transition-colors">
          {label}
        </p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </Link>
  );
}

// Mini submission preview
function SubmissionPreview({ submission }: { submission: Submission }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${getStatusColor(submission.status)}`} />
        <div>
          <p className="text-sm text-white">{submission.challengeId}</p>
          <p className="text-xs text-slate-500">{formatDate(submission.createdAt)}</p>
        </div>
      </div>
      {submission.status === "completed" && submission.compositeScore !== null && (
        <span className="text-sm font-medium text-green-400">
          {submission.compositeScore.toFixed(1)}
        </span>
      )}
      {submission.status === "failed" && (
        <span className="text-xs text-red-400">Failed</span>
      )}
      {(submission.status === "pending" || submission.status === "running") && (
        <span className="text-xs text-slate-400 capitalize">{submission.status}</span>
      )}
    </div>
  );
}

// Mini job preview
function JobPreview({ job }: { job: Job }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${getStatusColor(job.status)}`} />
        <div>
          <p className="text-sm text-white">{getJobTypeLabel(job.type)}</p>
          <p className="text-xs text-slate-500">{formatDate(job.createdAt)}</p>
        </div>
      </div>
      {job.costUsdCents !== null && job.costUsdCents > 0 && (
        <span className="text-xs text-slate-400">
          {formatCents(job.costUsdCents)}
        </span>
      )}
      {(job.status === "pending" || job.status === "running") && (
        <span className="text-xs text-slate-400 capitalize">{job.status}</span>
      )}
    </div>
  );
}

// Progress bar component
function ProgressBar({ current, total, label }: {
  current: number;
  total: number;
  label: string;
}) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm text-slate-400">{current} / {total}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Delete account confirmation modal
function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-2">Delete Account</h2>
        <p className="text-slate-300 mb-4">
          Are you sure you want to delete your account? This action is <span className="text-red-400 font-semibold">permanent</span> and cannot be undone.
        </p>
        <p className="text-slate-400 text-sm mb-6">
          All your data will be deleted, including:
        </p>
        <ul className="text-slate-400 text-sm mb-6 list-disc list-inside space-y-1">
          <li>Your profile and settings</li>
          <li>All design jobs and history</li>
          <li>All submissions and scores</li>
          <li>Any remaining account balance</li>
        </ul>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: session, isPending: sessionLoading } = useSession();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: submissions, isLoading: submissionsLoading } = useSubmissions();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: challenges } = useChallenges();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Compute stats
  const totalSubmissions = submissions?.length ?? 0;
  const completedSubmissions = submissions?.filter(s => s.status === "completed").length ?? 0;
  const totalJobs = jobs?.length ?? 0;
  const completedJobs = jobs?.filter(j => j.status === "completed").length ?? 0;
  const totalSpentCents = jobs?.reduce((sum, j) => sum + (j.costUsdCents ?? 0), 0) ?? 0;

  // Unique challenges with completed submissions
  const challengesCompleted = new Set(
    submissions?.filter(s => s.status === "completed").map(s => s.challengeId)
  ).size;
  const totalChallenges = challenges?.length ?? 0;

  // Recent activity (last 5)
  const recentSubmissions = [...(submissions ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const recentJobs = [...(jobs ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  // Best submission score
  const bestScore = submissions
    ?.filter(s => s.compositeScore !== null)
    .reduce((best, s) => Math.max(best, s.compositeScore ?? 0), 0) ?? 0;

  // Loading states
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-3 text-slate-400">Loading...</span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Sign in to view your dashboard</h1>
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const isLoading = userLoading || submissionsLoading || jobsLoading;

  return (
    <div className="min-h-screen bg-slate-900">
      <Helmet>
        <title>Dashboard | ProteinDojo</title>
        <meta name="description" content="Your ProteinDojo dashboard - track your progress, submissions, and jobs." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">
            Welcome back, {session.user.name || session.user.email.split("@")[0]}
          </h1>
          <p className="text-slate-400">
            Track your protein design progress and recent activity
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <span className="ml-3 text-slate-400">Loading dashboard...</span>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Balance"
                value={user?.balanceFormatted ?? "$0.00"}
                color="text-green-400"
              />
              <StatCard
                label="Submissions"
                value={totalSubmissions}
                subtext={`${completedSubmissions} scored`}
              />
              <StatCard
                label="Jobs Run"
                value={totalJobs}
                subtext={`${formatCents(totalSpentCents)} spent`}
              />
              <StatCard
                label="Best Score"
                value={bestScore > 0 ? bestScore.toFixed(1) : "—"}
                color={bestScore > 0 ? "text-purple-400" : "text-slate-500"}
              />
            </div>

            {/* Progress Section */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">Your Progress</h2>
              <ProgressBar
                current={challengesCompleted}
                total={totalChallenges}
                label="Challenges Completed"
              />
              <p className="text-xs text-slate-500 mt-3">
                Complete a challenge by submitting a design that gets scored successfully.
              </p>
            </div>

            {/* Quick Actions */}
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <QuickLink
                to="/challenges"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                }
                label="Start New Design"
                description="Browse challenges and design binders"
              />
              <QuickLink
                to="/submissions"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                  </svg>
                }
                label="View Submissions"
                description="See all your scored designs"
              />
              <QuickLink
                to="/leaderboards"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.992 0" />
                  </svg>
                }
                label="Leaderboards"
                description="Compare your scores with others"
              />
            </div>

            {/* Recent Activity Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Submissions */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Recent Submissions</h2>
                  <Link to="/submissions" className="text-sm text-blue-400 hover:text-blue-300">
                    View all
                  </Link>
                </div>
                {recentSubmissions.length > 0 ? (
                  <div className="divide-y divide-slate-700">
                    {recentSubmissions.map(submission => (
                      <SubmissionPreview key={submission.id} submission={submission} />
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm py-4 text-center">
                    No submissions yet. Start designing!
                  </p>
                )}
              </div>

              {/* Recent Jobs */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Recent Jobs</h2>
                  <Link to="/jobs" className="text-sm text-blue-400 hover:text-blue-300">
                    View all
                  </Link>
                </div>
                {recentJobs.length > 0 ? (
                  <div className="divide-y divide-slate-700">
                    {recentJobs.map(job => (
                      <JobPreview key={job.id} job={job} />
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm py-4 text-center">
                    No jobs yet. Run a design job to get started!
                  </p>
                )}
              </div>
            </div>

            {/* Additional Links */}
            <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
              <Link to="/jobs" className="text-slate-400 hover:text-white transition-colors">
                All Jobs
              </Link>
              <span className="text-slate-600">•</span>
              <Link to="/billing" className="text-slate-400 hover:text-white transition-colors">
                Billing & Transactions
              </Link>
              <span className="text-slate-600">•</span>
              <Link to="/help" className="text-slate-400 hover:text-white transition-colors">
                Help & Documentation
              </Link>
            </div>

            {/* Sign Out / Delete Account */}
            <div className="mt-12 pt-6 border-t border-slate-800 flex justify-center gap-6">
              <button
                onClick={async () => {
                  await signOut();
                  window.location.href = "/";
                }}
                className="text-slate-500 hover:text-white text-sm transition-colors"
              >
                Sign Out
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-slate-500 hover:text-red-400 text-sm transition-colors"
              >
                Delete Account
              </button>
            </div>

            <DeleteAccountModal
              isOpen={showDeleteModal}
              onClose={() => setShowDeleteModal(false)}
              isDeleting={isDeleting}
              onConfirm={async () => {
                setIsDeleting(true);
                try {
                  await usersApi.deleteAccount();
                  await signOut();
                  window.location.href = "/";
                } catch (error) {
                  console.error("Failed to delete account:", error);
                  setIsDeleting(false);
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
