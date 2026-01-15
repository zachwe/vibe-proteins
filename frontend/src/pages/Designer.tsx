/**
 * Unified Designer Page
 *
 * A full-page design experience with:
 * - Large structure viewer on the left
 * - Model selection (RFDiffusion3 / BoltzGen)
 * - Design mode guidance (nanobody, antibody, peptide, protein)
 * - Improved hotspot selection
 * - Inline job progress display
 * - Advanced configuration options
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useChallenge, useCurrentUser, useJob, useCreateJob } from "../lib/hooks";
import { ApiError, type ChainAnnotation, type SuggestedHotspot } from "../lib/api";
import MolstarViewer from "../components/MolstarViewer";
import SequenceSelector from "../components/SequenceSelector";
import HotspotIndicator from "../components/HotspotIndicator";
import Spinner from "../components/Spinner";
import { trackEvent } from "../lib/analytics";

// Design models
type DesignModel = "rfdiffusion3" | "boltzgen";

// Design modes - what type of binder to design
interface DesignMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  recommendedFor: string[];
  binderLength: { min: number; max: number; default: number };
  models: DesignModel[];
  boltzgenProtocol?: string;
  boltzgenScaffoldSet?: "nanobody" | "fab";
}

const DESIGN_MODES: DesignMode[] = [
  {
    id: "protein",
    name: "Protein Binder",
    description: "General-purpose protein binder (80-150 residues). Best for most targets.",
    icon: "🧬",
    recommendedFor: ["general", "enzymes", "receptors"],
    binderLength: { min: 60, max: 200, default: 100 },
    models: ["rfdiffusion3", "boltzgen"],
    boltzgenProtocol: "protein-anything",
  },
  {
    id: "nanobody",
    name: "Nanobody",
    description: "Single-domain antibody. Uses curated nanobody scaffolds with CDR design.",
    icon: "🔬",
    recommendedFor: ["therapeutics", "diagnostics", "research"],
    binderLength: { min: 110, max: 140, default: 125 },
    models: ["boltzgen"],
    boltzgenProtocol: "nanobody-anything",
    boltzgenScaffoldSet: "nanobody",
  },
  {
    id: "antibody",
    name: "Antibody CDR",
    description: "Fab-style antibody scaffolds with CDR design for precise epitope targeting.",
    icon: "🛡️",
    recommendedFor: ["therapeutics", "high-affinity"],
    binderLength: { min: 100, max: 150, default: 125 },
    models: ["boltzgen"],
    boltzgenProtocol: "antibody-anything",
    boltzgenScaffoldSet: "fab",
  },
  {
    id: "peptide",
    name: "Peptide",
    description: "Short cyclic peptide (8-30 residues). Good for cell penetration.",
    icon: "💊",
    recommendedFor: ["cell-penetrating", "oral", "intracellular"],
    binderLength: { min: 8, max: 40, default: 20 },
    models: ["boltzgen"],
    boltzgenProtocol: "peptide-anything",
  },
];

// Model info
const MODEL_INFO: Record<DesignModel, {
  name: string;
  description: string;
  estimatedCost: string;
  estimatedTime: string;
  features: string[];
}> = {
  rfdiffusion3: {
    name: "RFDiffusion3",
    description: "Fast backbone design with ProteinMPNN sequences and Boltz-2 validation",
    estimatedCost: "$0.50-2.00",
    estimatedTime: "2-5 min",
    features: ["Quick results", "Good for exploration", "Lower cost"],
  },
  boltzgen: {
    name: "BoltzGen",
    description: "Full diffusion pipeline with advanced filtering and diverse designs",
    estimatedCost: "$1-5+",
    estimatedTime: "10-60 min",
    features: ["Higher quality", "More diverse designs", "Multiple candidates"],
  },
};

const BOLTZGEN_SCAFFOLD_LIBRARY: Record<"nanobody" | "fab", string[]> = {
  nanobody: [
    "/assets/boltzgen/nanobody_scaffolds/7eow.yaml",
    "/assets/boltzgen/nanobody_scaffolds/7xl0.yaml",
    "/assets/boltzgen/nanobody_scaffolds/8coh.yaml",
    "/assets/boltzgen/nanobody_scaffolds/8z8v.yaml",
  ],
  fab: [
    "/assets/boltzgen/fab_scaffolds/adalimumab.6cr1.yaml",
    "/assets/boltzgen/fab_scaffolds/belimumab.5y9k.yaml",
    "/assets/boltzgen/fab_scaffolds/crenezumab.5vzy.yaml",
    "/assets/boltzgen/fab_scaffolds/dupilumab.6wgb.yaml",
    "/assets/boltzgen/fab_scaffolds/golimumab.5yoy.yaml",
    "/assets/boltzgen/fab_scaffolds/guselkumab.4m6m.yaml",
    "/assets/boltzgen/fab_scaffolds/mab1.3h42.yaml",
    "/assets/boltzgen/fab_scaffolds/necitumumab.6b3s.yaml",
    "/assets/boltzgen/fab_scaffolds/nirsevimab.5udc.yaml",
    "/assets/boltzgen/fab_scaffolds/sarilumab.8iow.yaml",
    "/assets/boltzgen/fab_scaffolds/secukinumab.6wio.yaml",
    "/assets/boltzgen/fab_scaffolds/tezepelumab.5j13.yaml",
    "/assets/boltzgen/fab_scaffolds/tralokinumab.5l6y.yaml",
    "/assets/boltzgen/fab_scaffolds/ustekinumab.3hmw.yaml",
  ],
};

// Hotspot selection mode
type HotspotMode = "manual" | number;

function normalizeBoltzgenBindingResidues(
  residues: string[] | null,
  targetChainId: string
): string[] | null {
  if (!residues || residues.length === 0) return null;
  const normalized: string[] = [];
  for (const residue of residues) {
    if (!residue) continue;
    const match = residue.match(/([A-Za-z])\s*[:\-_/]?\s*(\d+)/);
    if (match) {
      const [, chainId, resId] = match;
      if (chainId.toUpperCase() !== targetChainId.toUpperCase()) continue;
      normalized.push(`${parseInt(resId, 10)}`);
    } else if (/^\d+$/.test(residue)) {
      normalized.push(`${parseInt(residue, 10)}`);
    }
  }
  return normalized.length > 0 ? normalized : null;
}

function buildRfd3HotspotSelection(
  hotspots: string[],
  defaultChainId: string
): Record<string, string> | null {
  const selection: Record<string, string> = {};
  for (const residue of hotspots) {
    if (!residue) continue;
    const match = residue.match(/([A-Za-z])\s*[:\-_/]?\s*(\d+)/);
    let chainId: string | null = null;
    let resId: string | null = null;
    if (match) {
      chainId = match[1];
      resId = match[2];
    } else if (/^\d+$/.test(residue)) {
      chainId = defaultChainId;
      resId = residue;
    }
    if (!chainId || !resId) continue;
    selection[`${chainId.toUpperCase()}${parseInt(resId, 10)}`] = "ALL";
  }
  return Object.keys(selection).length > 0 ? selection : null;
}

function buildBoltzgenYaml(
  targetPath: string,
  targetChainId: string,
  binderLength: string,
  bindingResidues: string[] | null,
  protocol: string,
  numDesigns: number,
  budget: number,
  scaffoldPaths: string[] | null
): string {
  const lines: string[] = [
    `# protocol: ${protocol}`,
    `# num_designs: ${numDesigns}`,
    `# budget: ${budget}`,
    "entities:",
    "  - file:",
    `      path: ${targetPath}`,
    "      include:",
    "        - chain:",
    `            id: ${targetChainId}`,
  ];

  if (bindingResidues && bindingResidues.length > 0) {
    lines.push(
      "      binding_types:",
      "        - chain:",
      `            id: ${targetChainId}`,
      `            binding: "${bindingResidues.join(",")}"`
    );
  }

  if (scaffoldPaths && scaffoldPaths.length > 0) {
    lines.push("  - file:", "      path:");
    for (const scaffoldPath of scaffoldPaths) {
      lines.push(`        - ${scaffoldPath}`);
    }
  } else {
    lines.push(
      "  - protein:",
      "      id: B",
      `      sequence: ${binderLength}`
    );
  }

  return lines.join("\n");
}

// Section component
function Section({
  title,
  expanded,
  onToggle,
  children,
  badge,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {badge}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700">
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

export default function Designer() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: challenge, isLoading: challengeLoading } = useChallenge(challengeId || "");
  const createJob = useCreateJob();

  // Parse initial hotspots from URL
  const initialHotspots = useMemo(() => {
    const hotspots = searchParams.get("hotspots");
    return hotspots ? hotspots.split(",").filter(Boolean) : [];
  }, []);

  // State
  const [selectedModel, setSelectedModel] = useState<DesignModel>("rfdiffusion3");
  const [selectedDesignMode, setSelectedDesignMode] = useState<string>("protein");
  const [selectedHotspots, setSelectedHotspots] = useState<string[]>(initialHotspots);
  const [hotspotMode, setHotspotMode] = useState<HotspotMode>("manual");
  const [savedManualHotspots, setSavedManualHotspots] = useState<string[]>(initialHotspots);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);

  // RFDiffusion3 advanced options
  const [rfdNumDesigns, setRfdNumDesigns] = useState(8);
  const [rfdNumSeqPerDesign, setRfdNumSeqPerDesign] = useState(4);

  // BoltzGen options
  const [bgNumDesigns, setBgNumDesigns] = useState(100);
  const [bgBudget, setBgBudget] = useState(10);
  const [bgBinderLength, setBgBinderLength] = useState("80..120");

  // Section expansion state
  const [expandedSections, setExpandedSections] = useState({
    designMode: true,
    model: true,
    hotspots: true,
    advanced: false,
    rawInput: false,
  });

  // Poll job status
  const { data: job } = useJob(submittedJobId || "");

  // Parse chain annotations and suggested hotspots
  const chainAnnotations = useMemo(() => {
    if (!challenge?.chainAnnotations) return null;
    try {
      return JSON.parse(challenge.chainAnnotations) as Record<string, ChainAnnotation>;
    } catch {
      return null;
    }
  }, [challenge?.chainAnnotations]);

  const suggestedHotspots = useMemo(() => {
    if (!challenge?.suggestedHotspots) return null;
    try {
      return JSON.parse(challenge.suggestedHotspots) as SuggestedHotspot[];
    } catch {
      return null;
    }
  }, [challenge?.suggestedHotspots]);

  // Compute chain colors for viewer
  const chainColors = useMemo(() => {
    if (!chainAnnotations) return undefined;
    const target: string[] = [];
    const binder: string[] = [];
    const context: string[] = [];
    for (const [chainId, annotation] of Object.entries(chainAnnotations)) {
      if (annotation.role === "target") target.push(chainId);
      else if (annotation.role === "binder") binder.push(chainId);
      else if (annotation.role === "context") context.push(chainId);
    }
    if (target.length === 0 && binder.length === 0 && context.length === 0) return undefined;
    return { target, binder, context };
  }, [chainAnnotations]);

  // Get current design mode
  const currentDesignMode = useMemo(() =>
    DESIGN_MODES.find(m => m.id === selectedDesignMode) || DESIGN_MODES[0],
    [selectedDesignMode]
  );

  // Filter design modes based on selected model
  const availableDesignModes = useMemo(() =>
    DESIGN_MODES.filter(mode => mode.models.includes(selectedModel)),
    [selectedModel]
  );

  // Update design mode when model changes
  useEffect(() => {
    if (!availableDesignModes.find(m => m.id === selectedDesignMode)) {
      setSelectedDesignMode(availableDesignModes[0]?.id || "protein");
    }
  }, [availableDesignModes, selectedDesignMode]);

  // Update binder length when design mode changes
  useEffect(() => {
    if (selectedModel === "boltzgen") {
      const mode = DESIGN_MODES.find(m => m.id === selectedDesignMode);
      if (mode) {
        setBgBinderLength(`${mode.binderLength.min}..${mode.binderLength.max}`);
      }
    }
  }, [selectedDesignMode, selectedModel]);

  // Hotspot mode helpers
  const getCurrentMode = useCallback((): HotspotMode => {
    if (selectedHotspots.length === 0) return "manual";
    const matchIndex = suggestedHotspots?.findIndex(
      (hotspot) =>
        hotspot.residues.length === selectedHotspots.length &&
        hotspot.residues.every((r) => selectedHotspots.includes(r))
    ) ?? -1;
    if (matchIndex !== -1) return matchIndex;
    return "manual";
  }, [selectedHotspots, suggestedHotspots]);

  const handleHotspotModeSelect = (mode: HotspotMode) => {
    const currentMode = getCurrentMode();
    if (currentMode === "manual" && mode !== "manual") {
      setSavedManualHotspots(selectedHotspots);
    }
    setHotspotMode(mode);
    if (mode === "manual") {
      setSelectedHotspots(savedManualHotspots);
    } else if (typeof mode === "number" && suggestedHotspots?.[mode]) {
      setSelectedHotspots(suggestedHotspots[mode].residues);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Raw input previews (must be before early returns to satisfy Rules of Hooks)
  const rfd3RawInput = useMemo(() => {
    if (!challenge) return "";
    const targetChainId = challenge.targetChainId || "A";
    const startResidue = challenge.pdbStartResidue || 1;
    const targetLength = challenge.targetSequence?.length ?? null;
    const endResidue = targetLength ? startResidue + targetLength - 1 : null;
    const binderRange = "85-85";
    const targetSegment = endResidue
      ? `${targetChainId}${startResidue}-${endResidue}`
      : `${targetChainId}${startResidue}-END`;
    const contig = `${binderRange},/0,${targetSegment}`;
    const hotspotSelection = buildRfd3HotspotSelection(
      selectedHotspots,
      targetChainId
    );

    const spec: Record<string, unknown> = {
      dialect: 2,
      infer_ori_strategy: hotspotSelection ? "hotspots" : "com",
      input: challenge.targetStructureUrl || "TARGET_STRUCTURE",
      contig,
      is_non_loopy: true,
    };

    if (hotspotSelection) {
      spec.select_hotspots = hotspotSelection;
    }

    return JSON.stringify({ design: spec }, null, 2);
  }, [
    challenge,
    selectedHotspots,
  ]);

  const boltzgenRawInput = useMemo(() => {
    if (!challenge) return "";
    const targetPath = challenge.targetStructureUrl || "TARGET_STRUCTURE.cif";
    const targetChainId = challenge.targetChainId || "A";
    const protocol = currentDesignMode.boltzgenProtocol || "protein-anything";
    const bindingResidues = normalizeBoltzgenBindingResidues(
      selectedHotspots.length > 0 ? selectedHotspots : null,
      targetChainId
    );
    const scaffoldPaths = currentDesignMode.boltzgenScaffoldSet
      ? BOLTZGEN_SCAFFOLD_LIBRARY[currentDesignMode.boltzgenScaffoldSet]
      : null;
    return buildBoltzgenYaml(
      targetPath,
      targetChainId,
      bgBinderLength,
      bindingResidues,
      protocol,
      bgNumDesigns,
      bgBudget,
      scaffoldPaths
    );
  }, [
    bgBinderLength,
    bgBudget,
    bgNumDesigns,
    challenge,
    currentDesignMode.boltzgenProtocol,
    currentDesignMode.boltzgenScaffoldSet,
    selectedHotspots,
  ]);

  // Submit job
  const handleSubmit = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!challenge) return;

    try {
      trackEvent("design_job_submitted", {
        challengeId: challenge.id,
        model: selectedModel,
        designMode: selectedDesignMode,
        hotspotsCount: selectedHotspots.length,
      });

      if (selectedModel === "rfdiffusion3") {
        const result = await createJob.mutateAsync({
          challengeId: challenge.id,
          type: "rfdiffusion3",
          input: {
            targetSequence: challenge.targetSequence,
            targetStructureUrl: challenge.targetStructureUrl,
            targetChainId: challenge.targetChainId,
            hotspotResidues: selectedHotspots.length > 0 ? selectedHotspots : undefined,
            numDesigns: rfdNumDesigns,
            numSeqPerDesign: rfdNumSeqPerDesign,
          },
        });
        setSubmittedJobId(result.job.id);
      } else if (selectedModel === "boltzgen") {
        const scaffoldSet = currentDesignMode.boltzgenScaffoldSet;
        const result = await createJob.mutateAsync({
          challengeId: challenge.id,
          type: "boltzgen",
          input: {
            targetStructureUrl: challenge.targetStructureUrl,
            targetChainIds: challenge.targetChainId ? [challenge.targetChainId] : undefined,
            bindingResidues: selectedHotspots.length > 0 ? selectedHotspots : undefined,
            binderLengthRange: scaffoldSet ? undefined : bgBinderLength,
            boltzgenScaffoldSet: scaffoldSet,
            boltzgenProtocol: currentDesignMode.boltzgenProtocol || "protein-anything",
            numDesigns: bgNumDesigns,
            boltzgenBudget: bgBudget,
          },
        });
        setSubmittedJobId(result.job.id);
      }
    } catch (error) {
      console.error("Failed to submit job:", error);
    }
  };

  // Loading state
  if (challengeLoading || userLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
        <span className="ml-3 text-slate-400">Loading...</span>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Challenge not found</h1>
          <Link to="/challenges" className="text-blue-400 hover:text-blue-300">
            Back to Challenges
          </Link>
        </div>
      </div>
    );
  }

  // Require authentication to use the designer
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-600/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Sign in to Design</h1>
          <p className="text-slate-400 mb-6">
            Create an account or sign in to design binders for {challenge.name}.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={`/login?redirect=${encodeURIComponent(`/design/${challengeId}`)}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              to={`/challenges/${challengeId}`}
              className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Back to Challenge
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentMode = getCurrentMode();
  const modelInfo = MODEL_INFO[selectedModel];
  const rawInputModel = selectedModel;
  const boltzgenScaffoldSet = currentDesignMode.boltzgenScaffoldSet;
  const usesBoltzgenScaffolds = selectedModel === "boltzgen" && Boolean(boltzgenScaffoldSet);
  const boltzgenScaffoldCount = boltzgenScaffoldSet
    ? BOLTZGEN_SCAFFOLD_LIBRARY[boltzgenScaffoldSet].length
    : 0;
  const boltzgenExampleUrl = boltzgenScaffoldSet === "fab"
    ? "https://github.com/HannesStark/boltzgen/blob/main/example/fab_targets/pdl1.yaml"
    : boltzgenScaffoldSet === "nanobody"
      ? "https://github.com/HannesStark/boltzgen/blob/main/example/nanobody/penguinpox.yaml"
      : currentDesignMode.id === "peptide"
        ? "https://github.com/HannesStark/boltzgen/blob/main/example/vanilla_peptide_with_target_binding_site/beetletert.yaml"
        : "https://github.com/HannesStark/boltzgen/blob/main/example/vanilla_protein/1g13prot.yaml";

  // Stage icons for progress display
  const stageIcons: Record<string, string> = {
    init: "🔧",
    rfdiffusion: "🧬",
    proteinmpnn: "🔤",
    boltz: "⚛️",
    design: "🎨",
    inverse_folding: "🔤",
    folding: "⚛️",
    analysis: "📊",
    filtering: "🎯",
    processing: "⚙️",
    scoring: "📊",
    upload: "☁️",
    complete: "✓",
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <Helmet>
        <title>Design | {challenge.name} | ProteinDojo</title>
        <meta name="description" content={`Design a binder for ${challenge.name}`} />
      </Helmet>

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              to={`/challenges/${challengeId}${selectedHotspots.length > 0 ? `#hotspots=${selectedHotspots.join(",")}` : ""}`}
              className="text-blue-400 hover:text-blue-300 text-sm mb-1 inline-block"
            >
              &larr; Back to {challenge.name}
            </Link>
            <h1 className="text-2xl font-bold text-white">Design Binder</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-400">
              Balance: <span className="text-white font-medium">{user?.balanceFormatted ?? "$0.00"}</span>
            </div>
            <Link
              to="/billing"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Add funds
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: Structure viewer (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Structure viewer */}
            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-slate-400">Target Structure</h2>
                {challenge.targetPdbId && (
                  <a
                    href={`https://www.rcsb.org/structure/${challenge.targetPdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    PDB: {challenge.targetPdbId}
                  </a>
                )}
              </div>
              <div className="aspect-[4/3] bg-slate-700 rounded-lg overflow-hidden">
                <MolstarViewer
                  pdbUrl={challenge.targetStructureUrl || undefined}
                  pdbId={challenge.targetPdbId || undefined}
                  highlightResidues={selectedHotspots.length > 0 ? selectedHotspots : undefined}
                  chainColors={chainColors}
                  className="w-full h-full"
                />
              </div>

              {/* Selected hotspots indicator */}
              <HotspotIndicator
                selectedHotspots={selectedHotspots}
                onHotspotsChange={setSelectedHotspots}
                hotspotLabel={
                  suggestedHotspots?.find(
                    (h) =>
                      h.residues.length === selectedHotspots.length &&
                      h.residues.every((r) => selectedHotspots.includes(r))
                  )?.label
                }
              />
            </div>

            {/* Sequence selector */}
            {challenge.targetSequence && challenge.targetChainId && (
              <div className="bg-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-medium text-slate-400 mb-3">
                  Select Hotspot Residues
                </h2>
                <SequenceSelector
                  sequence={challenge.targetSequence}
                  chainId={challenge.targetChainId}
                  startResidueNumber={challenge.pdbStartResidue || 1}
                  selectedResidues={selectedHotspots}
                  onSelectionChange={setSelectedHotspots}
                  suggestedHotspots={suggestedHotspots}
                  uniprotId={challenge.targetUniprotId}
                />
              </div>
            )}
          </div>

          {/* Right: Configuration (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Design Mode Selection */}
            <Section
              title="What do you want to design?"
              expanded={expandedSections.designMode}
              onToggle={() => toggleSection("designMode")}
              badge={
                <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded">
                  {currentDesignMode.name}
                </span>
              }
            >
              <div className="space-y-2">
                {availableDesignModes.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedDesignMode(mode.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedDesignMode === mode.id
                        ? "bg-blue-600/20 border-blue-500"
                        : "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{mode.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">{mode.name}</span>
                          {mode.id === "protein" && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">{mode.description}</p>
                      </div>
                    </div>
                  </button>
                ))}

                {selectedModel === "rfdiffusion3" && (
                  <p className="text-xs text-slate-500 mt-2">
                    Switch to BoltzGen for nanobody, antibody, and peptide design options.
                  </p>
                )}
              </div>
            </Section>

            {/* Model Selection */}
            <Section
              title="Design Model"
              expanded={expandedSections.model}
              onToggle={() => toggleSection("model")}
              badge={
                <span className="text-xs bg-purple-600/30 text-purple-400 px-2 py-0.5 rounded">
                  {modelInfo.name}
                </span>
              }
            >
              <div className="space-y-2">
                {(Object.keys(MODEL_INFO) as DesignModel[]).map(model => {
                  const info = MODEL_INFO[model];
                  const isSelected = selectedModel === model;
                  const supportsCurrentMode = DESIGN_MODES.find(m => m.id === selectedDesignMode)?.models.includes(model);

                  return (
                    <button
                      key={model}
                      onClick={() => setSelectedModel(model)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? "bg-purple-600/20 border-purple-500"
                          : "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-medium text-sm">{info.name}</span>
                        <span className="text-slate-400 text-xs">
                          {info.estimatedCost} / {info.estimatedTime}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mb-2">{info.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {info.features.map((feature, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                      {!supportsCurrentMode && (
                        <p className="text-amber-400 text-xs mt-2">
                          Note: Will switch to Protein Binder mode
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Hotspot Presets */}
            {suggestedHotspots && suggestedHotspots.length > 0 && (
              <Section
                title="Hotspot Presets"
                expanded={expandedSections.hotspots}
                onToggle={() => toggleSection("hotspots")}
                badge={
                  selectedHotspots.length > 0 ? (
                    <span className="text-xs bg-purple-600/30 text-purple-400 px-2 py-0.5 rounded">
                      {selectedHotspots.length} selected
                    </span>
                  ) : undefined
                }
              >
                <div className="space-y-2">
                  {/* Manual selection option */}
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
                        {currentMode === "manual" && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                      </div>
                      <span className="text-white font-medium text-sm">Manual Selection</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1 ml-6">
                      Select residues from the sequence view above
                    </p>
                  </button>

                  {/* Suggested presets */}
                  {suggestedHotspots.map((hotspot, index) => (
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
                          {currentMode === index && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">{hotspot.label}</span>
                          {index === 0 && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-400 text-xs mt-1 ml-6">{hotspot.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2 ml-6">
                        {hotspot.residues.slice(0, 8).map((residue, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded font-mono"
                          >
                            {residue}
                          </span>
                        ))}
                        {hotspot.residues.length > 8 && (
                          <span className="text-[10px] text-slate-500">
                            +{hotspot.residues.length - 8} more
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* Advanced Options */}
            <Section
              title="Advanced Options"
              expanded={expandedSections.advanced}
              onToggle={() => toggleSection("advanced")}
            >
              {selectedModel === "rfdiffusion3" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">
                        Number of Designs
                      </label>
                      <input
                        type="number"
                        value={rfdNumDesigns}
                        onChange={e => setRfdNumDesigns(parseInt(e.target.value) || 8)}
                        min={1}
                        max={32}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">1-32 backbone designs</p>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">
                        Sequences per Design
                      </label>
                      <input
                        type="number"
                        value={rfdNumSeqPerDesign}
                        onChange={e => setRfdNumSeqPerDesign(parseInt(e.target.value) || 4)}
                        min={1}
                        max={16}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">1-16 sequences per backbone</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Total candidates: {rfdNumDesigns * rfdNumSeqPerDesign}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {usesBoltzgenScaffolds ? (
                    <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-3 text-xs text-slate-300">
                      <p className="font-medium text-slate-200 mb-1">Scaffold library enabled</p>
                      <p>
                        Using {boltzgenScaffoldCount} curated {boltzgenScaffoldSet === "nanobody" ? "nanobody" : "Fab"}
                        {" "}scaffolds with CDR design. Binder length is defined by the scaffold templates.
                      </p>
                      <p className="text-[10px] text-slate-400 mt-2">
                        Hotspot residues are mapped to mmCIF label_seq_id before BoltzGen runs.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">
                        Binder Length Range
                      </label>
                      <input
                        type="text"
                        value={bgBinderLength}
                        onChange={e => setBgBinderLength(e.target.value)}
                        placeholder="80..120"
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Format: min..max (e.g., "80..120") or fixed (e.g., "100")
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">
                        Total Designs
                      </label>
                      <input
                        type="number"
                        value={bgNumDesigns}
                        onChange={e => setBgNumDesigns(parseInt(e.target.value) || 100)}
                        min={10}
                        max={60000}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Designs to generate</p>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">
                        Output Budget
                      </label>
                      <input
                        type="number"
                        value={bgBudget}
                        onChange={e => setBgBudget(parseInt(e.target.value) || 10)}
                        min={1}
                        max={1000}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Final filtered designs</p>
                    </div>
                  </div>
                  <Link
                    to={`/design/boltzgen?challengeId=${challengeId}${challenge.targetStructureUrl ? `&targetUrl=${encodeURIComponent(challenge.targetStructureUrl)}` : ""}${challenge.targetChainId ? `&chainId=${challenge.targetChainId}` : ""}${selectedHotspots.length > 0 ? `&hotspots=${selectedHotspots.join(",")}` : ""}`}
                    className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                  >
                    Open full BoltzGen playground
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              )}
            </Section>

            {/* Job Progress / Submit Section */}
            <div className="bg-slate-800 rounded-xl p-4">
              {submittedJobId && job ? (
                // Job in progress
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      job.status === "completed" ? "bg-green-500" :
                      job.status === "failed" ? "bg-red-500" :
                      job.status === "running" ? "bg-yellow-500 animate-pulse" :
                      "bg-blue-500 animate-pulse"
                    }`} />
                    <span className="text-white font-medium capitalize">{job.status}</span>
                  </div>

                  {/* Progress events */}
                  {(job.status === "pending" || job.status === "running") && (
                    <>
                      <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <Spinner size="sm" />
                        <span className="text-blue-400 text-sm">
                          {job.progress && job.progress.length > 0
                            ? job.progress[job.progress.length - 1].message
                            : "Starting job..."}
                        </span>
                      </div>
                      {job.progress && job.progress.length > 0 && (
                        <div className="border border-slate-700 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                          {job.progress.map((event, index) => (
                            <div
                              key={index}
                              className={`px-3 py-1.5 flex items-center gap-2 text-xs ${
                                index === job.progress!.length - 1 ? "bg-slate-700/30" : ""
                              }`}
                            >
                              <span>{stageIcons[event.stage] || "•"}</span>
                              <span className={index === job.progress!.length - 1 ? "text-white" : "text-slate-400"}>
                                {event.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {job.status === "completed" && (
                    <div className="bg-green-500/10 border border-green-500 rounded-lg p-3">
                      <p className="text-green-400 font-medium text-sm mb-2">Design complete!</p>
                      <div className="flex gap-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                          View Results
                        </Link>
                        <button
                          onClick={() => setSubmittedJobId(null)}
                          className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                          New Design
                        </button>
                      </div>
                    </div>
                  )}

                  {job.status === "failed" && (
                    <div className="bg-red-500/10 border border-red-500 rounded-lg p-3">
                      <p className="text-red-400 font-medium text-sm mb-1">Job failed</p>
                      <p className="text-slate-300 text-xs mb-2">
                        {job.error || "Something went wrong."}
                      </p>
                      <button
                        onClick={() => setSubmittedJobId(null)}
                        className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {/* Link to job page */}
                  <Link
                    to={`/jobs/${submittedJobId}`}
                    className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                  >
                    View job details
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              ) : submittedJobId && !job ? (
                // Loading job status
                <div className="flex items-center gap-3">
                  <Spinner size="sm" />
                  <span className="text-slate-300">Submitting job...</span>
                </div>
              ) : (
                // Submit button
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>{modelInfo.name}</span>
                    <span>{modelInfo.estimatedCost} / {modelInfo.estimatedTime}</span>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={createJob.isPending || !user}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    {createJob.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner size="sm" color="white" />
                        Submitting...
                      </span>
                    ) : !user ? (
                      "Sign in to Design"
                    ) : (
                      `Run ${currentDesignMode.name} Design`
                    )}
                  </button>

                  {!user && (
                    <p className="text-xs text-slate-500 text-center">
                      <Link to="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link> to submit design jobs
                    </p>
                  )}

                  {createJob.isError && (
                    <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 text-sm">
                      {createJob.error instanceof ApiError && createJob.error.status === 402 ? (
                        <>
                          Insufficient balance.{" "}
                          <Link to="/billing" className="text-blue-400 hover:text-blue-300 underline">
                            Add funds
                          </Link>
                        </>
                      ) : (
                        "Failed to submit job. Please try again."
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Raw Input Preview */}
            <Section
              title="Raw Input Preview"
              expanded={expandedSections.rawInput}
              onToggle={() => toggleSection("rawInput")}
              badge={
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                  {rawInputModel === "rfdiffusion3" ? "RFDiffusion3" : "BoltzGen"}
                </span>
              }
            >
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  {rawInputModel === "rfdiffusion3"
                    ? "Preview of the RFDiffusion3 inputs.json format (contig derived from target metadata)."
                    : usesBoltzgenScaffolds
                      ? "Preview of the BoltzGen YAML input format with scaffold libraries (matches the GitHub examples)."
                      : "Preview of the BoltzGen YAML input format (matches the GitHub examples)."}
                </p>
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 overflow-auto max-h-80">
                  <pre className="text-xs text-slate-200 whitespace-pre font-mono">
                    {rawInputModel === "rfdiffusion3" ? rfd3RawInput : boltzgenRawInput}
                  </pre>
                </div>
                {rawInputModel === "boltzgen" && (
                  <a
                    href={boltzgenExampleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    View BoltzGen YAML example
                  </a>
                )}
              </div>
            </Section>

            {/* Help link */}
            <div className="text-center">
              <Link
                to="/help/design"
                className="text-sm text-slate-500 hover:text-slate-400"
              >
                Need help? Read the design guide
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
