import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useChallenges, useLeaderboard } from "../lib/hooks";
import type { Challenge, LeaderboardSortBy } from "../lib/api";

const sortOptions: { value: LeaderboardSortBy; label: string }[] = [
  { value: "compositeScore", label: "Composite Score" },
  { value: "plddt", label: "pLDDT" },
  { value: "ptm", label: "pTM" },
  { value: "ipSaeScore", label: "ipSAE" },
  { value: "interfaceArea", label: "Interface Area" },
];

function ChallengeLeaderboard({ challenge }: { challenge: Challenge }) {
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>("compositeScore");
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useLeaderboard(challenge.id, {
    sortBy,
    limit: 10,
    enabled: isExpanded,
  });

  const formatScore = (value: number | null, decimals = 1) => {
    if (value === null || value === undefined) return "-";
    return value.toFixed(decimals);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-750 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-white">{challenge.name}</h2>
            <p className="text-sm text-slate-400">{challenge.taskType}</p>
          </div>
        </div>
        <Link
          to={`/challenges/${challenge.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          View Challenge
        </Link>
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as LeaderboardSortBy)}
              className="bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm py-4">
              Failed to load leaderboard
            </div>
          )}

          {data && data.leaderboard.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No submissions yet. Be the first to submit!
            </div>
          )}

          {data && data.leaderboard.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-2 px-2 w-12">#</th>
                    <th className="text-left py-2 px-2">Designer</th>
                    <th className="text-right py-2 px-2">Score</th>
                    <th className="text-right py-2 px-2">pLDDT</th>
                    <th className="text-right py-2 px-2">pTM</th>
                    <th className="text-right py-2 px-2 hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-700/50 hover:bg-slate-750/50"
                    >
                      <td className="py-2 px-2">
                        {entry.rank <= 3 ? (
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              entry.rank === 1
                                ? "bg-yellow-500 text-yellow-900"
                                : entry.rank === 2
                                  ? "bg-slate-300 text-slate-800"
                                  : "bg-amber-600 text-amber-100"
                            }`}
                          >
                            {entry.rank}
                          </span>
                        ) : (
                          <span className="text-slate-400">{entry.rank}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-white">
                        {entry.userName || "Anonymous"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-white">
                        {formatScore(entry.compositeScore)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-300">
                        {formatScore(entry.plddt)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-300">
                        {formatScore(entry.ptm, 2)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400 hidden sm:table-cell">
                        {formatDate(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {data.totalCount > data.leaderboard.length && (
                <p className="text-center text-slate-400 text-sm mt-4">
                  Showing top {data.leaderboard.length} of {data.totalCount} submissions
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Leaderboards() {
  const { data: challenges, isLoading, error } = useChallenges();

  return (
    <div className="min-h-screen bg-slate-900">
      <Helmet>
        <title>Leaderboards | ProteinDojo</title>
        <meta
          name="description"
          content="View top protein design submissions across all challenges. Compare your designs with other researchers."
        />
        <meta property="og:title" content="Leaderboards | ProteinDojo" />
        <meta
          property="og:description"
          content="View top protein design submissions across all challenges. Compare your designs with other researchers."
        />
        <link rel="canonical" href="https://proteindojo.com/leaderboards" />
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Leaderboards</h1>
        <p className="text-slate-400 mb-8">
          Top protein designs for each challenge, ranked by score.
        </p>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-slate-400">Loading challenges...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4 mb-4">
            Failed to load challenges: {error.message}
          </div>
        )}

        {challenges && challenges.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400">No challenges available yet.</p>
          </div>
        )}

        {challenges && challenges.length > 0 && (
          <div className="space-y-4">
            {challenges.map((challenge) => (
              <ChallengeLeaderboard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
