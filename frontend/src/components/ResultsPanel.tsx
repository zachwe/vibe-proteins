/**
 * Results Panel Component
 *
 * Displays job results including the predicted structure and score breakdown.
 */

import { useEffect, useMemo, useState } from "react";
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
    ip_sae?: number;
    interface_area?: number;
    shape_complementarity?: number;
    contact_count?: number;
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
    target_chains?: string[];
    binder_chains?: string[];
    binder_sequences?: Array<{
      chain_id?: string;
      sequence?: string;
    }>;
    scores?: {
      ip_sae?: number;
      interface_area?: number;
      shape_complementarity?: number;
      contact_count?: number;
      plddt?: number;
      ptm?: number;
      iptm?: number;
      bindingAffinity?: number;
      shapeComplementarity?: number;
      buriedSurfaceArea?: number;
    };
  }>;
}

type StructureOption = {
  id: string;
  label: string;
  url?: string;
  description?: string;
  chainInfo?: {
    target?: string[];
    binder?: string[];
  };
};

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
  note?: string;
  isPrimary?: boolean;
};

type SequenceCandidate = {
  sequence: string;
  score?: number;
  isPrimary?: boolean;
  order: number;
};

function buildSequenceEntries(
  job: Job,
  output: JobOutput | null,
  hasStructure: boolean,
  structureSequence?: string
): SequenceEntry[] {
  const candidates: SequenceCandidate[] = [];
  let order = 0;

  const pushCandidate = (sequence?: string, score?: number, isPrimary?: boolean) => {
    if (!sequence) return;
    candidates.push({
      sequence,
      score,
      isPrimary,
      order: order++,
    });
  };

  if (structureSequence) {
    pushCandidate(structureSequence, undefined, true);
  }

  if (output?.sequence && !structureSequence) {
    pushCandidate(output.sequence, undefined, true);
  }

  if (Array.isArray(output?.sequences)) {
    output.sequences.forEach((seq) => {
      pushCandidate(seq?.sequence, seq?.score);
    });
  }

  const design = output?.designs?.[0];
  if (Array.isArray(design?.mpnn_sequences)) {
    design.mpnn_sequences.forEach((seq) => {
      pushCandidate(seq?.sequence, seq?.score);
    });
  }

  if (candidates.length === 0) {
    const fallback = getInputSequence(job);
    pushCandidate(fallback, undefined, true);
  }

  const unique = new Map<string, SequenceCandidate>();
  for (const candidate of candidates) {
    const existing = unique.get(candidate.sequence);
    if (!existing) {
      unique.set(candidate.sequence, candidate);
      continue;
    }
    if (candidate.isPrimary) {
      existing.isPrimary = true;
    }
    if (typeof candidate.score === "number") {
      if (typeof existing.score !== "number" || candidate.score < existing.score) {
        existing.score = candidate.score;
      }
    }
  }

  const all = Array.from(unique.values());
  const primary = all.find((entry) => entry.isPrimary) || all[0];
  if (primary) {
    primary.isPrimary = true;
  }

  const rest = all.filter((entry) => !entry.isPrimary);
  rest.sort((a, b) => {
    if (typeof a.score === "number" && typeof b.score === "number") {
      return a.score - b.score;
    }
    if (typeof a.score === "number") return -1;
    if (typeof b.score === "number") return 1;
    return a.order - b.order;
  });

  const ordered = primary ? [primary, ...rest] : rest;
  let altIndex = 1;

  return ordered.slice(0, 6).map((entry) => {
    const label = entry.isPrimary
      ? hasStructure
        ? "Top (structure)"
        : "Top"
      : `Alt ${altIndex++}`;
    const note = entry.isPrimary && hasStructure ? "Displayed in structure viewer" : undefined;
    return {
      label,
      sequence: entry.sequence,
      score: entry.score,
      note,
      isPrimary: entry.isPrimary,
    };
  });
}

