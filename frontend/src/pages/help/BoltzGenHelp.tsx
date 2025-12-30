/**
 * BoltzGen Help Page
 *
 * In-depth guide to using BoltzGen for diffusion-based binder design.
 */

import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function BoltzGenHelp() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Helmet>
        <title>BoltzGen Guide | VibeProteins</title>
        <meta name="description" content="Learn how to use BoltzGen for diffusion-based protein binder design with Boltz-2." />
      </Helmet>

      <div className="mb-6">
        <Link to="/help/design" className="text-blue-400 hover:text-blue-300">
          &larr; Back to Design Tools
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-emerald-500/20 rounded-lg">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">BoltzGen</h1>
            <p className="text-emerald-400">Boltz-2 powered binder generation</p>
          </div>
        </div>
        <p className="text-slate-400">
          BoltzGen is a protein design pipeline that uses diffusion models to generate novel protein
          binders. It's built on top of the Boltz-2 structure prediction model and supports multiple
          design protocols including protein-protein, peptide, nanobody, and antibody design.
        </p>
      </div>

      {/* How it works */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">How It Works</h2>
        <div className="bg-slate-800 rounded-xl p-6 space-y-4">
          <p className="text-slate-300">
            BoltzGen follows a five-stage pipeline that takes your target specification and produces
            ranked, diverse binder candidates ready for experimental testing.
          </p>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-400 mb-1">Design</div>
              <p className="text-slate-400 text-xs">Generate backbone structures</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-400 mb-1">Inverse Fold</div>
              <p className="text-slate-400 text-xs">Create sequences for backbones</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-400 mb-1">Fold</div>
              <p className="text-slate-400 text-xs">Validate with Boltz-2</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-400 mb-1">Analyze</div>
              <p className="text-slate-400 text-xs">Score design quality</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-400 mb-1">Filter</div>
              <p className="text-slate-400 text-xs">Rank by quality & diversity</p>
            </div>
          </div>
        </div>
      </section>

      {/* Design protocols */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Design Protocols</h2>
        <div className="bg-slate-800 rounded-xl p-6">
          <p className="text-slate-300 mb-4">
            BoltzGen supports multiple design protocols for different use cases:
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h3 className="font-medium text-white mb-2">protein-anything</h3>
              <p className="text-slate-400 text-sm">General protein binder design for any target type</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h3 className="font-medium text-white mb-2">peptide-anything</h3>
              <p className="text-slate-400 text-sm">Short peptide binders (typically &lt;50 residues)</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h3 className="font-medium text-white mb-2">nanobody-anything</h3>
              <p className="text-slate-400 text-sm">Single-domain antibody (VHH) design</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h3 className="font-medium text-white mb-2">antibody-anything</h3>
              <p className="text-slate-400 text-sm">Full antibody design with heavy and light chains</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 md:col-span-2">
              <h3 className="font-medium text-white mb-2">protein-small_molecule</h3>
              <p className="text-slate-400 text-sm">Design proteins that bind to small molecule ligands</p>
            </div>
          </div>
        </div>
      </section>

      {/* Inputs */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Inputs</h2>
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-white mb-2">Target Specification (Required)</h3>
              <p className="text-slate-400 text-sm">
                Defined via YAML configuration specifying target proteins/ligands from CIF/PDB files
                or sequences, binding sites, and design constraints.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Number of Designs</h3>
              <p className="text-slate-400 text-sm">
                How many initial candidates to generate. The authors recommend 10,000-60,000 for
                comprehensive exploration. More designs = better chances of finding good binders.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Budget</h3>
              <p className="text-slate-400 text-sm">
                The final number of designs after filtering. This is your "shopping list" of
                candidates to test experimentally.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Alpha (Quality vs Diversity)</h3>
              <p className="text-slate-400 text-sm">
                Trade-off parameter: 0.0 = pure quality ranking, 1.0 = pure diversity.
                Values around 0.3-0.5 give a good balance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Outputs */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Outputs</h2>
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-white mb-2">intermediate_designs/</h3>
              <p className="text-slate-400 text-sm">
                Raw backbone structures before sequence design.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">intermediate_designs_inverse_folded/</h3>
              <p className="text-slate-400 text-sm">
                Structures with predicted sequences after inverse folding.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">final_ranked_designs/</h3>
              <p className="text-slate-400 text-sm">
                Quality-ranked and diversity-optimized final selections. These are your best candidates.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Metrics & Reports</h3>
              <p className="text-slate-400 text-sm">
                CSV files with quantitative analysis and PDF visual summaries.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key parameters */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Key Parameters</h2>
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 text-slate-400 font-medium">Parameter</th>
                  <th className="text-left py-3 text-slate-400 font-medium">Description</th>
                  <th className="text-left py-3 text-slate-400 font-medium">Recommended</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-700/50">
                  <td className="py-3 font-mono text-emerald-400">--num_designs</td>
                  <td className="py-3">Total candidates to generate</td>
                  <td className="py-3">10,000 - 60,000</td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-3 font-mono text-emerald-400">--budget</td>
                  <td className="py-3">Final designs after filtering</td>
                  <td className="py-3">100 - 1,000</td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-3 font-mono text-emerald-400">--protocol</td>
                  <td className="py-3">Design mode</td>
                  <td className="py-3">protein-anything</td>
                </tr>
                <tr>
                  <td className="py-3 font-mono text-emerald-400">--alpha</td>
                  <td className="py-3">Quality (0) vs Diversity (1)</td>
                  <td className="py-3">0.3 - 0.5</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">BoltzGen vs Other Methods</h2>
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 text-slate-400 font-medium">Aspect</th>
                  <th className="text-left py-3 text-emerald-400 font-medium">BoltzGen</th>
                  <th className="text-left py-3 text-blue-400 font-medium">RFDiffusion</th>
                  <th className="text-left py-3 text-amber-400 font-medium">BindCraft</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-700/50">
                  <td className="py-3">Base Model</td>
                  <td className="py-3">Boltz-2</td>
                  <td className="py-3">RoseTTAFold</td>
                  <td className="py-3">AlphaFold2</td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-3">Antibody Support</td>
                  <td className="py-3 text-green-400">Yes (native)</td>
                  <td className="py-3 text-yellow-400">Limited</td>
                  <td className="py-3 text-yellow-400">Limited</td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-3">Small Molecules</td>
                  <td className="py-3 text-green-400">Yes</td>
                  <td className="py-3 text-red-400">No</td>
                  <td className="py-3 text-red-400">No</td>
                </tr>
                <tr>
                  <td className="py-3">Diversity Control</td>
                  <td className="py-3 text-green-400">Built-in (alpha)</td>
                  <td className="py-3 text-yellow-400">Post-hoc</td>
                  <td className="py-3 text-yellow-400">Post-hoc</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Tips for Success</h2>
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-6">
          <ul className="space-y-3 text-slate-300">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">1</span>
              <span><strong>Generate many candidates:</strong> BoltzGen is designed for high-throughput generation. More designs = better final candidates.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">2</span>
              <span><strong>Balance quality and diversity:</strong> Use alpha ~0.3-0.5 to get both high-scoring and diverse designs.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">3</span>
              <span><strong>Choose the right protocol:</strong> Use nanobody-anything for VHH designs, peptide-anything for short binders.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">4</span>
              <span><strong>Check the overview PDF:</strong> The visual summaries help quickly identify promising candidates.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Cost and time */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Cost & Time</h2>
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm text-slate-500 uppercase mb-1">Estimated Cost</h3>
              <p className="text-2xl font-bold text-white">$0.50 - $3.00</p>
              <p className="text-slate-400 text-sm">Depends on num_designs and budget</p>
            </div>
            <div>
              <h3 className="text-sm text-slate-500 uppercase mb-1">Estimated Time</h3>
              <p className="text-2xl font-bold text-white">5 - 20 minutes</p>
              <p className="text-slate-400 text-sm">Scales with number of designs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Learn more */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Learn More</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/HannesStark/boltzgen"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            GitHub Repository
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}
