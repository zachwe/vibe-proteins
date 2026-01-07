import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import { useChallenge } from "../lib/hooks";
import MolstarViewer from "../components/MolstarViewer";
import DesignPanel from "../components/DesignPanel";
import Leaderboard from "../components/Leaderboard";
import HotspotIndicator from "../components/HotspotIndicator";
import SequenceSelector from "../components/SequenceSelector";
import type { ChainAnnotation, SuggestedHotspot } from "../lib/api";

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

// URL transform to allow gpt: scheme (react-markdown sanitizes by default)
function urlTransform(url: string): string {
  // Allow gpt: URLs to pass through unchanged
  if (url.startsWith("gpt:")) {
    return url;
  }
  // For other URLs, use default behavior (allows http, https, mailto, tel)
  const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];
  try {
    const parsed = new URL(url);
    if (allowedProtocols.includes(parsed.protocol)) {
      return url;
    }
  } catch {
    // Relative URLs are fine
    return url;
  }
  return url;
}

// Custom markdown link renderer that handles gpt: links
// Format: [display text](gpt:topic) or [display text](gpt:topic||custom question)
function createMarkdownComponents(): Components {
  return {
    a: ({ href, children }) => {
      // Check if this is a gpt: link for terminology explanation
      if (href?.startsWith("gpt:")) {
        const content = href.slice(4); // Remove "gpt:" prefix
        const decoded = decodeURIComponent(content);

        // Check for custom question format: topic||question
        let topic: string;
        let question: string;
        if (decoded.includes("||")) {
          const [topicPart, questionPart] = decoded.split("||");
          topic = topicPart;
          question = questionPart;
        } else {
          topic = decoded;
          question = `Explain what "${topic}" means in the context of protein biology and drug design. Keep it simple and accessible.`;
        }

        const chatGptUrl = `https://chatgpt.com/?q=${encodeURIComponent(question)}`;
        return (
          <a
            href={chatGptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline decoration-dotted underline-offset-2 cursor-help"
            title={`Learn about: ${topic}`}
          >
            {children}
          </a>
        );
      }
      // Regular link
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {children}
        </a>
      );
    },
  };
}

