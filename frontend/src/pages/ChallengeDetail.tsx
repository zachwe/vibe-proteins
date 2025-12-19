import { useParams, Link } from "react-router-dom";
import { useChallenge } from "../lib/hooks";
import MolstarViewer from "../components/MolstarViewer";

const levelColors: Record<number, string> = {
  1: "bg-green-600",
  2: "bg-yellow-600",
  3: "bg-orange-600",
  4: "bg-red-600",
};

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: challenge, isLoading, error } = useChallenge(id || "");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-400">Loading challenge...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Link to="/challenges" className="text-blue-400 hover:text-blue-300">
              &larr; Back to Challenges
            </Link>
          </div>
          <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4">
            {error.message === "HTTP 404"
              ? "Challenge not found"
              : `Failed to load challenge: ${error.message}`}
          </div>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/challenges" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Challenges
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left side - Target viewer */}
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="aspect-square bg-slate-700 rounded-lg overflow-hidden">
              <MolstarViewer
                pdbUrl={challenge.targetStructureUrl || undefined}
                pdbId={challenge.targetPdbId || undefined}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Right side - Challenge info and workflow */}
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl p-6">
              <h1 className="text-2xl font-bold text-white mb-4">
                {challenge.name}
              </h1>

              {challenge.description && (
                <p className="text-slate-400 mb-4">{challenge.description}</p>
              )}

              {challenge.educationalContent && (
                <div className="text-slate-300 mb-4 prose prose-invert prose-sm max-w-none">
                  {challenge.educationalContent}
                </div>
              )}

              <div className="flex gap-2 mb-4">
                <span
                  className={`${levelColors[challenge.level] || "bg-slate-600"} text-white text-xs font-semibold px-2 py-1 rounded`}
                >
                  Level {challenge.level}
                </span>
                <span className="bg-slate-600 text-white text-xs font-semibold px-2 py-1 rounded">
                  {challenge.taskType}
                </span>
                <span className="text-slate-500 text-sm ml-2">
                  {"★".repeat(challenge.difficulty)}
                  {"☆".repeat(Math.max(0, 5 - challenge.difficulty))}
                </span>
              </div>

            </div>

            {/* Workflow steps */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Design Workflow
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-slate-700 rounded-lg">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    1
                  </div>
                  <div>
                    <p className="text-white font-medium">Explore</p>
                    <p className="text-slate-400 text-sm">
                      View target structure and binding sites
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-slate-700 rounded-lg opacity-50">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white font-semibold">
                    2
                  </div>
                  <div>
                    <p className="text-white font-medium">Design</p>
                    <p className="text-slate-400 text-sm">
                      Generate candidates with AI tools
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-slate-700 rounded-lg opacity-50">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white font-semibold">
                    3
                  </div>
                  <div>
                    <p className="text-white font-medium">Evaluate</p>
                    <p className="text-slate-400 text-sm">
                      Score and compare your designs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-slate-700 rounded-lg opacity-50">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white font-semibold">
                    4
                  </div>
                  <div>
                    <p className="text-white font-medium">Submit</p>
                    <p className="text-slate-400 text-sm">
                      Submit for official scoring
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
              Start Designing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
