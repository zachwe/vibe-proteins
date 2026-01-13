/**
 * Leaderboard component for displaying challenge rankings
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeaderboard, useReferenceBinders, useCurrentUser } from "../lib/hooks";
import type { LeaderboardSortBy, LeaderboardEntry, ReferenceBinder } from "../lib/api";

interface LeaderboardProps {
  challengeId: string;
  challengeName?: string;
}

const SORT_OPTIONS: { value: LeaderboardSortBy; label: string }[] = [
  { value: "compositeScore", label: "Composite Score" },
  { value: "plddt", label: "pLDDT" },
  { value: "ptm", label: "pTM" },
  { value: "ipSaeScore", label: "ipSAE" },
  { value: "interfaceArea", label: "Interface Area" },
  { value: "shapeComplementarity", label: "Shape Comp." },
];

function formatScore(value: number | null, metric: string): string {
  if (value === null || value === undefined) return "—";

  // Different formatting based on metric type
  switch (metric) {
    case "plddt":
      return value.toFixed(1);
    case "interfaceArea":
      return value.toFixed(0);
    default:
      return value.toFixed(3);
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500 text-yellow-900 font-bold text-sm">
        🥇
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300 text-slate-700 font-bold text-sm">
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-600 text-amber-100 font-bold text-sm">
        🥉
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 text-slate-300 font-bold text-sm">
      {rank}
    </span>
  );
}

// Binder type badges
const BINDER_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  antibody: { label: "Antibody", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: "🧪" },
  nanobody: { label: "Nanobody", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: "🔬" },
  fusion_protein: { label: "Fusion", color: "bg-green-500/20 text-green-300 border-green-500/30", icon: "🔗" },
  designed: { label: "Designed", color: "bg-orange-500/20 text-orange-300 border-orange-500/30", icon: "🤖" },
  natural: { label: "Natural", color: "bg-teal-500/20 text-teal-300 border-teal-500/30", icon: "🌿" },
};

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  fda_approved: { label: "FDA Approved", color: "text-emerald-400" },
  clinical_trial: { label: "Clinical Trial", color: "text-yellow-400" },
  research_tool: { label: "Research Tool", color: "text-slate-400" },
  de_novo_designed: { label: "AI Designed", color: "text-orange-400" },
};

function ReferenceBinderRow({
  binder,
  sortBy,
}: {
  binder: ReferenceBinder;
  sortBy: LeaderboardSortBy;
}) {
  const binderConfig = BINDER_TYPE_CONFIG[binder.binderType] || BINDER_TYPE_CONFIG.antibody;
  const approvalConfig = APPROVAL_STATUS_CONFIG[binder.approvalStatus || "research_tool"];

  // Get the primary score based on sort (reference binders may not have scores yet)
  const getPrimaryScore = () => {
    switch (sortBy) {
      case "plddt":
        return binder.plddt;
      case "ptm":
        return binder.ptm;
      case "ipSaeScore":
        return binder.ipSaeScore;
      case "interfaceArea":
        return binder.interfaceArea;
      case "shapeComplementarity":
        return binder.shapeComplementarity;
      default:
        return binder.compositeScore;
    }
  };

  const score = getPrimaryScore();

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r from-amber-900/20 to-slate-800/50 border border-amber-500/20">
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${binderConfig.color} border text-sm`}>
        {binderConfig.icon}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-amber-200 truncate">
            {binder.name}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${binderConfig.color} border`}>
            {binderConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
          <span className={approvalConfig.color}>{approvalConfig.label}</span>
          {binder.discoveryYear && (
            <>
              <span>•</span>
              <span>{binder.discoveryYear}</span>
            </>
          )}
          {binder.pdbId && (
            <>
              <span>•</span>
              <a
                href={binder.pdbUrl || `https://www.rcsb.org/structure/${binder.pdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                PDB {binder.pdbId}
              </a>
            </>
          )}
        </div>
        {binder.shortDescription && (
          <p
            className="text-xs text-slate-500 mt-1 line-clamp-1 cursor-help"
            title={binder.shortDescription}
          >
            {binder.shortDescription}
          </p>
        )}
      </div>

      <div className="text-right flex flex-col items-end gap-1">
        {score !== null ? (
          <div className="flex items-center gap-1.5">
            {binder.scoringNote && (
              <span
                className="text-amber-500 cursor-help"
                title={binder.scoringNote}
              >
                ⚠️
              </span>
            )}
            <span className="text-lg font-bold text-amber-400">
              {formatScore(score, sortBy)}
            </span>
          </div>
        ) : (
          <div className="text-sm text-slate-500">—</div>
        )}
        <div className="flex items-center gap-2">
          {(binder.complexStructureUrl || binder.pdbUrl) && (
            <Link
              to={`/view/reference/${binder.id}`}
              className="text-xs text-emerald-400 hover:text-emerald-300"
              title="View 3D structure"
            >
              3D
            </Link>
          )}
          {binder.helpArticleSlug && (
            <Link
              to={`/help/${binder.helpArticleSlug}`}
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
            >
              Learn more →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  sortBy,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  sortBy: LeaderboardSortBy;
  isCurrentUser: boolean;
}) {
  // Get the primary score based on sort
  const getPrimaryScore = () => {
    switch (sortBy) {
      case "plddt":
        return entry.plddt;
      case "ptm":
        return entry.ptm;
      case "ipSaeScore":
        return entry.ipSaeScore;
      case "interfaceArea":
        return entry.interfaceArea;
      case "shapeComplementarity":
        return entry.shapeComplementarity;
      default:
        return entry.compositeScore;
    }
  };

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
        isCurrentUser
          ? "bg-blue-600/20 border border-blue-500/30"
          : "bg-slate-800/50 hover:bg-slate-700/50"
      }`}
    >
      <RankBadge rank={entry.rank} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${isCurrentUser ? "text-blue-300" : "text-white"}`}>
            {entry.userName}
          </span>
          {isCurrentUser && (
            <span className="text-xs bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded">
              You
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {formatDate(entry.createdAt)}
        </div>
      </div>

      <div className="text-right flex flex-col items-end">
        <div className="text-lg font-bold text-emerald-400">
          {formatScore(getPrimaryScore(), sortBy)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 capitalize">
            {sortBy === "compositeScore" ? "Score" : sortBy}
          </span>
          <Link
            to={`/view/submission/${entry.id}`}
            className="text-xs text-emerald-400 hover:text-emerald-300"
            title="View 3D structure"
          >
            3D
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">🏆</div>
      <h3 className="text-lg font-medium text-white mb-2">No submissions yet</h3>
      <p className="text-slate-400 text-sm">
        Be the first to submit a design for this challenge!
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg animate-pulse">
          <div className="w-8 h-8 rounded-full bg-slate-700" />
          <div className="flex-1">
            <div className="h-4 bg-slate-700 rounded w-24 mb-2" />
            <div className="h-3 bg-slate-700 rounded w-16" />
          </div>
          <div className="text-right">
            <div className="h-5 bg-slate-700 rounded w-12 mb-1" />
            <div className="h-3 bg-slate-700 rounded w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Leaderboard({ challengeId }: LeaderboardProps) {
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>("compositeScore");
  const { data, isLoading, error } = useLeaderboard(challengeId, { sortBy, limit: 50 });
  const { data: referenceBinders, isLoading: refLoading } = useReferenceBinders(challengeId);
  const { data: currentUser } = useCurrentUser();

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-4 text-sm">
        Failed to load leaderboard
      </div>
    );
  }

  const hasReferenceBinders = referenceBinders && referenceBinders.length > 0;
  const hasUserSubmissions = data?.leaderboard && data.leaderboard.length > 0;

  return (
    <div>
      {/* Header with sort selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🏆</span>
          Leaderboard
        </h3>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as LeaderboardSortBy)}
          className="bg-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading state */}
      {(isLoading || refLoading) && <LoadingState />}

      {/* Reference binders section */}
      {!refLoading && hasReferenceBinders && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-amber-300 uppercase tracking-wide">
              Reference Binders
            </h4>
            <span className="text-xs text-slate-500">
              Known therapeutics and research tools
            </span>
          </div>
          <div className="space-y-2">
            {referenceBinders.map((binder) => (
              <ReferenceBinderRow key={binder.id} binder={binder} sortBy={sortBy} />
            ))}
          </div>
        </div>
      )}

      {/* User submissions section */}
      {!isLoading && (
        <>
          {hasReferenceBinders && (
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wide">
                User Submissions
              </h4>
              <span className="text-xs text-slate-500">
                Designs from ProteinDojo users
              </span>
            </div>
          )}

          {!hasUserSubmissions ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {data.leaderboard.map((entry) => (
                <LeaderboardRow
                  key={entry.id}
                  entry={entry}
                  sortBy={sortBy}
                  isCurrentUser={currentUser?.id === entry.userId}
                />
              ))}

              {/* Total count */}
              {data.totalCount > data.leaderboard.length && (
                <p className="text-center text-xs text-slate-500 pt-2">
                  Showing top {data.leaderboard.length} of {data.totalCount} submissions
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
