import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { referenceBindersApi, submissionsApi, challengesApi } from "../lib/api";
import type { ReferenceBinder, Submission, Challenge } from "../lib/api";
import MolstarViewer, { type ChainInfo } from "../components/MolstarViewer";
import Spinner from "../components/Spinner";

interface StructureViewerData {
  type: "reference" | "submission";
  title: string;
  subtitle: string;
  structureUrl: string | null;
  pdbId: string | null;
  chainColors: {
    target?: string[];
    binder?: string[];
    context?: string[];
  };
  scores: {
    compositeScore: number | null;
    plddt: number | null;
    ptm: number | null;
    ipSaeScore: number | null;
    interfaceArea: number | null;
  };
  metadata: {
    binderType?: string;
    discoveryYear?: number | null;
    helpArticleSlug?: string | null;
    challengeId?: string;
    challengeName?: string;
  };
}

function ScoreCard({ label, value, decimals = 1 }: { label: string; value: number | null; decimals?: number }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-lg font-mono text-white">
        {value !== null ? value.toFixed(decimals) : "-"}
      </div>
    </div>
  );
}

function ReferenceBinderViewer({ binderId }: { binderId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reference-binder", binderId],
    queryFn: async () => {
      const response = await referenceBindersApi.get(binderId);
      return response.referenceBinder;
    },
  });

  const { data: challengeData } = useQuery({
    queryKey: ["challenge", data?.challengeId],
    queryFn: async () => {
      if (!data?.challengeId) return null;
      const response = await challengesApi.get(data.challengeId);
      return response.challenge;
    },
    enabled: !!data?.challengeId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4">
        Failed to load reference binder: {error?.message || "Not found"}
      </div>
    );
  }

  // Determine structure URL - prefer complexStructureUrl (Boltz-folded)
  // If no complexStructureUrl, let MolstarViewer handle pdbId construction
  const structureUrl = data.complexStructureUrl || undefined;

  // Determine chain colors based on available chain info
  const chainColors: { target?: string[]; binder?: string[] } = {};
  if (data.binderChainId) {
    chainColors.binder = [data.binderChainId];
    // Assume other chains are target - typically A for target, B for binder
    // If binder is B, target is likely A
    if (data.binderChainId === "B") {
      chainColors.target = ["A"];
    } else if (data.binderChainId !== "A") {
      chainColors.target = ["A"];
    }
  }

  return (
    <StructureViewerContent
      data={{
        type: "reference",
        title: data.name,
        subtitle: `Reference Binder${data.binderType ? ` (${formatBinderType(data.binderType)})` : ""}`,
        structureUrl,
        pdbId: data.pdbId,
        chainColors,
        scores: {
          compositeScore: data.compositeScore,
          plddt: data.plddt,
          ptm: data.ptm,
          ipSaeScore: data.ipSaeScore,
          interfaceArea: data.interfaceArea,
        },
        metadata: {
          binderType: data.binderType,
          discoveryYear: data.discoveryYear,
          helpArticleSlug: data.helpArticleSlug,
          challengeId: data.challengeId,
          challengeName: challengeData?.name,
        },
      }}
    />
  );
}

function SubmissionViewer({ submissionId }: { submissionId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: async () => {
      const response = await submissionsApi.get(submissionId);
      return response.submission;
    },
  });

  const { data: challengeData } = useQuery({
    queryKey: ["challenge", data?.challengeId],
    queryFn: async () => {
      if (!data?.challengeId) return null;
      const response = await challengesApi.get(data.challengeId);
      return response.challenge;
    },
    enabled: !!data?.challengeId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4">
        Failed to load submission: {error?.message || "Not found"}
      </div>
    );
  }

  // For submissions, default chain coloring: A=target, B=binder
  const chainColors = {
    target: ["A"],
    binder: ["B"],
  };

  return (
    <StructureViewerContent
      data={{
        type: "submission",
        title: `Submission ${data.id.slice(0, 8)}`,
        subtitle: challengeData?.name ? `For: ${challengeData.name}` : "User Submission",
        structureUrl: data.designStructureUrl,
        pdbId: null,
        chainColors,
        scores: {
          compositeScore: data.compositeScore,
          plddt: data.plddt,
          ptm: data.ptm,
          ipSaeScore: data.ipSaeScore,
          interfaceArea: data.interfaceArea,
        },
        metadata: {
          challengeId: data.challengeId,
          challengeName: challengeData?.name,
        },
      }}
    />
  );
}

