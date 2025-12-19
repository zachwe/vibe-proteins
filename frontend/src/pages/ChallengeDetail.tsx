import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import Markdown from "react-markdown";
import { useChallenge } from "../lib/hooks";
import MolstarViewer from "../components/MolstarViewer";
import DesignPanel from "../components/DesignPanel";

const workflowSteps = [
  { id: 1, name: "Explore", description: "View target structure" },
  { id: 2, name: "Design", description: "Generate candidates" },
  { id: 3, name: "Evaluate", description: "Score designs" },
  { id: 4, name: "Submit", description: "Submit for scoring" },
];

const levelColors: Record<number, string> = {
  1: "bg-green-600",
  2: "bg-yellow-600",
  3: "bg-orange-600",
  4: "bg-red-600",
};

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: challenge, isLoading, error } = useChallenge(id || "");
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-400">Loading challenge...</span>
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (!challenge) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/challenges" className="text-blue-400 hover:text-blue-300">
          &larr; Back to Challenges
        </Link>
      </div>

      {/* Horizontal Progress Bar */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {workflowSteps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step dot and label */}
              <button
                onClick={() => setCurrentStep(step.id)}
                className="flex flex-col items-center group"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                    step.id === currentStep
                      ? "bg-blue-600 text-white ring-4 ring-blue-600/30"
                      : step.id < currentStep
                        ? "bg-green-600 text-white"
                        : "bg-slate-600 text-slate-400 group-hover:bg-slate-500"
                  }`}
                >
                  {step.id < currentStep ? "✓" : step.id}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    step.id === currentStep
                      ? "text-blue-400"
                      : step.id < currentStep
                        ? "text-green-400"
                        : "text-slate-500"
                  }`}
                >
                  {step.name}
                </span>
              </button>

              {/* Connector line (not after last step) */}
              {index < workflowSteps.length - 1 && (
                <div className="flex-1 mx-2">
                  <div
                    className={`h-1 rounded-full ${
                      step.id < currentStep ? "bg-green-600" : "bg-slate-600"
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
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

        {/* Right side - Challenge info */}
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
                <Markdown>{challenge.educationalContent}</Markdown>
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

          {showDesignPanel ? (
            <DesignPanel
              challengeId={challenge.id}
              targetSequence={challenge.targetSequence}
              targetStructureUrl={challenge.targetStructureUrl}
              onClose={() => setShowDesignPanel(false)}
            />
          ) : (
            <button
              onClick={() => {
                setShowDesignPanel(true);
                setCurrentStep(2);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Start Designing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
