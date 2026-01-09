import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useCurrentUser, useChallenge, useJob } from "../lib/hooks";
import { jobsApi, type ChainAnnotation } from "../lib/api";
import MolstarViewer from "../components/MolstarViewer";
import Spinner from "../components/Spinner";

interface JobResult {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
}

// Protocol options for BoltzGen
const PROTOCOLS = [
  { value: "protein-anything", label: "Protein → Anything", description: "Design protein binders for any target" },
  { value: "peptide-anything", label: "Peptide → Anything", description: "Design cyclic peptides (no cysteines)" },
  { value: "protein-small_molecule", label: "Protein → Small Molecule", description: "Design protein binders with affinity prediction" },
  { value: "antibody-anything", label: "Antibody CDR", description: "Design antibody CDR regions" },
  { value: "nanobody-anything", label: "Nanobody CDR", description: "Design nanobody CDR regions" },
];

// Pipeline steps
const PIPELINE_STEPS = [
  { value: "design", label: "Design", description: "Diffusion-based backbone generation" },
  { value: "inverse_folding", label: "Inverse Folding", description: "Sequence design for backbones" },
  { value: "folding", label: "Folding", description: "Structure prediction with Boltz-2" },
  { value: "analysis", label: "Analysis", description: "Metric computation" },
  { value: "filtering", label: "Filtering", description: "Quality + diversity selection" },
];

interface FormState {
  // Target
  targetStructureUrl: string;
  targetChainIds: string;

  // Design
  binderLengthRange: string;
  bindingResidues: string;
  protocol: string;

  // Design parameters
  numDesigns: number;
  diffusionBatchSize: string;
  stepScale: string;
  noiseScale: string;

  // Inverse folding
  inverseFoldNumSequences: number;
  inverseFoldAvoid: string;
  skipInverseFolding: boolean;

  // Filtering
  budget: number;
  alpha: number;
  filterBiased: boolean;
  refoldingRmsdThreshold: string;
  additionalFilters: string;
  metricsOverride: string;

  // Execution
  steps: string[];
  reuse: boolean;
}

const defaultFormState: FormState = {
  targetStructureUrl: "",
  targetChainIds: "",
  binderLengthRange: "80..120",
  bindingResidues: "",
  protocol: "protein-anything",
  numDesigns: 100,
  diffusionBatchSize: "",
  stepScale: "",
  noiseScale: "",
  inverseFoldNumSequences: 1,
  inverseFoldAvoid: "",
  skipInverseFolding: false,
  budget: 10,
  alpha: 0.01,
  filterBiased: true,
  refoldingRmsdThreshold: "",
  additionalFilters: "",
  metricsOverride: "",
  steps: [],
  reuse: false,
};