function StructureViewerContent({ data }: { data: StructureViewerData }) {
  const [chainInfo, setChainInfo] = useState<ChainInfo[]>([]);

  // Determine chain role based on chainColors configuration
  const getChainRole = (chainId: string): 'target' | 'binder' | 'context' | null => {
    if (data.chainColors.target?.includes(chainId)) return 'target';
    if (data.chainColors.binder?.includes(chainId)) return 'binder';
    if (data.chainColors.context?.includes(chainId)) return 'context';
    return null;
  };

  const getChainColorClass = (role: 'target' | 'binder' | 'context' | null): string => {
    switch (role) {
      case 'target': return 'bg-blue-400';
      case 'binder': return 'bg-yellow-300';
      case 'context': return 'bg-emerald-400';
      default: return 'bg-slate-500';
    }
  };

  return (
    <>
      <Helmet>
        <title>{data.title} | Structure Viewer | ProteinDojo</title>
        <meta name="description" content={`View 3D structure of ${data.title}`} />
      </Helmet>

      <div className="min-h-screen bg-slate-900">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <Link to="/leaderboards" className="text-blue-400 hover:text-blue-300 text-sm">
              &larr; Back to Leaderboards
            </Link>
            <h1 className="text-2xl font-bold text-white mt-4">{data.title}</h1>
            <p className="text-slate-400">{data.subtitle}</p>
          </div>

          {/* Main content - structure viewer + info panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Structure viewer - takes 2/3 on large screens */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800 rounded-lg overflow-hidden" style={{ height: "600px" }}>
                {(data.structureUrl || data.pdbId) ? (
                  <MolstarViewer
                    pdbUrl={data.structureUrl || undefined}
                    pdbId={data.pdbId || undefined}
                    chainColors={data.chainColors}
                    minHeight={600}
                    className="h-full"
                    autoSpin={true}
                    hideNonPolymers={true}
                    onChainsLoaded={setChainInfo}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <p>No structure available</p>
                      <p className="text-sm text-slate-500 mt-2">
                        {data.type === "submission"
                          ? "This submission hasn't been scored yet"
                          : "Structure data is missing"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Chain Summary - only show chains with entity descriptions (skip water/ions) */}
              {chainInfo.filter(c => c.entityDescription).length > 0 && (
                <div className="mt-4 bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Structure Chains</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {chainInfo.filter(c => c.entityDescription).map((chain) => {
                      const role = getChainRole(chain.id);
                      return (
                        <div
                          key={chain.id}
                          className="flex items-start gap-3 p-2 rounded bg-slate-800/50"
                        >
                          <div className={`w-3 h-3 rounded mt-0.5 flex-shrink-0 ${getChainColorClass(role)}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">Chain {chain.id}</span>
                              {role && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  role === 'target' ? 'bg-blue-500/20 text-blue-300' :
                                  role === 'binder' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-emerald-500/20 text-emerald-300'
                                }`}>
                                  {role}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate" title={chain.entityDescription}>
                              {chain.entityDescription}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Color Legend (fallback when no chain info) */}
              {chainInfo.length === 0 && (
                <div className="mt-4 flex items-center gap-6 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-400" />
                    <span>Target</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-300" />
                    <span>Binder</span>
                  </div>
                </div>
              )}
            </div>

            {/* Info panel - takes 1/3 on large screens */}
            <div className="space-y-6">
              {/* Scores */}
              <div className="bg-slate-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-white mb-4">Scores</h2>
                <div className="grid grid-cols-2 gap-3">
                  <ScoreCard label="Composite" value={data.scores.compositeScore} />
                  <ScoreCard label="pLDDT" value={data.scores.plddt} />
                  <ScoreCard label="pTM" value={data.scores.ptm} decimals={2} />
                  <ScoreCard label="ipSAE" value={data.scores.ipSaeScore} />
                </div>
                {data.scores.interfaceArea && (
                  <div className="mt-3">
                    <ScoreCard label="Interface Area (Å²)" value={data.scores.interfaceArea} decimals={0} />
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="bg-slate-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
                <dl className="space-y-3 text-sm">
                  {data.metadata.binderType && (
                    <div>
                      <dt className="text-slate-400">Type</dt>
                      <dd className="text-white">{formatBinderType(data.metadata.binderType)}</dd>
                    </div>
                  )}
                  {data.metadata.discoveryYear && (
                    <div>
                      <dt className="text-slate-400">Discovery Year</dt>
                      <dd className="text-white">{data.metadata.discoveryYear}</dd>
                    </div>
                  )}
                  {data.pdbId && (
                    <div>
                      <dt className="text-slate-400">PDB ID</dt>
                      <dd>
                        <a
                          href={`https://www.rcsb.org/structure/${data.pdbId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {data.pdbId}
                        </a>
                      </dd>
                    </div>
                  )}
                  {data.metadata.challengeName && (
                    <div>
                      <dt className="text-slate-400">Challenge</dt>
                      <dd>
                        <Link
                          to={`/challenges/${data.metadata.challengeId}`}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {data.metadata.challengeName}
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Links */}
              {data.metadata.helpArticleSlug && (
                <div className="bg-slate-800 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-white mb-4">Learn More</h2>
                  <Link
                    to={`/help/${data.metadata.helpArticleSlug}`}
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Read about {data.title}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function formatBinderType(type: string): string {
  const map: Record<string, string> = {
    antibody: "Antibody",
    nanobody: "Nanobody",
    fusion_protein: "Fusion Protein",
    designed: "AI-Designed",
    natural: "Natural",
  };
  return map[type] || type;
}

export default function StructureViewer() {
  const { type, id } = useParams<{ type: string; id: string }>();

  if (!type || !id) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4">
          Invalid URL. Please specify a structure type and ID.
        </div>
      </div>
    );
  }

  if (type === "reference") {
    return <ReferenceBinderViewer binderId={id} />;
  }

  if (type === "submission") {
    return <SubmissionViewer submissionId={id} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4">
        Unknown structure type: {type}
      </div>
    </div>
  );
}
