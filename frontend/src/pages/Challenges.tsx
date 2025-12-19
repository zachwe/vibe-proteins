import { Link } from "react-router-dom";
import { useChallenges } from "../lib/hooks";

const levelColors: Record<number, string> = {
  1: "bg-green-600",
  2: "bg-yellow-600",
  3: "bg-orange-600",
  4: "bg-red-600",
};

export default function Challenges() {
  const { data: challenges, isLoading, error } = useChallenges();

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-8">
          Protein Design Challenges
        </h1>

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
          <div className="grid gap-4">
            {challenges.map((challenge) => (
              <Link
                key={challenge.id}
                to={`/challenges/${challenge.id}`}
                className="bg-slate-800 rounded-lg p-6 hover:bg-slate-750 transition-colors block"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`${levelColors[challenge.level] || "bg-slate-600"} text-white text-xs font-semibold px-2 py-1 rounded`}
                      >
                        Level {challenge.level}
                      </span>
                      <span className="text-slate-500 text-sm">
                        {challenge.taskType}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">
                      {challenge.name}
                    </h2>
                    <p className="text-slate-400">{challenge.description}</p>
                  </div>
                  <div className="text-slate-500">
                    {"★".repeat(challenge.difficulty)}
                    {"☆".repeat(Math.max(0, 5 - challenge.difficulty))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
