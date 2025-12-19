import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            VibeProteins
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Learn protein design by practicing against real druggable targets.
            Design binders, blockers, and decoys with cutting-edge AI tools.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/challenges"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Browse Challenges
            </Link>
            <Link
              to="/login"
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-3">
              Real Targets
            </h3>
            <p className="text-slate-400">
              Practice on clinically validated targets like Spike RBD, IL-6, PD-L1, and more.
            </p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-3">
              AI-Powered Design
            </h3>
            <p className="text-slate-400">
              Use RFdiffusion, Boltz-2, and other state-of-the-art protein design tools.
            </p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-3">
              Instant Feedback
            </h3>
            <p className="text-slate-400">
              Get scored on ipSAE, pLDDT, and interface metrics with actionable insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
