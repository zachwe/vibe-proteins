import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useSession } from "../lib/auth";
import MolstarHero from "../components/MolstarHero";

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-slate-950 overflow-hidden relative">
      <Helmet>
        <title>ProteinDojo - Learn Protein Design</title>
        <meta
          name="description"
          content="Learn to design proteins using AI. Practice on real druggable targets like Spike RBD, IL-6, and PD-L1 using cutting-edge tools like RFdiffusion."
        />
        <meta property="og:title" content="ProteinDojo - Learn Protein Design" />
        <meta
          property="og:description"
          content="Learn to design proteins. Practice on real druggable targets like Spike RBD, IL-6, and PD-L1 using cutting-edge tools like RFdiffusion."
        />
        <link rel="canonical" href="https://proteindojo.com" />
      </Helmet>

      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-radial from-blue-900/20 via-transparent to-transparent animate-pulse-slow" />
        <div className="absolute -bottom-1/2 -right-1/2 w-[200%] h-[200%] bg-gradient-radial from-emerald-900/15 via-transparent to-transparent animate-pulse-slower" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo mark */}
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 text-sm font-medium tracking-wide">
              Now in public beta
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
            Master the art of
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              protein design
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            Learn to build proteins with real druggable targets
            and industry-grade computational tools.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/challenges"
              className="group relative inline-flex items-center gap-2 bg-white text-slate-900 font-semibold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-white/10"
            >
              Start Designing
              <svg
                className="w-5 h-5 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            {!session?.user && (
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 text-slate-300 hover:text-white font-medium py-4 px-8 rounded-xl border border-slate-700 hover:border-slate-500 transition-all duration-300 hover:bg-slate-800/50"
              >
                Create Account
              </Link>
            )}
          </div>

          {/* Trust indicators */}
          <div className="mt-16 flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-slate-500 text-sm">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Free to start
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Real PDB targets
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              GPU-powered inference
            </span>
          </div>
        </div>
      </section>

      {/* Visual divider */}
      <div className="relative h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      {/* How it works */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            How it works
          </h2>
          <p className="text-slate-400 text-center mb-16 text-lg">
            From target to design in three steps
          </p>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="relative group">
              <div className="absolute -inset-px bg-gradient-to-b from-slate-700/50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-slate-900/50 border border-slate-800 rounded-2xl p-8 h-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-6">
                  <span className="text-blue-400 font-bold text-lg">1</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  Choose a target
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Pick from curated druggable targets like Spike RBD, IL-6, PD-L1, and TNF-α. Each comes with hotspot annotations and design hints.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative group">
              <div className="absolute -inset-px bg-gradient-to-b from-slate-700/50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-slate-900/50 border border-slate-800 rounded-2xl p-8 h-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mb-6">
                  <span className="text-emerald-400 font-bold text-lg">2</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  Design with AI
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Generate protein binders using RFdiffusion and validate structures with Boltz-2. Iterate on designs with instant 3D visualization.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative group">
              <div className="absolute -inset-px bg-gradient-to-b from-slate-700/50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-slate-900/50 border border-slate-800 rounded-2xl p-8 h-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-600/20 border border-teal-500/30 flex items-center justify-center mb-6">
                  <span className="text-teal-400 font-bold text-lg">3</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  Learn from feedback
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Get scored on ipSAE, pLDDT, and interface metrics. Compare against the leaderboard and refine your approach.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative py-24 px-4 bg-[#0a101f]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text content */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Built for learning,
                <br />
                <span className="text-slate-400">powered by real science</span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed mb-8">
                Practice protein design with the same tools and targets used in cutting-edge research.
                No simulations—real structure prediction on GPU infrastructure.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Interactive 3D viewer</h4>
                    <p className="text-slate-500 text-sm">Explore structures with Mol* visualization, highlighting interfaces and binding hotspots</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">State-of-the-art models</h4>
                    <p className="text-slate-500 text-sm">RFdiffusion for de novo design, Boltz-2 for structure prediction</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Meaningful metrics</h4>
                    <p className="text-slate-500 text-sm">Scored on ipSAE, pLDDT, pTM, and interface quality—metrics that matter for real-world success</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Interactive protein viewer */}
            <div className="relative">
              <div className="aspect-square overflow-hidden">
                <MolstarHero pdbId="6M0J" className="w-full h-full" />
              </div>
              <p className="text-center text-slate-400 text-sm mt-3">
                Target: Spike protein — Stop coronaviruses from hijacking human cells
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to start designing?
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Join the next generation of protein engineers. Start with beginner-friendly targets and work your way up.
          </p>
          <Link
            to="/challenges"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/20"
          >
            Browse Challenges
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 px-4 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <span>ProteinDojo</span>
          <div className="flex gap-6">
            <Link to="/help" className="hover:text-slate-300 transition-colors">Help</Link>
            <Link to="/challenges" className="hover:text-slate-300 transition-colors">Challenges</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