function buildStructureOptions(output: JobOutput | null): StructureOption[] {
  if (!output) return [];

  const options: StructureOption[] = [];
  const seen = new Set<string>();
  const design = output.designs?.[0];

  const addOption = (option: StructureOption) => {
    if (!option.url || seen.has(option.url)) return;
    seen.add(option.url);
    options.push(option);
  };

  if (design?.complex) {
    addOption({
      id: "rfd3-complex",
      label: "Complex (target + binder)",
      url: design.complex.signedUrl || design.complex.url,
      description: "RFD3 complex backbone for design 1.",
      chainInfo: {
        target: design.target_chains,
        binder: design.binder_chains,
      },
    });
  }

  if (design?.backbone) {
    addOption({
      id: "rfd3-binder",
      label: "Binder backbone",
      url: design.backbone.signedUrl || design.backbone.url,
      description: "Binder backbone only.",
      chainInfo: {
        binder: design.binder_chains,
      },
    });
  }

  if (output.complex) {
    addOption({
      id: "boltz-complex",
      label: "Complex (predicted)",
      url: output.complex.signedUrl || output.complex.url,
      description: "Boltz-2 predicted complex.",
    });
  }

  if (output.structureUrl) {
    addOption({
      id: "structure-url",
      label: "Predicted structure",
      url: output.structureUrl,
    });
  }

  return options;
}

export default function ResultsPanel({ job, onClose, onNewDesign }: ResultsPanelProps) {
  const output = job.output as JobOutput | null;
  const design = output?.designs?.[0];
  const structureOptions = useMemo(() => buildStructureOptions(output), [output]);
  const [activeStructureId, setActiveStructureId] = useState<string | null>(null);

  useEffect(() => {
    if (structureOptions.length === 0) {
      setActiveStructureId(null);
      return;
    }
    if (!activeStructureId || !structureOptions.some((opt) => opt.id === activeStructureId)) {
      setActiveStructureId(structureOptions[0].id);
    }
  }, [structureOptions, activeStructureId]);

  const activeStructure = structureOptions.find((opt) => opt.id === activeStructureId);
  const structureUrl = activeStructure?.url;

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
  const hasStructure = structureUrl || output?.pdbData;
  const designCount = output?.designs?.length ?? 0;
  const sequences = buildSequenceEntries(job, output, Boolean(hasStructure), design?.sequence);
  const chainInfo = activeStructure?.chainInfo ?? {
    target: design?.target_chains,
    binder: design?.binder_chains,
  };

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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            {/* Structure viewer */}
            {hasStructure && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-slate-300">Predicted Fold</h3>
                    {designCount > 0 && (
                      <p className="text-xs text-slate-500">Design 1 of {designCount}</p>
                    )}
                  </div>
                  {structureOptions.length > 1 && (
                    <label className="text-xs text-slate-400 flex items-center gap-2">
                      Structure
                      <select
                        value={activeStructureId || ""}
                        onChange={(event) => setActiveStructureId(event.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-200"
                      >
                        {structureOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {chainInfo?.target || chainInfo?.binder ? (
                  <div className="flex flex-wrap gap-3 text-xs">
                    {chainInfo.target?.length ? (
                      <div className="flex items-center gap-2 bg-slate-700/60 border border-slate-600 rounded-full px-3 py-1">
                        <span className="text-slate-400">Target</span>
                        <span className="text-blue-300 font-semibold">
                          {chainInfo.target.join(", ")}
                        </span>
                      </div>
                    ) : null}
                    {chainInfo.binder?.length ? (
                      <div className="flex items-center gap-2 bg-slate-700/60 border border-slate-600 rounded-full px-3 py-1">
                        <span className="text-slate-400">Binder</span>
                        <span className="text-amber-300 font-semibold">
                          {chainInfo.binder.join(", ")}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {activeStructure?.description && (
                  <p className="text-xs text-slate-500">{activeStructure.description}</p>
                )}
                <div className="h-[320px] md:h-[380px] lg:h-[420px] bg-slate-700 rounded-lg overflow-hidden">
                  <MolstarViewer
                    pdbUrl={structureUrl}
                    className="w-full h-full"
                    minHeight={280}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Designed sequence */}
            {sequences.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  Predicted Binder Sequence{sequences.length > 1 ? "s" : ""}
                </h3>
              <p className="text-xs text-slate-500 mb-3">
                The top sequence is the binder shown in the structure viewer. Other sequences are
                alternative designs ranked by score when available.
              </p>
                <div className="space-y-3">
                  {sequences.map((entry, index) => (
                    <div key={`${entry.label}-${index}`} className="bg-slate-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            {entry.label}
                          </span>
                          {entry.note && (
                            <span className="text-[10px] text-slate-400 bg-slate-600/60 px-2 py-0.5 rounded-full">
                              {entry.note}
                            </span>
                          )}
                        </div>
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
          </div>
        </div>

        {/* No results placeholder */}
        {!hasStructure && sequences.length === 0 && (
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
