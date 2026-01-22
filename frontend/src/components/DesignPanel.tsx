/**
 * Design Panel Component
 *
 * Handles the design workflow: tool selection, job submission, and status tracking.
 */

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCreateJob, useJob } from "../lib/hooks";
import { useSession } from "../lib/auth";
import { ApiError, type SuggestedHotspot } from "../lib/api";
import ResultsPanel from "./ResultsPanel";
import Spinner from "./Spinner";

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

type DesignTool = "rfdiffusion3";

// Tool info for display
const toolInfo: Record<DesignTool, { name: string; description: string; estimatedCost: string; estimatedTime: string }> = {
  rfdiffusion3: {
    name: "RFDiffusion3",
    description: "Backbone design + ProteinMPNN sequences + Boltz-2 validation",
    estimatedCost: "$0.50-2.00",
    estimatedTime: "2-5 min",
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
  const location = useLocation();
  const { data: session } = useSession();
  const createJob = useCreateJob();

  const selectedTool: DesignTool = "rfdiffusion3";
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Track the hotspot selection mode separately from the actual selection
  // This allows us to remember manual selections when switching modes
  const [_hotspotMode, setHotspotMode] = useState<HotspotMode>("manual");
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
  if (submittedJobId) {
    // Show immediate feedback even before job data is loaded
    const isLoading = !job;
    const progressEvents = job?.progress;
    const latestProgress = progressEvents && progressEvents.length > 0
      ? progressEvents[progressEvents.length - 1]
      : null;

    // Stage icons for progress display
    const stageIcons: Record<string, string> = {
      init: "🔧",
      rfdiffusion: "🧬",
      proteinmpnn: "🔤",
      boltz: "⚛️",
      processing: "⚙️",
      scoring: "📊",
      upload: "☁️",
      complete: "✓",
      // BoltzGen stages
      design: "🎨",
      inverse_folding: "🔤",
      folding: "⚛️",
      analysis: "📊",
      filtering: "🎯",
    };

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
              isLoading ? "bg-blue-500 animate-pulse" :
              job.status === "completed" ? "bg-green-500" :
              job.status === "failed" ? "bg-red-500" :
              job.status === "running" ? "bg-yellow-500 animate-pulse" :
              "bg-slate-500 animate-pulse"
            }`} />
            <span className="text-white font-medium capitalize">
              {isLoading ? "Submitting..." : job.status}
            </span>
          </div>

          <div className="text-sm text-slate-400">
            <p>Tool: {job ? (toolInfo[job.type as DesignTool]?.name || job.type) : toolInfo[selectedTool].name}</p>
            {job?.costUsdCents !== null && job?.costUsdCents !== undefined && (
              <p>Cost: ${(job.costUsdCents / 100).toFixed(2)}</p>
            )}
            {job?.executionSeconds !== null && job?.executionSeconds !== undefined && job?.gpuType && (
              <p>GPU time: {job.executionSeconds.toFixed(1)}s on {job.gpuType}</p>
            )}
            {job && <p>Started: {new Date(job.createdAt).toLocaleString()}</p>}
          </div>

          {/* Progress section for running/pending jobs */}
          {(isLoading || job?.status === "pending" || job?.status === "running") && (
            <div className="space-y-3">
              {/* Current status banner */}
              <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <Spinner size="sm" />
                <span className="text-blue-400 text-sm">
                  {isLoading ? "Submitting job..." :
                   latestProgress ? latestProgress.message : "Starting job..."}
                </span>
              </div>

              {/* Progress events timeline */}
              {progressEvents && progressEvents.length > 0 && (
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="divide-y divide-slate-700/50 max-h-48 overflow-y-auto">
                    {progressEvents.map((event, index) => {
                      const isLatest = index === progressEvents.length - 1;
                      return (
                        <div
                          key={index}
                          className={`px-3 py-2 flex items-center gap-2 text-sm ${
                            isLatest ? "bg-slate-700/30" : ""
                          }`}
                        >
                          <span>{stageIcons[event.stage] || "•"}</span>
                          <span className={isLatest ? "text-white" : "text-slate-400"}>
                            {event.message}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Link to full job page */}
              <Link
                to={`/jobs/${submittedJobId}`}
                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
              >
                View full job details
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          )}

          {job?.status === "completed" && (
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

          {job?.status === "failed" && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
              <p className="text-red-400 font-medium mb-2">Job failed</p>
              <p className="text-slate-300 text-sm">
                {job.error || "Something went wrong. Please try again or contact support."}
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <button
                  onClick={() => setSubmittedJobId(null)}
                  className="bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Try Again
                </button>
                <Link
                  to={`/jobs/${job.id}`}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  View Details
                </Link>
              </div>
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
        {/* Quick Design Tool */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Quick Design
          </label>
          <div className="bg-blue-600/20 border border-blue-500 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">{toolInfo.rfdiffusion3.name}</span>
              <span className="text-slate-400 text-sm">
                {toolInfo.rfdiffusion3.estimatedCost} ({toolInfo.rfdiffusion3.estimatedTime})
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">{toolInfo.rfdiffusion3.description}</p>
          </div>
        </div>

        {/* BoltzGen Link */}
        <div className="border-t border-slate-700 pt-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Advanced Design
          </label>
          <Link
            to={`/design/boltzgen?challengeId=${challengeId}${targetStructureUrl ? `&targetUrl=${encodeURIComponent(targetStructureUrl)}` : ""}${targetChainId ? `&chainId=${targetChainId}` : ""}${selectedHotspots.length > 0 ? `&hotspots=${selectedHotspots.join(",")}` : ""}${location.hash ? `&returnHash=${encodeURIComponent(location.hash)}` : ""}`}
            className="block w-full text-left p-3 rounded-lg border border-slate-600 hover:border-purple-500 hover:bg-purple-600/10 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">BoltzGen</span>
              <span className="text-slate-400 text-sm">$0.50-3.00 (5-20 min)</span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Full diffusion pipeline with advanced filtering and ranking options
            </p>
            <p className="text-purple-400 text-xs mt-2 flex items-center gap-1">
              Open BoltzGen Designer
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </p>
          </Link>
        </div>

        {/* Hotspot Selection */}
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
              <Spinner size="sm" color="white" />
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
