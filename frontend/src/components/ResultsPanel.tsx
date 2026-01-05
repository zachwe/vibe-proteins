/**
 * Results Panel Component
 *
 * Displays job results including the predicted structure and score breakdown.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Job, Suggestion, SuggestionRequest } from "../lib/api";
import { useCreateSubmission, useSuggestions } from "../lib/hooks";
import MolstarViewer from "./MolstarViewer";

interface ResultsPanelProps {
  job: Job;
  onClose: () => void;
  onNewDesign: () => void;
  challengeName?: string;
  challengeTaskType?: string;
  targetSequence?: string;
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
    // PAE-based ipSAE scores
    ipsae?: number;
    ipsae_iptm?: number;
    pdockq?: number;
    pdockq2?: number;
    lis?: number;
    n_interface_contacts?: number;
  };
  // Separate ipSAE scores object
  ipsae_scores?: {
    ipsae?: number;
    ipsae_d0dom?: number;
    iptm?: number;
    pdockq?: number;
    pdockq2?: number;
    lis?: number;
    n_interface_contacts?: number;
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
      // PAE-based ipSAE scores
      ipsae?: number;
      ipsae_iptm?: number;
      pdockq?: number;
      pdockq2?: number;
      lis?: number;
      n_interface_contacts?: number;
    };
    ipsae_scores?: {
      ipsae?: number;
      ipsae_d0dom?: number;
      iptm?: number;
      pdockq?: number;
      pdockq2?: number;
      lis?: number;
      n_interface_contacts?: number;
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

// Score display configuration
type ScoreConfig = {
  key: string;
  label: string;
  description: string;
  format: (value: number) => string;
  colorScale?: (value: number) => string;
  higherIsBetter?: boolean;
};

const SCORE_CONFIGS: ScoreConfig[] = [
  {
    key: "ipsae",
    label: "ipSAE",
    description: "Interface Predicted SAE (lower = stronger binding)",
    format: (v) => v.toFixed(3),
    colorScale: (v) => v <= -0.7 ? "text-green-400" : v <= -0.4 ? "text-yellow-400" : "text-red-400",
    higherIsBetter: false,
  },
  {
    key: "pdockq",
    label: "pDockQ",
    description: "Predicted dock quality (0-1, higher = better)",
    format: (v) => v.toFixed(3),
    colorScale: (v) => v >= 0.5 ? "text-green-400" : v >= 0.23 ? "text-yellow-400" : "text-red-400",
    higherIsBetter: true,
  },
  {
    key: "iptm",
    label: "ipTM",
    description: "Interface pTM score (0-1, higher = better)",
    format: (v) => v.toFixed(3),
    colorScale: (v) => v >= 0.7 ? "text-green-400" : v >= 0.5 ? "text-yellow-400" : "text-red-400",
    higherIsBetter: true,
  },
  {
    key: "plddt",
    label: "pLDDT",
    description: "Confidence score (0-100, higher = more confident)",
    format: (v) => v.toFixed(1),
    colorScale: (v) => v >= 90 ? "text-green-400" : v >= 70 ? "text-yellow-400" : "text-red-400",
    higherIsBetter: true,
  },
  {
    key: "lis",
    label: "LIS",
    description: "Local Interaction Score (0-1, higher = better)",
    format: (v) => v.toFixed(3),
    colorScale: (v) => v >= 0.7 ? "text-green-400" : v >= 0.4 ? "text-yellow-400" : "text-red-400",
    higherIsBetter: true,
  },
  {
    key: "n_interface_contacts",
    label: "Contacts",
    description: "Number of confident interface contacts",
    format: (v) => v.toFixed(0),
    colorScale: (v) => v >= 100 ? "text-green-400" : v >= 30 ? "text-yellow-400" : "text-red-400",
    higherIsBetter: true,
  },
];

function getScoreValue(output: JobOutput | null, key: string): number | undefined {
  if (!output) return undefined;

  // Check ipsae_scores first
  const ipsaeScores = output.ipsae_scores;
  if (ipsaeScores && key in ipsaeScores) {
    const val = ipsaeScores[key as keyof typeof ipsaeScores];
    if (typeof val === "number") return val;
  }

  // Check scores
  const scores = output.scores;
  if (scores && key in scores) {
    const val = scores[key as keyof typeof scores];
    if (typeof val === "number") return val;
  }

  // Check design scores
  const design = output.designs?.[0];
  if (design?.ipsae_scores && key in design.ipsae_scores) {
    const val = design.ipsae_scores[key as keyof typeof design.ipsae_scores];
    if (typeof val === "number") return val;
  }
  if (design?.scores && key in design.scores) {
    const val = design.scores[key as keyof typeof design.scores];
    if (typeof val === "number") return val;
  }

  return undefined;
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
      description: "Full complex showing your designed binder (gold) docked to the target (blue).",
      chainInfo: {
        target: design.target_chains,
        binder: design.binder_chains,
      },
    });
  }

  if (design?.backbone) {
    addOption({
      id: "rfd3-binder",
      label: "Binder only",
      url: design.backbone.signedUrl || design.backbone.url,
      description: "Just your designed binder protein, without the target.",
      chainInfo: {
        binder: design.binder_chains,
      },
    });
  }

  if (output.complex) {
    addOption({
      id: "boltz-complex",
      label: "Boltz-2 prediction",
      url: output.complex.signedUrl || output.complex.url,
      description: "Boltz-2's prediction of how your binder actually binds to the target.",
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

export default function ResultsPanel({
  job,
  onClose,
  onNewDesign,
  challengeName,
  challengeTaskType,
  targetSequence,
}: ResultsPanelProps) {
  const navigate = useNavigate();
  const createSubmission = useCreateSubmission();
  const output = job.output as JobOutput | null;
  const design = output?.designs?.[0];
  const structureOptions = useMemo(() => buildStructureOptions(output), [output]);
  const [activeStructureId, setActiveStructureId] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Build suggestion request from job data
  const suggestionRequest = useMemo((): SuggestionRequest | null => {
    if (job.status !== "completed" || !output) return null;

    // Collect all scores
    const scores: Record<string, number | undefined> = {};
    const ipsaeScores = output.ipsae_scores || design?.ipsae_scores;
    const jobScores = output.scores || design?.scores;

    if (ipsaeScores) {
      scores.ipsae = ipsaeScores.ipsae;
      scores.pdockq = ipsaeScores.pdockq;
      scores.iptm = ipsaeScores.iptm;
      scores.lis = ipsaeScores.lis;
      scores.n_interface_contacts = ipsaeScores.n_interface_contacts;
    }
    if (jobScores) {
      scores.plddt = jobScores.plddt;
      scores.interface_area = jobScores.interface_area;
      if (!scores.ipsae) scores.ipsae = jobScores.ipsae;
      if (!scores.pdockq) scores.pdockq = jobScores.pdockq;
      if (!scores.iptm) scores.iptm = jobScores.iptm;
    }

    // Check if hotspots were used
    const input = job.input as Record<string, unknown> | null;
    const hasHotspots = !!(input?.hotspotResidues && Array.isArray(input.hotspotResidues) && input.hotspotResidues.length > 0);

    return {
      jobType: job.type,
      scores,
      hasHotspots,
      challengeName,
      challengeTaskType,
    };
  }, [job, output, design, challengeName, challengeTaskType]);

  const { data: suggestionsData, isLoading: suggestionsLoading } = useSuggestions(suggestionRequest);

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
    // job.error contains the error message from the API, output?.message is a fallback
    const errorMessage = job.error || output?.message || "The job failed to complete. Please try again.";
    // Check if the error message contains log output (multi-line or long)
    const hasLogOutput = errorMessage.includes("\n") || errorMessage.length > 200;

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
          {hasLogOutput ? (
            <div className="mt-3">
              <p className="text-slate-400 text-xs mb-2">Error details:</p>
              <pre className="text-slate-300 text-xs font-mono bg-slate-900/50 rounded p-3 max-h-64 overflow-auto whitespace-pre-wrap break-words">
                {errorMessage}
              </pre>
            </div>
          ) : (
            <p className="text-slate-300 text-sm">{errorMessage}</p>
          )}
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
    const progressEvents = job.progress;

    // Stage icons and colors
    const stageStyles: Record<string, { icon: string; color: string }> = {
      init: { icon: "🔧", color: "text-slate-400" },
      rfdiffusion: { icon: "🧬", color: "text-purple-400" },
      proteinmpnn: { icon: "🔤", color: "text-blue-400" },
      boltz: { icon: "⚛️", color: "text-green-400" },
      processing: { icon: "⚙️", color: "text-amber-400" },
      scoring: { icon: "📊", color: "text-cyan-400" },
      upload: { icon: "☁️", color: "text-indigo-400" },
      complete: { icon: "✓", color: "text-green-400" },
    };

    const getStageStyle = (stage: string) => {
      return stageStyles[stage] || { icon: "•", color: "text-slate-400" };
    };

    const formatTimestamp = (timestamp: number) => {
      // Modal sends Unix timestamps in seconds
      const date = new Date(timestamp * 1000);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    return (
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Processing</h2>
            <p className="text-sm text-slate-400">
              {job.type === "rfdiffusion3" ? "Generating protein binder designs" :
               job.type === "boltz2" ? "Predicting protein structure" :
               job.type === "proteinmpnn" ? "Designing protein sequences" :
               job.type === "boltzgen" ? "Generating protein structures" :
               "Running inference job"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            Close
          </button>
        </div>

        {/* Progress timeline */}
        <div className="space-y-4">
          {/* Current status indicator */}
          <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
            <div>
              <p className="text-blue-400 font-medium">
                {progressEvents && progressEvents.length > 0
                  ? progressEvents[progressEvents.length - 1].message
                  : "Starting job..."}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Status: {job.status}
              </p>
            </div>
          </div>

          {/* Progress events timeline */}
          {progressEvents && progressEvents.length > 0 && (
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div className="bg-slate-700/50 px-4 py-2 border-b border-slate-700">
                <h3 className="text-sm font-medium text-slate-300">Progress</h3>
              </div>
              <div className="divide-y divide-slate-700/50 max-h-64 overflow-y-auto">
                {progressEvents.map((event, index) => {
                  const style = getStageStyle(event.stage);
                  const isLatest = index === progressEvents.length - 1;

                  return (
                    <div
                      key={index}
                      className={`px-4 py-3 flex items-start gap-3 ${
                        isLatest ? "bg-slate-700/30" : ""
                      }`}
                    >
                      <span className={`text-lg ${style.color}`}>{style.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${isLatest ? "text-white" : "text-slate-300"}`}>
                          {event.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatTimestamp(event.timestamp)}
                        </p>
                      </div>
                      {isLatest && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No progress yet */}
          {(!progressEvents || progressEvents.length === 0) && (
            <div className="text-center py-6 text-slate-500">
              <p className="text-sm">Waiting for progress updates...</p>
              <p className="text-xs mt-1">This may take a few moments to start.</p>
            </div>
          )}
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
        <div>
          <h2 className="text-lg font-semibold text-white">
            {output?.designName || "Design Results"}
          </h2>
          {challengeName && (
            <p className="text-sm text-slate-400">
              Binder for <span className="text-blue-400">{challengeName}</span>
            </p>
          )}
        </div>
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
                <div className="relative h-[320px] md:h-[380px] lg:h-[420px] bg-slate-700 rounded-lg overflow-hidden">
                  <MolstarViewer
                    pdbUrl={structureUrl}
                    className="w-full h-full"
                    minHeight={280}
                    chainColors={{
                      target: chainInfo?.target,
                      binder: chainInfo?.binder,
                    }}
                  />
                  {(chainInfo?.target?.length || chainInfo?.binder?.length) && (
                    <div className="absolute bottom-3 right-3 bg-slate-900/85 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 shadow-lg">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                        Chain Key
                      </p>
                      {chainInfo.target?.length ? (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="text-slate-200">Target</span>
                          <span className="text-slate-400">
                            {chainInfo.target.join(", ")}
                          </span>
                        </div>
                      ) : null}
                      {chainInfo.binder?.length ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-300" />
                          <span className="text-slate-200">Binder</span>
                          <span className="text-slate-400">
                            {chainInfo.binder.join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Scoring Metrics */}
            {(() => {
              const availableScores = SCORE_CONFIGS.filter(
                (config) => getScoreValue(output, config.key) !== undefined
              );
              if (availableScores.length === 0) return null;

              return (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-2">
                    Binding Metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {availableScores.map((config) => {
                      const value = getScoreValue(output, config.key);
                      if (value === undefined) return null;
                      const colorClass = config.colorScale?.(value) || "text-slate-200";

                      return (
                        <div
                          key={config.key}
                          className="bg-slate-700 rounded-lg p-3"
                          title={config.description}
                        >
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                            <span>{config.label}</span>
                            <Link
                              to={`/help/metrics#${config.key}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-blue-400 transition-colors"
                              title={`Learn about ${config.label}`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </Link>
                          </div>
                          <div className={`text-lg font-semibold ${colorClass}`}>
                            {config.format(value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-slate-500">Green = good, yellow = moderate, red = needs improvement</span>
                    <Link
                      to="/help/metrics"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      What do these mean?
                    </Link>
                  </div>
                </div>
              );
            })()}

            {/* AI Suggestions */}
            {(suggestionsLoading || (suggestionsData?.suggestions && suggestionsData.suggestions.length > 0)) && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <span>Next Steps</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">AI</span>
                </h3>
                {suggestionsLoading ? (
                  <div className="bg-slate-700/50 rounded-lg p-3 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                    <span className="text-sm text-slate-400">Analyzing your results...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {suggestionsData?.suggestions.map((suggestion: Suggestion, index: number) => {
                      const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
                        success: { bg: "bg-green-500/10", border: "border-green-500/30", icon: "✓" },
                        improve: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "→" },
                        verify: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "?" },
                        learn: { bg: "bg-purple-500/10", border: "border-purple-500/30", icon: "📚" },
                      };
                      const style = typeStyles[suggestion.type] || typeStyles.improve;

                      return (
                        <div
                          key={index}
                          className={`${style.bg} border ${style.border} rounded-lg p-3 text-sm text-slate-300`}
                        >
                          <span className="mr-2">{style.icon}</span>
                          {suggestion.text}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
        <div className="flex flex-col gap-3">
          {submissionSuccess && (
            <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
              <p className="text-green-400 font-medium mb-1">Submitted successfully!</p>
              <p className="text-slate-300 text-sm">
                Your design has been submitted for scoring. View your submissions to track progress.
              </p>
              <button
                onClick={() => navigate("/submissions")}
                className="mt-2 text-green-400 hover:text-green-300 text-sm underline"
              >
                View My Submissions
              </button>
            </div>
          )}

          {createSubmission.isError && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-sm text-red-400">
              Failed to submit design. Please try again.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onNewDesign}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              New Design
            </button>
            <button
              onClick={async () => {
                // Get the primary binder sequence from the design
                const binderSequence = design?.sequence
                  || design?.binder_sequences?.[0]?.sequence
                  || design?.mpnn_sequences?.[0]?.sequence
                  || output?.sequence
                  || sequences[0]?.sequence;

                if (!binderSequence) {
                  console.error("No binder sequence found");
                  return;
                }

                // Get the structure URL
                const structureUrl = design?.complex?.signedUrl
                  || design?.complex?.url
                  || output?.complex?.signedUrl
                  || output?.complex?.url
                  || output?.structureUrl;

                try {
                  await createSubmission.mutateAsync({
                    challengeId: job.challengeId,
                    jobId: job.id,
                    designSequence: binderSequence,
                    designStructureUrl: structureUrl,
                  });
                  setSubmissionSuccess(true);
                } catch (error) {
                  console.error("Failed to submit:", error);
                }
              }}
              disabled={createSubmission.isPending || submissionSuccess || sequences.length === 0}
              className={`flex-1 font-semibold py-3 px-6 rounded-lg transition-colors ${
                submissionSuccess
                  ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white disabled:bg-slate-600 disabled:cursor-not-allowed"
              }`}
            >
              {createSubmission.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </span>
              ) : submissionSuccess ? (
                "Submitted ✓"
              ) : (
                "Submit for Scoring"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
