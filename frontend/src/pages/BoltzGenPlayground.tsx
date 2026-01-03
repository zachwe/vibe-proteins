import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useCurrentUser } from "../lib/hooks";
import { jobsApi } from "../lib/api";

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
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    target: true,
    design: true,
    designParams: false,
    inverseFolding: false,
    filtering: false,
    execution: false,
  });

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
        challengeId: "playground",
        type: "boltzgen",
        input,
      });

      setJob(response.job);
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

  return (
    <div className="min-h-screen bg-slate-900">
      <Helmet>
        <title>BoltzGen Playground | ProteinDojo</title>
        <meta name="description" content="Design protein binders using BoltzGen - diffusion-based backbone design with Boltz-2 validation." />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link to="/challenges" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Challenges
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">BoltzGen Playground</h1>
          <p className="text-slate-400">
            Design protein binders using diffusion-based backbone generation, inverse folding,
            and Boltz-2 structure validation. <a href="https://github.com/HannesStark/boltzgen" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Learn more</a>
          </p>
        </div>

        {/* Warning about cost/time */}
        <div className="bg-amber-500/10 border border-amber-500 text-amber-400 rounded-lg p-4 mb-8">
          <strong>Note:</strong> BoltzGen runs on A100 GPUs and can take several hours for large design runs.
          Start with smaller num_designs (100) and budget (10) for testing.
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-4 mb-8">
            {error}
          </div>
        )}

        {job && (
          <div className="bg-green-500/10 border border-green-500 text-green-400 rounded-lg p-4 mb-8">
            <p className="font-semibold">Job submitted successfully!</p>
            <p className="text-sm mt-1">Job ID: {job.id}</p>
            <p className="text-sm">Status: {job.status}</p>
            <Link to={`/jobs/${job.id}`} className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
              View job details &rarr;
            </Link>
          </div>
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
