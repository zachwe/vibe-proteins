/**
 * Results Panel Component
 *
 * Displays job results including the predicted structure and score breakdown.
 */

import type { Job } from "../lib/api";
import MolstarViewer from "./MolstarViewer";

interface ResultsPanelProps {
  job: Job;
  onClose: () => void;
  onNewDesign: () => void;
}

// Expected output structure from inference jobs
interface JobOutput {
  structureUrl?: string;
  pdbData?: string;
  scores?: {
    plddt?: number;
    ptm?: number;
    iptm?: number;
    bindingAffinity?: number;
    shapeComplementarity?: number;
    buriedSurfaceArea?: number;
  };
  sequence?: string;
  designName?: string;
  message?: string;
}

const scoreLabels: Record<string, { name: string; description: string; good: string }> = {
  plddt: {
    name: "pLDDT",
    description: "Per-residue confidence (0-100)",
    good: "> 70",
  },
  ptm: {
    name: "pTM",
    description: "Template modeling score (0-1)",
    good: "> 0.5",
  },
  iptm: {
    name: "ipTM",
    description: "Interface template modeling score (0-1)",
    good: "> 0.6",
  },
  bindingAffinity: {
    name: "Binding Affinity",
    description: "Predicted binding strength (kcal/mol)",
    good: "< -7",
  },
  shapeComplementarity: {
    name: "Shape Complementarity",
    description: "Interface geometric fit (0-1)",
    good: "> 0.65",
  },
  buriedSurfaceArea: {
    name: "Buried Surface Area",
    description: "Interface contact area (Å²)",
    good: "> 800",
  },
};

function getScoreColor(key: string, value: number): string {
  switch (key) {
    case "plddt":
      return value > 70 ? "text-green-400" : value > 50 ? "text-yellow-400" : "text-red-400";
    case "ptm":
      return value > 0.5 ? "text-green-400" : value > 0.3 ? "text-yellow-400" : "text-red-400";
    case "iptm":
      return value > 0.6 ? "text-green-400" : value > 0.4 ? "text-yellow-400" : "text-red-400";
    case "bindingAffinity":
      return value < -7 ? "text-green-400" : value < -5 ? "text-yellow-400" : "text-red-400";
    case "shapeComplementarity":
      return value > 0.65 ? "text-green-400" : value > 0.5 ? "text-yellow-400" : "text-red-400";
    case "buriedSurfaceArea":
      return value > 800 ? "text-green-400" : value > 500 ? "text-yellow-400" : "text-red-400";
    default:
      return "text-slate-300";
  }
}

function formatScore(key: string, value: number): string {
  if (key === "buriedSurfaceArea") {
    return `${Math.round(value)} Å²`;
  }
  if (key === "bindingAffinity") {
    return `${value.toFixed(1)} kcal/mol`;
  }
  if (key === "plddt") {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}

export default function ResultsPanel({ job, onClose, onNewDesign }: ResultsPanelProps) {
  const output = job.output as JobOutput | null;

  // If job failed, show error state
  if (job.status === "failed") {
    return (
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Job Failed</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            Close
          </button>
        </div>

        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-4">
          <p className="text-red-400 font-medium mb-2">Something went wrong</p>
          <p className="text-slate-300 text-sm">
            {output?.message || "The job failed to complete. Please try again."}
          </p>
        </div>

        <button
          onClick={onNewDesign}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // If job is still running or pending
  if (job.status !== "completed") {
    return (
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Processing</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            Close
          </button>
        </div>

        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
          <span className="text-slate-300">Your design is being processed...</span>
        </div>
      </div>
    );
  }

  // Completed job - show results
  const hasStructure = output?.structureUrl || output?.pdbData;
  const hasScores = output?.scores && Object.keys(output.scores).length > 0;

  return (
    <div className="bg-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          {output?.designName || "Design Results"}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          Close
        </button>
      </div>

      <div className="space-y-6">
        {/* Structure viewer */}
        {hasStructure && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              Predicted Structure
            </h3>
            <div className="aspect-square bg-slate-700 rounded-lg overflow-hidden">
              <MolstarViewer
                pdbUrl={output.structureUrl}
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* Score breakdown */}
        {hasScores && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Score Breakdown
            </h3>
            <div className="grid gap-3">
              {Object.entries(output.scores!).map(([key, value]) => {
                if (value === undefined || value === null) return null;
                const info = scoreLabels[key];
                return (
                  <div
                    key={key}
                    className="bg-slate-700 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white font-medium">
                        {info?.name || key}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {info?.description || ""}
                        {info?.good && (
                          <span className="ml-2 text-green-400">
                            (Good: {info.good})
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-lg font-semibold ${getScoreColor(key, value)}`}
                    >
                      {formatScore(key, value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Designed sequence */}
        {output?.sequence && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              Designed Sequence
            </h3>
            <div className="bg-slate-700 rounded-lg p-3 font-mono text-xs text-slate-300 break-all max-h-24 overflow-y-auto">
              {output.sequence}
            </div>
          </div>
        )}

        {/* No results placeholder */}
        {!hasStructure && !hasScores && !output?.sequence && (
          <div className="text-center py-8 text-slate-400">
            <p>No detailed results available yet.</p>
            <p className="text-sm mt-2">
              The inference functions are still being implemented.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onNewDesign}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            New Design
          </button>
          <button
            onClick={() => {
              // TODO: Implement submission flow
              console.log("Submit design", job.id);
            }}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Submit for Scoring
          </button>
        </div>
      </div>
    </div>
  );
}
