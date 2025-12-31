/**
 * Leaderboard component for displaying challenge rankings
 */

import { useState } from "react";
import { useLeaderboard } from "../lib/hooks";
import { useCurrentUser } from "../lib/hooks";
import type { LeaderboardSortBy, LeaderboardEntry } from "../lib/api";

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

      <div className="text-right">
        <div className="text-lg font-bold text-emerald-400">
          {formatScore(getPrimaryScore(), sortBy)}
        </div>
        <div className="text-xs text-slate-500 capitalize">
          {sortBy === "compositeScore" ? "Score" : sortBy}
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
  const { data: currentUser } = useCurrentUser();

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-4 text-sm">
        Failed to load leaderboard
      </div>
    );
  }

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

      {/* Leaderboard content */}
      {isLoading ? (
        <LoadingState />
      ) : !data?.leaderboard.length ? (
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
    </div>
  );
}
