/**
 * Design Panel Component
 *
 * Handles the design workflow: tool selection, job submission, and status tracking.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateJob, useJob } from "../lib/hooks";
import { useSession } from "../lib/auth";
import { ApiError, type SuggestedHotspot } from "../lib/api";
import ResultsPanel from "./ResultsPanel";

interface DesignPanelProps {
  challengeId: string;
  challengeName?: string;
  challengeTaskType?: string;
  targetSequence: string | null;
  targetStructureUrl: string | null;
  targetChainId?: string | null;
  suggestedHotspots?: SuggestedHotspot[] | null;
  onClose: () => void;
  selectedHotspots: string[];
  onHotspotsChange: (residues: string[]) => void;
}

type DesignTool = "rfdiffusion3" | "boltz2" | "proteinmpnn";

// Estimated costs based on typical run times (A10G at ~$0.024/min)
const toolInfo: Record<DesignTool, { name: string; description: string; estimatedCost: string; estimatedTime: string }> = {
  rfdiffusion3: {
    name: "RFDiffusion3",
    description: "RFDiffusion3 backbone design + ProteinMPNN sequences + Boltz-2 sanity check",
    estimatedCost: "$0.50-2.00",
    estimatedTime: "2-5 min",
  },
  boltz2: {
    name: "Boltz-2",
    description: "Fast co-fold sanity check for binder + target complexes",
    estimatedCost: "$0.10-0.50",
    estimatedTime: "30s-2 min",
  },
  proteinmpnn: {
    name: "ProteinMPNN",
    description: "Sequence design for a given backbone structure",
    estimatedCost: "$0.05-0.20",
    estimatedTime: "15s-1 min",
  },
};

// Hotspot selection mode: "manual" for user-selected, or index into suggestedHotspots
type HotspotMode = "manual" | number;

export default function DesignPanel({
  challengeId,
  challengeName,
  challengeTaskType,
  targetSequence,
  targetStructureUrl,
  targetChainId,
  suggestedHotspots,
  onClose,
  selectedHotspots,
  onHotspotsChange,
}: DesignPanelProps) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const createJob = useCreateJob();

  const [selectedTool, setSelectedTool] = useState<DesignTool>("rfdiffusion3");
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Track the hotspot selection mode separately from the actual selection
  // This allows us to remember manual selections when switching modes
  const [hotspotMode, setHotspotMode] = useState<HotspotMode>("manual");
  const [savedManualHotspots, setSavedManualHotspots] = useState<string[]>([]);

  // Determine the current mode based on what's selected
  const getCurrentMode = (): HotspotMode => {
    if (selectedHotspots.length === 0) {
      return "manual";
    }
    // Check if selection matches any suggested hotspot
    const matchIndex = suggestedHotspots?.findIndex(
      (hotspot) =>
        hotspot.residues.length === selectedHotspots.length &&
        hotspot.residues.every((r) => selectedHotspots.includes(r))
    ) ?? -1;
    if (matchIndex !== -1) {
      return matchIndex;
    }
    return "manual";
  };

  const currentMode = getCurrentMode();

  // Handle hotspot mode selection
  const handleHotspotModeSelect = (mode: HotspotMode) => {
    // If leaving manual mode, save current selection
    if (currentMode === "manual" && mode !== "manual") {
      setSavedManualHotspots(selectedHotspots);
    }

    setHotspotMode(mode);

    if (mode === "manual") {
      // Restore saved manual selection
      onHotspotsChange(savedManualHotspots);
    } else if (typeof mode === "number" && suggestedHotspots?.[mode]) {
      onHotspotsChange(suggestedHotspots[mode].residues);
    }
  };

  // Poll job status if we've submitted a job
  const { data: job } = useJob(submittedJobId || "");

  const handleSubmit = async () => {
    if (!session?.user) {
      navigate("/login");
      return;
    }

    // Use selected hotspot residues if any are selected
    const hotspotResidues = selectedTool === "rfdiffusion3" && selectedHotspots.length > 0
      ? selectedHotspots
      : undefined;

    try {
      const result = await createJob.mutateAsync({
        challengeId,
        type: selectedTool,
        input: {
          targetSequence,
          targetStructureUrl,
          targetChainId,
          hotspotResidues,
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
        challengeName={challengeName}
        challengeTaskType={challengeTaskType}
        targetSequence={targetSequence || undefined}
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
            {job.costUsdCents !== null && (
              <p>Cost: ${(job.costUsdCents / 100).toFixed(2)}</p>
            )}
            {job.executionSeconds !== null && job.gpuType && (
              <p>GPU time: {job.executionSeconds.toFixed(1)}s on {job.gpuType}</p>
            )}
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
              <div className="flex flex-wrap gap-3 mt-3">
                <button
                  onClick={() => setShowResults(true)}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  View Results
                </button>
                <button
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Open Job Page
                </button>
              </div>
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
                    <span className="text-slate-400 text-sm">{info.estimatedCost} ({info.estimatedTime})</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">{info.description}</p>
                </button>
              )
            )}
          </div>
        </div>

        {/* Hotspot Selection - only for RFDiffusion3 */}
        {selectedTool === "rfdiffusion3" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-300">
                Target Hotspots
              </label>
              <Link
                to="/help/design#hotspots"
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                What are hotspots?
              </Link>
            </div>

            <div className="space-y-2">
              {/* Manual selection option - default */}
              <button
                onClick={() => handleHotspotModeSelect("manual")}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  currentMode === "manual"
                    ? "bg-purple-600/20 border-purple-500"
                    : "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    currentMode === "manual" ? "border-purple-500" : "border-slate-500"
                  }`}>
                    {currentMode === "manual" && (
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-white font-medium text-sm">Manually selected</span>
                    {selectedHotspots.length > 0 && currentMode === "manual" && (
                      <span className="ml-2 text-xs text-purple-400">
                        ({selectedHotspots.length} residue{selectedHotspots.length !== 1 ? "s" : ""})
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-slate-400 text-xs mt-1 ml-6">
                  {currentMode === "manual" && selectedHotspots.length > 0
                    ? "Using your selection from the Sequence tab"
                    : "Select residues in the Sequence tab to use as hotspots"
                  }
                </p>
                {currentMode === "manual" && selectedHotspots.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 ml-6">
                    {selectedHotspots.slice(0, 10).map((residue, i) => (
                      <span
                        key={i}
                        className="text-xs bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded font-mono"
                      >
                        {residue}
                      </span>
                    ))}
                    {selectedHotspots.length > 10 && (
                      <span className="text-xs text-slate-400">
                        +{selectedHotspots.length - 10} more
                      </span>
                    )}
                  </div>
                )}
              </button>

              {/* Suggested hotspots */}
              {suggestedHotspots?.map((hotspot, index) => (
                <button
                  key={index}
                  onClick={() => handleHotspotModeSelect(index)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    currentMode === index
                      ? "bg-blue-600/20 border-blue-500"
                      : "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      currentMode === index ? "border-blue-500" : "border-slate-500"
                    }`}>
                      {currentMode === index && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-white font-medium text-sm">{hotspot.label}</span>
                      {index === 0 && (
                        <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs mt-1 ml-6">{hotspot.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2 ml-6">
                    {hotspot.residues.map((residue, i) => (
                      <span
                        key={i}
                        className="text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded font-mono"
                      >
                        {residue}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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
            `Run ${toolInfo[selectedTool].name} (${toolInfo[selectedTool].estimatedCost})`
          )}
        </button>

        {createJob.isError && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 text-sm">
            {createJob.error instanceof ApiError && createJob.error.status === 402 ? (
              <>
                Insufficient balance.{" "}
                <Link to="/billing" className="text-blue-400 hover:text-blue-300 underline">
                  Add funds
                </Link>{" "}
                to run design jobs.
              </>
            ) : (
              "Failed to submit job. Please try again."
            )}
          </div>
        )}
      </div>
    </div>
  );
}
