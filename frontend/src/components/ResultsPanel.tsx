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
  complex?: {
    url?: string;
    signedUrl?: string;
  };
  sequences?: Array<{
    sequence?: string;
    score?: number;
  }>;
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
  designs?: Array<{
    design_id?: string;
    sequence?: string;
    mpnn_sequences?: Array<{
      sequence?: string;
      score?: number;
    }>;
    complex?: {
      url?: string;
      signedUrl?: string;
    };
    backbone?: {
      url?: string;
      signedUrl?: string;
    };
    scores?: {
      plddt?: number;
      ptm?: number;
      iptm?: number;
      bindingAffinity?: number;
      shapeComplementarity?: number;
      buriedSurfaceArea?: number;
    };
  }>;
}

function resolveStructureUrl(output: JobOutput | null): string | undefined {
  if (!output) return undefined;
  const design = output.designs?.[0];
  if (design?.complex?.signedUrl) return design.complex.signedUrl;
  if (design?.complex?.url) return design.complex.url;
  if (design?.backbone?.signedUrl) return design.backbone.signedUrl;
  if (design?.backbone?.url) return design.backbone.url;
  if (output.complex?.signedUrl) return output.complex.signedUrl;
  if (output.complex?.url) return output.complex.url;
  return output.structureUrl;
}

function getInputSequence(job: Job): string | undefined {
  const input = job.input as Record<string, unknown> | null;
  if (!input) return undefined;
  const binderSequence = input.binderSequence;
  if (typeof binderSequence === "string" && binderSequence.length > 0) {
    return binderSequence;
  }
  const sequence = input.sequence;
  if (typeof sequence === "string" && sequence.length > 0) {
    return sequence;
  }
  return undefined;
}

type SequenceEntry = {
  label: string;
  sequence: string;
  score?: number;
};

function extractSequences(job: Job, output: JobOutput | null): SequenceEntry[] {
  const entries: SequenceEntry[] = [];

  if (output?.sequence) {
    entries.push({ label: "Design sequence", sequence: output.sequence });
  }

  if (Array.isArray(output?.sequences)) {
    output.sequences.forEach((seq, index) => {
      if (seq?.sequence) {
        entries.push({
          label: `ProteinMPNN ${index + 1}`,
          sequence: seq.sequence,
          score: seq.score,
        });
      }
    });
  }

  const design = output?.designs?.[0];
  if (design?.sequence) {
    entries.push({ label: "Backbone sequence", sequence: design.sequence });
  }
  if (Array.isArray(design?.mpnn_sequences)) {
    design.mpnn_sequences.forEach((seq, index) => {
      if (seq?.sequence) {
        entries.push({
          label: `RFD3 MPNN ${index + 1}`,
          sequence: seq.sequence,
          score: seq.score,
        });
      }
    });
  }

  if (entries.length === 0) {
    const fallback = getInputSequence(job);
    if (fallback) {
      entries.push({ label: "Input sequence", sequence: fallback });
    }
  }

  return entries.slice(0, 5);
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

function coerceScore(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
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
  const designScores = output?.designs?.[0]?.scores;
  const scores = output?.scores || designScores;
  const sequences = extractSequences(job, output);

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
  const structureUrl = resolveStructureUrl(output);
  const hasStructure = structureUrl || output?.pdbData;
  const hasScores = scores && Object.keys(scores).length > 0;

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
              Predicted Fold
            </h3>
            <div className="aspect-square bg-slate-700 rounded-lg overflow-hidden">
              <MolstarViewer
                pdbUrl={structureUrl}
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
              {Object.entries(scores!).map(([key, value]) => {
                const numericValue = coerceScore(value);
                if (numericValue === null) return null;
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
                      className={`text-lg font-semibold ${getScoreColor(key, numericValue)}`}
                    >
                      {formatScore(key, numericValue)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Designed sequence */}
        {sequences.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              Predicted Binder Sequence{sequences.length > 1 ? "s" : ""}
            </h3>
            <div className="space-y-3">
              {sequences.map((entry, index) => (
                <div key={`${entry.label}-${index}`} className="bg-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {entry.label}
                    </span>
                    {entry.score !== undefined && (
                      <span className="text-xs text-slate-300">
                        Score: {entry.score.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-slate-300 break-all max-h-24 overflow-y-auto">
                    {entry.sequence}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No results placeholder */}
        {!hasStructure && !hasScores && sequences.length === 0 && (
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
