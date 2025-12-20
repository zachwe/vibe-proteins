/**
 * Design Panel Component
 *
 * Handles the design workflow: tool selection, job submission, and status tracking.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateJob, useJob } from "../lib/hooks";
import { useSession } from "../lib/auth";
import ResultsPanel from "./ResultsPanel";

interface DesignPanelProps {
  challengeId: string;
  targetSequence: string | null;
  targetStructureUrl: string | null;
  onClose: () => void;
}

type DesignTool = "rfdiffusion3" | "boltz2" | "proteinmpnn";

const toolInfo: Record<DesignTool, { name: string; description: string; credits: number }> = {
  rfdiffusion3: {
    name: "RFDiffusion3",
    description: "RFDiffusion3 backbone design + ProteinMPNN sequences + Boltz-2 sanity check",
    credits: 12,
  },
  boltz2: {
    name: "Boltz-2",
    description: "Fast co-fold sanity check for binder + target complexes",
    credits: 6,
  },
  proteinmpnn: {
    name: "ProteinMPNN",
    description: "Sequence design for a given backbone structure",
    credits: 4,
  },
};

export default function DesignPanel({
  challengeId,
  targetSequence,
  targetStructureUrl,
  onClose,
}: DesignPanelProps) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const createJob = useCreateJob();

  const [selectedTool, setSelectedTool] = useState<DesignTool>("rfdiffusion3");
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Poll job status if we've submitted a job
  const { data: job } = useJob(submittedJobId || "");

  const handleSubmit = async () => {
    if (!session?.user) {
      navigate("/login");
      return;
    }

    try {
      const result = await createJob.mutateAsync({
        challengeId,
        type: selectedTool,
        input: {
          targetSequence,
          targetStructureUrl,
        },
      });

      setSubmittedJobId(result.job.id);
    } catch (error) {
      console.error("Failed to submit job:", error);
    }
  };

  // Show results panel if viewing results
  if (showResults && job) {
    return (
      <ResultsPanel
        job={job}
        onClose={onClose}
        onNewDesign={() => {
          setShowResults(false);
          setSubmittedJobId(null);
        }}
      />
    );
  }

  // Show job status if a job has been submitted
  if (submittedJobId && job) {
    return (
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Job Status</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              job.status === "completed" ? "bg-green-500" :
              job.status === "failed" ? "bg-red-500" :
              job.status === "running" ? "bg-yellow-500 animate-pulse" :
              "bg-slate-500"
            }`} />
            <span className="text-white font-medium capitalize">{job.status}</span>
          </div>

          <div className="text-sm text-slate-400">
            <p>Tool: {toolInfo[job.type as DesignTool]?.name || job.type}</p>
            <p>Credits used: {job.creditsUsed}</p>
            <p>Started: {new Date(job.createdAt).toLocaleString()}</p>
          </div>

          {job.status === "pending" || job.status === "running" ? (
            <div className="flex items-center gap-2 text-slate-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>Processing your design...</span>
            </div>
          ) : null}

          {job.status === "completed" && (
            <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
              <p className="text-green-400 font-medium mb-2">Design complete!</p>
              <p className="text-slate-300 text-sm">
                Your binder design has been generated. View the results to see the predicted structure and scores.
              </p>
              <button
                onClick={() => setShowResults(true)}
                className="mt-3 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                View Results
              </button>
            </div>
          )}

          {job.status === "failed" && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
              <p className="text-red-400 font-medium mb-2">Job failed</p>
              <p className="text-slate-300 text-sm">
                Something went wrong. Please try again or contact support.
              </p>
              <button
                onClick={() => setSubmittedJobId(null)}
                className="mt-3 bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Design Your Binder</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white"
        >
          Close
        </button>
      </div>

      {!session?.user && (
        <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4 mb-4">
          <p className="text-yellow-400 text-sm">
            You need to sign in to submit design jobs.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="mt-2 text-yellow-300 hover:text-yellow-200 underline text-sm"
          >
            Sign in now
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select Design Tool
          </label>
          <div className="space-y-2">
            {(Object.entries(toolInfo) as [DesignTool, typeof toolInfo[DesignTool]][]).map(
              ([key, info]) => (
                <button
                  key={key}
                  onClick={() => setSelectedTool(key)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedTool === key
                      ? "bg-blue-600/20 border-blue-500"
                      : "bg-slate-700 border-slate-600 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{info.name}</span>
                    <span className="text-slate-400 text-sm">{info.credits} credits</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">{info.description}</p>
                </button>
              )
            )}
          </div>
        </div>

        {targetSequence && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Target Sequence
            </label>
            <div className="bg-slate-700 rounded-lg p-3 font-mono text-xs text-slate-300 break-all max-h-24 overflow-y-auto">
              {targetSequence}
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={createJob.isPending || !session?.user}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {createJob.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Submitting...
            </span>
          ) : (
            `Run ${toolInfo[selectedTool].name} (${toolInfo[selectedTool].credits} credits)`
          )}
        </button>

        {createJob.isError && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 text-sm">
            Failed to submit job. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
