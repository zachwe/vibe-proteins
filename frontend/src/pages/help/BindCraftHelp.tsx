/**
 * BindCraft Help Page
 *
 * In-depth guide to using BindCraft for automated binder design.
 */

import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function BindCraftHelp() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Helmet>
        <title>BindCraft Guide | VibeProteins</title>
        <meta name="description" content="Learn how to use BindCraft for automated protein binder design with AlphaFold2." />
      </Helmet>

      <div className="mb-6">
        <Link to="/help/design" className="text-blue-400 hover:text-blue-300">
          &larr; Back to Design Tools
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-500/20 rounded-lg">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">BindCraft</h1>
            <p className="text-amber-400">AlphaFold2-based binder design</p>
          </div>
        </div>
        <p className="text-slate-400">
          BindCraft is an automated protein binder design pipeline that uses AlphaFold2 for structure
          prediction, combined with ProteinMPNN for sequence design and PyRosetta for energy calculations.
          It optimizes binder sequences through backpropagation to maximize binding interactions.
        </p>
      </div>

      {/* How it works */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">How It Works</h2>
        <div className="bg-slate-800 rounded-xl p-6 space-y-4">
          <p className="text-slate-300">
            BindCraft takes a fundamentally different approach than diffusion-based methods.
            Instead of generating structures from noise, it uses AlphaFold2's gradient information
            to iteratively optimize a binder sequence toward better binding predictions.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-2xl mb-2">1</div>
              <h3 className="font-medium text-white mb-1">AF2 Optimization</h3>
              <p className="text-slate-400 text-sm">Backprop through AlphaFold2 to optimize binder sequence</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-2xl mb-2">2</div>
              <h3 className="font-medium text-white mb-1">MPNN Redesign</h3>
              <p className="text-slate-400 text-sm">ProteinMPNN generates improved sequence variants</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-2xl mb-2">3</div>
              <h3 className="font-medium text-white mb-1">Rosetta Scoring</h3>
              <p className="text-slate-400 text-sm">Energy calculations filter physically realistic designs</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-2xl mb-2">4</div>
              <h3 className="font-medium text-white mb-1">Ranking</h3>
              <p className="text-slate-400 text-sm">Multi-metric scoring identifies best candidates</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key features */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Key Features</h2>
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">AF2 Confidence</h3>
                <p className="text-slate-400 text-sm">Directly optimizes for AlphaFold2 confidence scores</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Hotspot Targeting</h3>
                <p className="text-slate-400 text-sm">Specify exact residues for binder contact</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Physics-Based Filtering</h3>
                <p className="text-slate-400 text-sm">PyRosetta ensures physically realistic interactions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Comprehensive Metrics</h3>
                <p className="text-slate-400 text-sm">Multiple scoring criteria for design evaluation</p>
              </div>
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
              <h3 className="font-medium text-white mb-2">Target Structure (Required)</h3>
              <p className="text-slate-400 text-sm">
                PDB file of the protein you want to bind. The target structure is used both for
                optimization and validation.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Hotspot Residues (Recommended)</h3>
              <p className="text-slate-400 text-sm">
                Specific binding site residues to target. BindCraft will optimize contacts to these
                positions during the design process.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Binder Length Range</h3>
              <p className="text-slate-400 text-sm">
                Desired size of the designed binder in amino acids. Typical ranges are 60-120 residues.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Design Parameters (Advanced)</h3>
              <p className="text-slate-400 text-sm">
                Iteration counts (soft, temporary, hard), design weights, and filtering thresholds
                can be customized for specific design goals.
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
              <h3 className="font-medium text-white mb-2">Designed Complexes</h3>
              <p className="text-slate-400 text-sm">
                PDB structures of binder-target complexes, both before and after Rosetta relaxation.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Score Reports</h3>
              <p className="text-slate-400 text-sm">
                CSV files with comprehensive metrics including pLDDT, PAE, interface pTM,
                shape complementarity, and hydrogen bond counts.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Ranked Candidates</h3>
              <p className="text-slate-400 text-sm">
                Final designs ranked by composite scoring. The authors recommend generating
                at least 100 final designs before experimental validation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison with RFDiffusion */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">BindCraft vs RFDiffusion</h2>
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 text-slate-400 font-medium">Aspect</th>
                  <th className="text-left py-3 text-amber-400 font-medium">BindCraft</th>
                  <th className="text-left py-3 text-blue-400 font-medium">RFDiffusion3</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-700/50">
                  <td className="py-3">Approach</td>
                  <td className="py-3">AF2 backpropagation</td>
                  <td className="py-3">Diffusion denoising</td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-3">Sequence Design</td>
                  <td className="py-3">Integrated with structure</td>
                  <td className="py-3">Separate (ProteinMPNN)</td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-3">Physics Scoring</td>
                  <td className="py-3">PyRosetta built-in</td>
                  <td className="py-3">Separate validation</td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-3">Best For</td>
                  <td className="py-3">High-confidence binders</td>
                  <td className="py-3">Diverse backbone exploration</td>
                </tr>
                <tr>
                  <td className="py-3">Compute Time</td>
                  <td className="py-3">Longer (AF2 iterations)</td>
                  <td className="py-3">Faster per design</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Tips for Success</h2>
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
          <ul className="space-y-3 text-slate-300">
            <li className="flex items-start gap-3">
              <span className="text-amber-400 font-bold">1</span>
              <span><strong>Hydrophobic interfaces work better:</strong> AlphaFold2 is more accurate for hydrophobic binding interfaces than hydrophilic ones.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-amber-400 font-bold">2</span>
              <span><strong>Generate many designs:</strong> The authors recommend at least 100 final designs before experimental testing.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-amber-400 font-bold">3</span>
              <span><strong>Check interface pTM:</strong> This metric is a good binary predictor of whether binding will occur (though not affinity).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-amber-400 font-bold">4</span>
              <span><strong>Use Rosetta scores:</strong> The physics-based metrics help filter out physically unrealistic designs.</span>
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
              <p className="text-2xl font-bold text-white">$1.00 - $5.00</p>
              <p className="text-slate-400 text-sm">Per run (depends on iteration count)</p>
            </div>
            <div>
              <h3 className="text-sm text-slate-500 uppercase mb-1">Estimated Time</h3>
              <p className="text-2xl font-bold text-white">10 - 30 minutes</p>
              <p className="text-slate-400 text-sm">Longer than diffusion methods due to AF2 iterations</p>
            </div>
          </div>
        </div>
      </section>

      {/* Learn more */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Learn More</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/martinpacesa/BindCraft"
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
