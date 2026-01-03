/**
 * RFDiffusion3 Help Page
 *
 * In-depth guide to using RFDiffusion3 for de novo binder design.
 */

import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function RFDiffusionHelp() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Helmet>
        <title>RFDiffusion3 Guide | ProteinDojo</title>
        <meta name="description" content="Learn how to use RFDiffusion3 for de novo protein binder design." />
      </Helmet>

      <div className="mb-6">
        <Link to="/help/design" className="text-blue-400 hover:text-blue-300">
          &larr; Back to Design Tools
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">RFDiffusion3</h1>
            <p className="text-blue-400">De novo protein backbone design</p>
          </div>
        </div>
        <p className="text-slate-400">
          RFDiffusion3 is the latest version of the RFDiffusion model from the Baker Lab. It uses
          diffusion-based generative AI to design protein backbones from scratch, with a particular
          strength in creating binders that attach to specific regions of target proteins.
        </p>
      </div>

      {/* How it works */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">How It Works</h2>
        <div className="bg-slate-800 rounded-xl p-6 space-y-4">
          <p className="text-slate-300">
            RFDiffusion works by "denoising" random noise into a protein structure, similar to how
            image generation AI creates pictures from noise. The model has learned the patterns
            of real protein structures from millions of examples.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-2xl mb-2">1</div>
              <h3 className="font-medium text-white mb-1">Start with Noise</h3>
              <p className="text-slate-400 text-sm">Random coordinates are generated as a starting point</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-2xl mb-2">2</div>
              <h3 className="font-medium text-white mb-1">Iterative Denoising</h3>
              <p className="text-slate-400 text-sm">The model gradually refines the structure over many steps</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-2xl mb-2">3</div>
              <h3 className="font-medium text-white mb-1">Conditioned on Target</h3>
              <p className="text-slate-400 text-sm">The target structure guides the design toward binding</p>
            </div>
          </div>
        </div>
      </section>

      {/* On ProteinDojo */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">On ProteinDojo</h2>
        <div className="bg-slate-800 rounded-xl p-6">
          <p className="text-slate-300 mb-4">
            When you run RFDiffusion3 on ProteinDojo, it automatically chains together a complete
            design pipeline:
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
            <span className="bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-lg font-medium">
              RFDiffusion3
            </span>
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-lg font-medium">
              ProteinMPNN
            </span>
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded-lg font-medium">
              Boltz-2
            </span>
          </div>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              <span><strong className="text-slate-300">RFDiffusion3</strong> generates multiple backbone structures (4-8 designs)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span><strong className="text-slate-300">ProteinMPNN</strong> designs amino acid sequences for each backbone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">•</span>
              <span><strong className="text-slate-300">Boltz-2</strong> validates structures and generates binding confidence scores</span>
            </li>
          </ul>
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
                The protein you want to design a binder for. On ProteinDojo, this is provided
                automatically by the challenge.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Hotspot Residues (Recommended)</h3>
              <p className="text-slate-400 text-sm">
                Specific residues on the target where you want the binder to attach. Selecting
                hotspots makes designs more targeted and often leads to stronger binding.
              </p>
              <Link to="/help/design#hotspots" className="text-blue-400 hover:text-blue-300 text-sm">
                Learn more about hotspots →
              </Link>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Binder Length (Advanced)</h3>
              <p className="text-slate-400 text-sm">
                The number of amino acids in your designed binder. ProteinDojo uses sensible
                defaults (typically 60-100 residues) but this can be customized for advanced users.
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
              <h3 className="font-medium text-white mb-2">Binder Designs</h3>
              <p className="text-slate-400 text-sm">
                Multiple candidate binder structures, each with predicted amino acid sequences.
                You'll typically get 4-8 designs per run.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Complex Structures</h3>
              <p className="text-slate-400 text-sm">
                3D structures showing how each binder is predicted to dock with the target protein.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Confidence Scores</h3>
              <p className="text-slate-400 text-sm">
                Metrics like ipSAE, pDockQ, and pLDDT that help you evaluate design quality.
              </p>
              <Link to="/help/metrics" className="text-blue-400 hover:text-blue-300 text-sm">
                Learn about metrics →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Tips for Success</h2>
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6">
          <ul className="space-y-3 text-slate-300">
            <li className="flex items-start gap-3">
              <span className="text-green-400 font-bold">1</span>
              <span><strong>Use hotspots:</strong> Designs with specified hotspots typically have higher success rates than letting the AI choose freely.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 font-bold">2</span>
              <span><strong>Run multiple times:</strong> Each run generates different designs. Running 2-3 times gives you more candidates to choose from.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 font-bold">3</span>
              <span><strong>Check all metrics:</strong> Don't just look at one score. A good design should have reasonable values across ipSAE, pDockQ, and pLDDT.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 font-bold">4</span>
              <span><strong>Visualize the interface:</strong> Use the 3D viewer to check that the binder is making sensible contacts with your target.</span>
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
              <p className="text-2xl font-bold text-white">$0.50 - $2.00</p>
              <p className="text-slate-400 text-sm">Per run (includes ProteinMPNN + Boltz-2)</p>
            </div>
            <div>
              <h3 className="text-sm text-slate-500 uppercase mb-1">Estimated Time</h3>
              <p className="text-2xl font-bold text-white">2 - 5 minutes</p>
              <p className="text-slate-400 text-sm">Depends on target size and GPU availability</p>
            </div>
          </div>
        </div>
      </section>

      {/* Learn more */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Learn More</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://www.bakerlab.org/2022/11/30/diffusion-model-for-protein-design/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            Baker Lab Announcement
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href="https://github.com/RosettaCommons/RFdiffusion"
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