// Sequence display component with copy functionality
function SequenceDisplay({ sequence }: { sequence: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(sequence);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">Target Sequence</span>
          <span className="text-xs text-slate-500">({sequence.length} residues)</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-300 px-2 py-1 rounded transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-300 px-2 py-1 rounded transition-colors"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      <div
        className={`font-mono text-xs text-slate-400 break-all ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        {sequence}
      </div>
    </div>
  );
}

// Chain legend component
function ChainLegend({
  chainAnnotations,
  pdbDescription,
}: {
  chainAnnotations: Record<string, ChainAnnotation>;
  pdbDescription: string | null;
}) {
  const chains = Object.entries(chainAnnotations);
  const targetChains = chains.filter(([, ann]) => ann.role === "target");
  const contextChains = chains.filter(([, ann]) => ann.role === "context");

  return (
    <div className="bg-slate-700/50 rounded-lg p-3 mb-2">
      {pdbDescription && (
        <p className="text-xs text-slate-400 mb-2 italic">{pdbDescription}</p>
      )}

      {/* Target chains */}
      {targetChains.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wide text-blue-400 mb-1.5 font-medium">
            Target {targetChains.length > 1 ? `(${targetChains.length} chains)` : ""}
          </p>
          <div className="space-y-1.5">
            {targetChains.map(([chainId, annotation]) => (
              <div key={chainId} className="flex items-start gap-2 text-xs">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex-shrink-0">
                  {chainId}
                </span>
                <div className="flex-1">
                  <span className="font-medium text-slate-200">{annotation.name}</span>
                  <p className="text-slate-400 mt-0.5 leading-tight">{annotation.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context chains (e.g., binding partners, receptors) */}
      {contextChains.length > 0 && (
        <div className="pt-2 border-t border-slate-600/50">
          <p className="text-[10px] uppercase tracking-wide text-emerald-400 mb-1.5 font-medium">
            Also in structure
          </p>
          <div className="space-y-1.5">
            {contextChains.map(([chainId, annotation]) => (
              <div key={chainId} className="flex items-start gap-2 text-xs">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-400 text-slate-900 font-bold text-xs flex-shrink-0">
                  {chainId}
                </span>
                <div className="flex-1">
                  <span className="font-medium text-slate-200">{annotation.name}</span>
                  <p className="text-slate-400 mt-0.5 leading-tight">{annotation.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note about crystallographic artifacts */}
      <p className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-600/30">
        Small dots are water molecules from the crystal structure - you can ignore them.
      </p>
    </div>
  );
}

type InfoTab = "overview" | "learn" | "sequence" | "leaderboard";

// Parse hash params from URL
function parseHashParams(hash: string): Record<string, string> {
  if (!hash || hash === "#") return {};
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(hash.slice(1));
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

// Build hash string from params
function buildHashString(params: Record<string, string | undefined>): string {
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  if (filtered.length === 0) return "";
  return "#" + new URLSearchParams(filtered).toString();
}

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: challenge, isLoading, error } = useChallenge(id || "");

  // Parse initial state from URL hash
  const initialHashParams = useMemo(() => parseHashParams(location.hash), []);

  const [showDesignPanel, setShowDesignPanel] = useState(() => initialHashParams.design === "1");
  const [currentStep, setCurrentStep] = useState(() => {
    const step = parseInt(initialHashParams.step || "1", 10);
    return isNaN(step) || step < 1 || step > 4 ? 1 : step;
  });
  const [activeTab, setActiveTab] = useState<InfoTab>(() => {
    const tab = initialHashParams.tab as InfoTab;
    return ["overview", "learn", "sequence", "leaderboard"].includes(tab) ? tab : "overview";
  });
  // Selected hotspot residues - lifted up for shared state between viewer and design panel
  const [selectedHotspots, setSelectedHotspots] = useState<string[]>(() => {
    const hotspots = initialHashParams.hotspots;
    return hotspots ? hotspots.split(",").filter(Boolean) : [];
  });

  // Update URL hash when state changes
  const updateHash = useCallback((updates: Partial<{
    tab: InfoTab;
    design: boolean;
    step: number;
    hotspots: string[];
  }>) => {
    const currentParams = parseHashParams(location.hash);

    const newParams: Record<string, string | undefined> = {
      ...currentParams,
    };

    if (updates.tab !== undefined) {
      newParams.tab = updates.tab === "overview" ? undefined : updates.tab;
    }
    if (updates.design !== undefined) {
      newParams.design = updates.design ? "1" : undefined;
    }
    if (updates.step !== undefined) {
      newParams.step = updates.step === 1 ? undefined : String(updates.step);
    }
    if (updates.hotspots !== undefined) {
      newParams.hotspots = updates.hotspots.length > 0 ? updates.hotspots.join(",") : undefined;
    }

    const newHash = buildHashString(newParams);
    navigate({ hash: newHash }, { replace: true });
  }, [location.hash, navigate]);

  // Sync state changes to URL
  useEffect(() => {
    updateHash({ tab: activeTab, design: showDesignPanel, step: currentStep, hotspots: selectedHotspots });
  }, [activeTab, showDesignPanel, currentStep, selectedHotspots, updateHash]);

  // Parse chain annotations from JSON string
  const chainAnnotations = useMemo(() => {
    if (!challenge?.chainAnnotations) return null;
    try {
      return JSON.parse(challenge.chainAnnotations) as Record<string, ChainAnnotation>;
    } catch {
      return null;
    }
  }, [challenge?.chainAnnotations]);

  // Parse suggested hotspots from JSON string
  const suggestedHotspots = useMemo(() => {
    if (!challenge?.suggestedHotspots) return null;
    try {
      return JSON.parse(challenge.suggestedHotspots) as SuggestedHotspot[];
    } catch {
      return null;
    }
  }, [challenge?.suggestedHotspots]);

  // Find the label for the current hotspot selection if it matches a suggested preset
  const selectedHotspotLabel = useMemo(() => {
    if (!suggestedHotspots || selectedHotspots.length === 0) return undefined;
    const matchingHotspot = suggestedHotspots.find(
      (hotspot) =>
        hotspot.residues.length === selectedHotspots.length &&
        hotspot.residues.every((r) => selectedHotspots.includes(r))
    );
    return matchingHotspot?.label;
  }, [suggestedHotspots, selectedHotspots]);

  // Compute chain colors from chain annotations for Mol* viewer
  const chainColors = useMemo(() => {
    if (!chainAnnotations) return undefined;
    const target: string[] = [];
    const binder: string[] = [];
    const context: string[] = [];
    for (const [chainId, annotation] of Object.entries(chainAnnotations)) {
      if (annotation.role === "target") {
        target.push(chainId);
      } else if (annotation.role === "binder") {
        binder.push(chainId);
      } else if (annotation.role === "context") {
        context.push(chainId);
      }
    }
    if (target.length === 0 && binder.length === 0 && context.length === 0) return undefined;
    return { target, binder, context };
  }, [chainAnnotations]);

  // Memoize markdown components
  const markdownComponents = useMemo(() => createMarkdownComponents(), []);

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

  const pageTitle = `${challenge.name} | ProteinDojo`;
  const pageDescription = challenge.mission || challenge.description || `Design a protein binder for ${challenge.name}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="article" />
        <link rel="canonical" href={`https://proteindojo.com/challenges/${challenge.id}`} />
        {challenge.targetPdbId && (
          <meta name="keywords" content={`${challenge.name}, ${challenge.targetPdbId}, protein design, drug discovery, ${challenge.taskType}`} />
        )}
      </Helmet>
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left side - Target viewer (2/3 width) */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-4">
          {/* Chain legend above viewer */}
          {chainAnnotations && (
            <ChainLegend
              chainAnnotations={chainAnnotations}
              pdbDescription={challenge.pdbDescription}
            />
          )}
          <div className="aspect-square bg-slate-700 rounded-lg overflow-hidden">
            <MolstarViewer
              pdbUrl={challenge.targetStructureUrl || undefined}
              pdbId={challenge.targetPdbId || undefined}
              highlightResidues={selectedHotspots.length > 0 ? selectedHotspots : undefined}
              chainColors={chainColors}
              className="w-full h-full"
            />
          </div>

          {/* Hotspot indicator below viewer */}
          <HotspotIndicator
            selectedHotspots={selectedHotspots}
            onHotspotsChange={setSelectedHotspots}
            hotspotLabel={selectedHotspotLabel}
          />
        </div>

        {/* Right side - Challenge info with tabs */}
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            {/* Tab headers */}
            <div className="flex border-b border-slate-700">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "overview"
                    ? "text-blue-400 border-b-2 border-blue-400 bg-slate-700/50"
                    : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/30"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("learn")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "learn"
                    ? "text-blue-400 border-b-2 border-blue-400 bg-slate-700/50"
                    : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/30"
                }`}
              >
                Learn More
              </button>
              <button
                onClick={() => setActiveTab("sequence")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "sequence"
                    ? "text-blue-400 border-b-2 border-blue-400 bg-slate-700/50"
                    : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/30"
                }`}
              >
                Sequence
              </button>
              <button
                onClick={() => setActiveTab("leaderboard")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "leaderboard"
                    ? "text-blue-400 border-b-2 border-blue-400 bg-slate-700/50"
                    : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/30"
                }`}
              >
                🏆
              </button>
            </div>

            {/* Tab content */}
            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span
                      className={`${levelColors[challenge.level] || "bg-slate-600"} text-white text-xs font-semibold px-2 py-1 rounded`}
                    >
                      Level {challenge.level}
                    </span>
                    <span className="bg-slate-600 text-white text-xs font-semibold px-2 py-1 rounded">
                      {challenge.taskType}
                    </span>
                    <span className="text-yellow-400 text-sm">
                      {"★".repeat(challenge.difficulty)}
                      {"☆".repeat(Math.max(0, 5 - challenge.difficulty))}
                    </span>
                  </div>

                  <h1 className="text-2xl font-bold text-white mb-4">
                    {challenge.name}
                  </h1>

                  {/* Mission statement */}
                  {challenge.mission && (
                    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">🎯</span>
                        <div>
                          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">
                            Your Mission
                          </h2>
                          <p className="text-base text-white font-medium">
                            {challenge.mission}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {challenge.description && (
                    <p className="text-slate-400 mb-4">{challenge.description}</p>
                  )}

                  {/* External resource links */}
                  <div className="flex flex-wrap gap-3">
                    {challenge.targetPdbId && (
                      <a
                        href={`https://www.rcsb.org/structure/${challenge.targetPdbId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors"
                      >
                        <span className="font-medium">PDB:</span>
                        <span className="text-blue-400">{challenge.targetPdbId}</span>
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                    {challenge.targetUniprotId && (
                      <a
                        href={`https://www.uniprot.org/uniprotkb/${challenge.targetUniprotId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors"
                      >
                        <span className="font-medium">UniProt:</span>
                        <span className="text-blue-400">{challenge.targetUniprotId}</span>
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Learn More Tab */}
              {activeTab === "learn" && (
                <div>
                  {challenge.educationalContent ? (
                    <div className="text-slate-300 prose prose-invert prose-sm max-w-none">
                      <Markdown
                        components={markdownComponents}
                        urlTransform={urlTransform}
                      >
                        {challenge.educationalContent}
                      </Markdown>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">
                      No additional educational content available for this challenge.
                    </p>
                  )}
                </div>
              )}

              {/* Sequence Tab */}
              {activeTab === "sequence" && (
                <div className="space-y-4">
                  {challenge.targetSequence && challenge.targetChainId ? (
                    <SequenceSelector
                      sequence={challenge.targetSequence}
                      chainId={challenge.targetChainId}
                      startResidueNumber={challenge.pdbStartResidue || 1}
                      selectedResidues={selectedHotspots}
                      onSelectionChange={setSelectedHotspots}
                      suggestedHotspots={suggestedHotspots}
                      uniprotId={challenge.targetUniprotId}
                    />
                  ) : challenge.targetSequence ? (
                    <SequenceDisplay sequence={challenge.targetSequence} />
                  ) : (
                    <p className="text-slate-500 italic">
                      No target sequence available for this challenge.
                    </p>
                  )}
                  {challenge.targetUniprotId && (
                    <a
                      href={`https://www.uniprot.org/uniprotkb/${challenge.targetUniprotId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors"
                    >
                      <span className="font-medium">UniProt:</span>
                      <span className="text-blue-400">{challenge.targetUniprotId}</span>
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              )}

              {/* Leaderboard Tab */}
              {activeTab === "leaderboard" && (
                <Leaderboard challengeId={challenge.id} challengeName={challenge.name} />
              )}
            </div>
          </div>

          {showDesignPanel ? (
            <DesignPanel
              challengeId={challenge.id}
              challengeName={challenge.name}
              challengeTaskType={challenge.taskType}
              targetSequence={challenge.targetSequence}
              targetStructureUrl={challenge.targetStructureUrl}
              targetChainId={challenge.targetChainId}
              suggestedHotspots={suggestedHotspots}
              onClose={() => {
                setShowDesignPanel(false);
                setSelectedHotspots([]); // Clear highlights when closing
              }}
              selectedHotspots={selectedHotspots}
              onHotspotsChange={setSelectedHotspots}
            />
          ) : (
            <>
              {activeTab === "overview" && (
                <button
                  onClick={() => setActiveTab("learn")}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Learn More
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              {activeTab === "learn" && (
                <button
                  onClick={() => setActiveTab("sequence")}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  View Sequence
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              {activeTab === "sequence" && (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