export default function BoltzGenPlayground() {
  const [searchParams] = useSearchParams();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  // Read URL params for challenge context
  const challengeIdParam = searchParams.get("challengeId");
  const targetUrlParam = searchParams.get("targetUrl");
  const chainIdParam = searchParams.get("chainId");
  const hotspotsParam = searchParams.get("hotspots");
  const returnHashParam = searchParams.get("returnHash");

  // Fetch challenge data if challengeId is provided
  const { data: challenge } = useChallenge(challengeIdParam || "");

  // Compute back URL with preserved hash state
  const backUrl = useMemo(() => {
    if (challengeIdParam) {
      const hash = returnHashParam ? decodeURIComponent(returnHashParam) : "";
      return `/challenges/${challengeIdParam}${hash}`;
    }
    return "/challenges";
  }, [challengeIdParam, returnHashParam]);

  const [form, setForm] = useState<FormState>(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    target: true,
    design: true,
    designParams: false,
    inverseFolding: false,
    filtering: false,
    execution: false,
  });

  // Poll for job updates when a job is submitted
  const { data: job } = useJob(submittedJobId || "");

  // Pre-fill form from URL params on mount
  useEffect(() => {
    const updates: Partial<FormState> = {};

    if (targetUrlParam) {
      updates.targetStructureUrl = targetUrlParam;
    }
    if (chainIdParam) {
      updates.targetChainIds = chainIdParam;
    }
    if (hotspotsParam) {
      updates.bindingResidues = hotspotsParam;
    }

    if (Object.keys(updates).length > 0) {
      setForm(prev => ({ ...prev, ...updates }));
    }
  }, [targetUrlParam, chainIdParam, hotspotsParam]);

  // Parse chain annotations from challenge for Molstar coloring
  const chainAnnotations = useMemo(() => {
    if (!challenge?.chainAnnotations) return null;
    try {
      return JSON.parse(challenge.chainAnnotations) as Record<string, ChainAnnotation>;
    } catch {
      return null;
    }
  }, [challenge?.chainAnnotations]);

  // Compute chain colors for Molstar viewer
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

  // Parse binding residues for highlighting
  const highlightResidues = useMemo(() => {
    if (!form.bindingResidues) return undefined;
    return form.bindingResidues.split(",").map(s => s.trim()).filter(Boolean);
  }, [form.bindingResidues]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Build input object
      const input: Record<string, unknown> = {
        targetStructureUrl: form.targetStructureUrl || undefined,
        targetChainIds: form.targetChainIds ? form.targetChainIds.split(",").map(s => s.trim()) : undefined,
        binderLengthRange: form.binderLengthRange || undefined,
        bindingResidues: form.bindingResidues ? form.bindingResidues.split(",").map(s => s.trim()) : undefined,
        boltzgenProtocol: form.protocol,
        numDesigns: form.numDesigns,
        diffusionBatchSize: form.diffusionBatchSize ? parseInt(form.diffusionBatchSize) : undefined,
        stepScale: form.stepScale ? parseFloat(form.stepScale) : undefined,
        noiseScale: form.noiseScale ? parseFloat(form.noiseScale) : undefined,
        inverseFoldNumSequences: form.inverseFoldNumSequences,
        inverseFoldAvoid: form.inverseFoldAvoid || undefined,
        skipInverseFolding: form.skipInverseFolding,
        boltzgenBudget: form.budget,
        boltzgenAlpha: form.alpha,
        filterBiased: form.filterBiased,
        refoldingRmsdThreshold: form.refoldingRmsdThreshold ? parseFloat(form.refoldingRmsdThreshold) : undefined,
        additionalFilters: form.additionalFilters ? form.additionalFilters.split("\n").filter(s => s.trim()) : undefined,
        metricsOverride: form.metricsOverride || undefined,
        boltzgenSteps: form.steps.length > 0 ? form.steps : undefined,
        boltzgenReuse: form.reuse,
      };

      // Remove undefined values
      Object.keys(input).forEach(key => {
        if (input[key] === undefined) delete input[key];
      });

      const response = await jobsApi.create({
        challengeId: challengeIdParam || "playground",
        type: "boltzgen",
        input,
      });

      setSubmittedJobId(response.job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepToggle = (step: string) => {
    setForm(prev => ({
      ...prev,
      steps: prev.steps.includes(step)
        ? prev.steps.filter(s => s !== step)
        : [...prev.steps, step],
    }));
  };

  if (!user && !userLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Sign in to use BoltzGen Playground</h1>
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // Determine the structure URL for the viewer
  const viewerStructureUrl = form.targetStructureUrl || challenge?.targetStructureUrl || undefined;

  return (
    <div className="min-h-screen bg-slate-900">
      <Helmet>
        <title>BoltzGen Playground | ProteinDojo</title>
        <meta name="description" content="Design protein binders using BoltzGen - diffusion-based backbone design with Boltz-2 validation." />
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            to={backUrl}
            className="text-blue-400 hover:text-blue-300"
          >
            &larr; {challengeIdParam ? `Back to ${challenge?.name || "Challenge"}` : "Back to Challenges"}
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left side - Molstar viewer */}
          <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
            <div className="bg-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-400 mb-3">Target Structure</h2>
              <div className="aspect-square bg-slate-700 rounded-lg overflow-hidden">
                {viewerStructureUrl ? (
                  <MolstarViewer
                    pdbUrl={viewerStructureUrl}
                    pdbId={challenge?.targetPdbId || undefined}
                    highlightResidues={highlightResidues}
                    chainColors={chainColors}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <p className="text-sm">Enter a structure URL below</p>
                    </div>
                  </div>
                )}
              </div>
              {highlightResidues && highlightResidues.length > 0 && (
                <div className="mt-3 text-xs text-slate-400">
                  <span className="text-purple-400 font-medium">{highlightResidues.length}</span> binding residues highlighted
                </div>
              )}
            </div>

            {/* Challenge info card when in challenge context */}
            {challenge && (
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="font-medium text-white mb-2">{challenge.name}</h3>
                {challenge.mission && (
                  <p className="text-sm text-slate-400 mb-3">{challenge.mission}</p>
                )}
                <div className="flex gap-2 text-xs">
                  {challenge.targetPdbId && (
                    <a
                      href={`https://www.rcsb.org/structure/${challenge.targetPdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      PDB: {challenge.targetPdbId}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right side - Form */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {challengeIdParam ? "Design with BoltzGen" : "BoltzGen Designer"}
              </h1>
              <p className="text-slate-400 text-sm">
                Design protein binders using diffusion-based backbone generation, inverse folding,
                and Boltz-2 structure validation.{" "}
                <Link to="/help/design/boltzgen" className="text-blue-400 hover:text-blue-300">
                  Learn more
                </Link>
              </p>
            </div>

            {/* Warning about cost/time */}
            <div className="bg-amber-500/10 border border-amber-500 text-amber-400 rounded-lg p-4">
              <strong>Note:</strong> BoltzGen runs on A100 GPUs and can take several hours for large design runs.
              Start with smaller num_designs (100) and budget (10) for testing.
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4">
                {error}
              </div>
            )}

            {submittedJobId && (
              <JobStatusPanel
                job={job}
                jobId={submittedJobId}
                onReset={() => setSubmittedJobId(null)}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
          {/* Target Section */}
          <Section
            title="Target Structure"
            expanded={expandedSections.target}
            onToggle={() => toggleSection("target")}
            required
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Structure URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={form.targetStructureUrl}
                  onChange={e => updateForm("targetStructureUrl", e.target.value)}
                  placeholder="https://files.rcsb.org/download/1ABC.pdb"
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  required
                />
                <p className="text-slate-500 text-xs mt-1">URL to PDB or CIF file</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Chain IDs (optional)
                </label>
                <input
                  type="text"
                  value={form.targetChainIds}
                  onChange={e => updateForm("targetChainIds", e.target.value)}
                  placeholder="A, B"
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-slate-500 text-xs mt-1">Comma-separated chain IDs to include (default: all chains)</p>
              </div>
            </div>
          </Section>

          {/* Design Section */}
          <Section
            title="Design Specification"
            expanded={expandedSections.design}
            onToggle={() => toggleSection("design")}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Protocol
                </label>
                <select
                  value={form.protocol}
                  onChange={e => updateForm("protocol", e.target.value)}
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                >
                  {PROTOCOLS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <p className="text-slate-500 text-xs mt-1">
                  {PROTOCOLS.find(p => p.value === form.protocol)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Binder Length Range
                </label>
                <input
                  type="text"
                  value={form.binderLengthRange}
                  onChange={e => updateForm("binderLengthRange", e.target.value)}
                  placeholder="80..120"
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-slate-500 text-xs mt-1">Range (e.g., "80..120") or fixed length (e.g., "100")</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Binding Residues (optional)
                </label>
                <input
                  type="text"
                  value={form.bindingResidues}
                  onChange={e => updateForm("bindingResidues", e.target.value)}
                  placeholder="5..7, 13, 25..30"
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-slate-500 text-xs mt-1">Target residue ranges to bind (comma-separated)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Number of Designs
                  </label>
                  <input
                    type="number"
                    value={form.numDesigns}
                    onChange={e => updateForm("numDesigns", parseInt(e.target.value) || 100)}
                    min={10}
                    max={60000}
                    className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-slate-500 text-xs mt-1">Total designs to generate (100-60000)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Budget (Final Designs)
                  </label>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={e => updateForm("budget", parseInt(e.target.value) || 10)}
                    min={1}
                    max={1000}
                    className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-slate-500 text-xs mt-1">Number of designs after filtering</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Advanced Design Parameters */}
          <Section
            title="Advanced Design Parameters"
            expanded={expandedSections.designParams}
            onToggle={() => toggleSection("designParams")}
            optional
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Diffusion Batch Size
                  </label>
                  <input
                    type="number"
                    value={form.diffusionBatchSize}
                    onChange={e => updateForm("diffusionBatchSize", e.target.value)}
                    placeholder="Auto"
                    className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Step Scale
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.stepScale}
                    onChange={e => updateForm("stepScale", e.target.value)}
                    placeholder="1.8"
                    className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Noise Scale
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.noiseScale}
                    onChange={e => updateForm("noiseScale", e.target.value)}
                    placeholder="0.98"
                    className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Inverse Folding */}
          <Section
            title="Inverse Folding"
            expanded={expandedSections.inverseFolding}
            onToggle={() => toggleSection("inverseFolding")}
            optional
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Sequences per Backbone
                  </label>
                  <input
                    type="number"
                    value={form.inverseFoldNumSequences}
                    onChange={e => updateForm("inverseFoldNumSequences", parseInt(e.target.value) || 1)}
                    min={1}
                    max={10}
                    className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Avoid Residues
                  </label>
                  <input
                    type="text"
                    value={form.inverseFoldAvoid}
                    onChange={e => updateForm("inverseFoldAvoid", e.target.value)}
                    placeholder="C"
                    className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-slate-500 text-xs mt-1">Amino acids to avoid (e.g., "C" for no cysteines)</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={form.skipInverseFolding}
                  onChange={e => updateForm("skipInverseFolding", e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600"
                />
                Skip inverse folding step
              </label>
            </div>
          </Section>

          {/* Filtering */}
          <Section
            title="Filtering & Selection"
            expanded={expandedSections.filtering}
            onToggle={() => toggleSection("filtering")}
            optional
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Alpha (Quality vs Diversity)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.alpha}
                    onChange={e => updateForm("alpha", parseFloat(e.target.value) || 0.01)}
                    min={0}
                    max={1}
                    className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-slate-500 text-xs mt-1">0 = pure quality, 1 = pure diversity</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Refolding RMSD Threshold
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.refoldingRmsdThreshold}
                    onChange={e => updateForm("refoldingRmsdThreshold", e.target.value)}
                    placeholder="3.0"
                    className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={form.filterBiased}
                  onChange={e => updateForm("filterBiased", e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600"
                />
                Filter composition outliers
              </label>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Additional Filters (one per line)
                </label>
                <textarea
                  value={form.additionalFilters}
                  onChange={e => updateForm("additionalFilters", e.target.value)}
                  placeholder="ALA_fraction<0.3&#10;filter_rmsd_design<2.5"
                  rows={3}
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Metrics Override
                </label>
                <input
                  type="text"
                  value={form.metricsOverride}
                  onChange={e => updateForm("metricsOverride", e.target.value)}
                  placeholder="plip_hbonds_refolded=4"
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-slate-500 text-xs mt-1">Per-metric ranking weights</p>
              </div>
            </div>
          </Section>

          {/* Execution */}
          <Section
            title="Execution Options"
            expanded={expandedSections.execution}
            onToggle={() => toggleSection("execution")}
            optional
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Run Specific Steps Only
                </label>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STEPS.map(step => (
                    <label
                      key={step.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        form.steps.includes(step.value)
                          ? "bg-blue-600/20 border-blue-500 text-blue-400"
                          : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.steps.includes(step.value)}
                        onChange={() => handleStepToggle(step.value)}
                        className="sr-only"
                      />
                      {step.label}
                    </label>
                  ))}
                </div>
                <p className="text-slate-500 text-xs mt-1">Leave empty to run all steps</p>
              </div>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={form.reuse}
                  onChange={e => updateForm("reuse", e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600"
                />
                Reuse existing results from previous runs
              </label>
            </div>
          </Section>

              {/* Submit */}
              <div className="flex items-center justify-between pt-4">
                <div className="text-slate-400 text-sm">
                  Balance: <span className="text-white font-medium">{user?.balanceFormatted ?? "$0.00"}</span>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !form.targetStructureUrl}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Run BoltzGen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Job status panel with real-time progress
function JobStatusPanel({
  job,
  jobId,
  onReset,
}: {
  job: {
    id: string;
    status: "pending" | "running" | "completed" | "failed";
    progress: { stage: string; message: string; timestamp: number }[] | null;
    error: string | null;
    costUsdCents: number | null;
    estimatedCostCents: number | null;
    executionSeconds: number | null;
    billedSeconds: number | null;
    gpuType: string | null;
    createdAt: string;
  } | undefined;
  jobId: string;
  onReset: () => void;
}) {
  // Use API-calculated estimated cost (based on actual GPU pricing)
  const estimatedCost = job?.estimatedCostCents
    ? (job.estimatedCostCents / 100).toFixed(2)
    : null;
  const billedCost = job?.costUsdCents
    ? (job.costUsdCents / 100).toFixed(2)
    : null;

  // Format elapsed time
  const formatElapsed = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };
  // Stage icons for progress display
  const stageIcons: Record<string, string> = {
    init: "🔧",
    design: "🎨",
    inverse_folding: "🔤",
    folding: "⚛️",
    analysis: "📊",
    filtering: "🎯",
    processing: "⚙️",
    upload: "☁️",
    complete: "✓",
  };

  const isLoading = !job;
  const progressEvents = job?.progress;
  const latestProgress = progressEvents && progressEvents.length > 0
    ? progressEvents[progressEvents.length - 1]
    : null;

  // Completed state
  if (job?.status === "completed") {
    const totalCost = job.costUsdCents ? (job.costUsdCents / 100).toFixed(2) : null;
    const totalTime = job.executionSeconds ? formatElapsed(job.executionSeconds) : null;

    return (
      <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
        <p className="text-green-400 font-medium mb-2">BoltzGen pipeline complete!</p>
        <p className="text-slate-300 text-sm mb-3">
          Your protein designs have been generated. View the job to see results.
        </p>
        {(totalCost || totalTime) && (
          <div className="flex gap-4 text-sm text-slate-400 mb-3">
            {totalTime && <span>Duration: <span className="text-white">{totalTime}</span></span>}
            {totalCost && <span>Cost: <span className="text-green-400">${totalCost}</span></span>}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/jobs/${jobId}`}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            View Results
          </Link>
          <button
            onClick={onReset}
            className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Run Another Job
          </button>
        </div>
      </div>
    );
  }

  // Failed state
  if (job?.status === "failed") {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
        <p className="text-red-400 font-medium mb-2">Job failed</p>
        <p className="text-slate-300 text-sm mb-3">
          {job.error || "Something went wrong. Please check your parameters and try again."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/jobs/${jobId}`}
            className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            View Details
          </Link>
          <button
            onClick={onReset}
            className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Running/pending state with progress
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${
          isLoading ? "bg-blue-500 animate-pulse" :
          job?.status === "running" ? "bg-yellow-500 animate-pulse" :
          "bg-slate-500 animate-pulse"
        }`} />
        <span className="text-white font-medium capitalize">
          {isLoading ? "Submitting..." : job?.status || "pending"}
        </span>
      </div>

      {/* Current status banner */}
      <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
        <Spinner size="sm" />
        <span className="text-blue-400 text-sm">
          {isLoading ? "Submitting job..." :
           latestProgress ? latestProgress.message : "Starting BoltzGen pipeline..."}
        </span>
      </div>

      {/* Progress timeline */}
      {progressEvents && progressEvents.length > 0 && (
        <div className="border border-slate-700 rounded-lg overflow-hidden mb-4">
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

      {/* Running cost estimate */}
      {job?.executionSeconds && (
        <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-slate-500 mb-1">Elapsed</div>
              <div className="text-white font-mono">{formatElapsed(job.executionSeconds)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Est. Cost</div>
              <div className="text-yellow-400 font-mono">${estimatedCost}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Billed</div>
              <div className="text-green-400 font-mono">${billedCost || "0.00"}</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center mt-2">
            Cost is billed periodically as the job runs
          </p>
        </div>
      )}

      {/* Job info and link */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 space-y-1">
          <p>Job ID: <Link to={`/jobs/${jobId}`} className="text-blue-400 hover:text-blue-300 font-mono">{jobId}</Link></p>
          {job?.gpuType && <p>GPU: {job.gpuType}</p>}
          {job && <p>Started: {new Date(job.createdAt).toLocaleString()}</p>}
        </div>
        <Link
          to={`/jobs/${jobId}`}
          className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        >
          View Job →
        </Link>
      </div>
    </div>
  );
}

// Collapsible section component
function Section({
  title,
  expanded,
  onToggle,
  children,
  required,
  optional
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {required && <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Required</span>}
          {optional && <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">Optional</span>}
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-6 pb-6 border-t border-slate-700">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}
