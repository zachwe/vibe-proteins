import { useParams, Link } from "react-router-dom";

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/challenges" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Challenges
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left side - Target viewer placeholder */}
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="aspect-square bg-slate-700 rounded-lg flex items-center justify-center">
              <p className="text-slate-400">
                Mol* Viewer will render here
                <br />
                <span className="text-sm">Target: {id}</span>
              </p>
            </div>
          </div>

          {/* Right side - Challenge info and workflow */}
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl p-6">
              <h1 className="text-2xl font-bold text-white mb-4">
                Challenge: {id}
              </h1>
              <p className="text-slate-400 mb-4">
                Educational content about this target will appear here.
                Learn about the biology, disease relevance, and why this
                target matters.
              </p>
              <div className="flex gap-2">
                <span className="bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded">
                  Level 1
                </span>
                <span className="bg-slate-600 text-white text-xs font-semibold px-2 py-1 rounded">
                  Binder
                </span>
              </div>
            </div>

            {/* Workflow steps */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Design Workflow
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-slate-700 rounded-lg">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    1
                  </div>
                  <div>
                    <p className="text-white font-medium">Explore</p>
                    <p className="text-slate-400 text-sm">
                      View target structure and binding sites
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-slate-700 rounded-lg opacity-50">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white font-semibold">
                    2
                  </div>
                  <div>
                    <p className="text-white font-medium">Design</p>
                    <p className="text-slate-400 text-sm">
                      Generate candidates with AI tools
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-slate-700 rounded-lg opacity-50">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white font-semibold">
                    3
                  </div>
                  <div>
                    <p className="text-white font-medium">Evaluate</p>
                    <p className="text-slate-400 text-sm">
                      Score and compare your designs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-slate-700 rounded-lg opacity-50">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white font-semibold">
                    4
                  </div>
                  <div>
                    <p className="text-white font-medium">Submit</p>
                    <p className="text-slate-400 text-sm">
                      Submit for official scoring
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
              Start Designing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
