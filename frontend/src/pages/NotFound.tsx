import { Link } from "react-router-dom";

function AbstractShapes() {
  return (
    <div className="relative w-48 h-48 sm:w-56 sm:h-56">
      {/* Large ring */}
      <div className="absolute inset-4 rounded-full border-2 border-blue-400/30 animate-float" />

      {/* Offset ring */}
      <div className="absolute inset-8 left-12 top-6 w-32 h-32 rounded-full border-2 border-emerald-400/25 animate-float-delayed" />

      {/* Solid circles */}
      <div className="absolute top-6 left-6 w-4 h-4 rounded-full bg-blue-400/60 animate-pulse-slow" />
      <div className="absolute bottom-10 right-8 w-3 h-3 rounded-full bg-emerald-400/50 animate-pulse-slower" />
      <div className="absolute top-1/2 right-4 w-2 h-2 rounded-full bg-teal-400/40 animate-pulse-slow" />

      {/* Gradient blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-blue-400/20 via-emerald-400/20 to-teal-400/20 blur-sm animate-float-slow" />
    </div>
  );
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-blue-900/20 via-transparent to-transparent animate-pulse-slow" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-emerald-900/15 via-transparent to-transparent animate-pulse-slower" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
      </div>

      <section className="relative flex min-h-screen items-center justify-center px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* Abstract shapes */}
          <div className="flex justify-center mb-8 animate-rise">
            <AbstractShapes />
          </div>

          {/* Error code */}
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm animate-rise">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400 text-sm font-medium tracking-wide">
              Error 404
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight animate-rise-delay">
            This sequence
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              didn't fold right
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-slate-400 mb-10 max-w-md mx-auto leading-relaxed animate-rise-delay">
            The page you're looking for has misfolded into the void.
            Let's get you back to stable ground.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-rise-delay-2">
            <Link
              to="/"
              className="group relative inline-flex items-center gap-2 bg-white text-slate-900 font-semibold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-white/10"
            >
              Back to home
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/challenges"
              className="inline-flex items-center gap-2 text-slate-300 hover:text-white font-medium py-3 px-6 rounded-xl border border-slate-700 hover:border-slate-500 transition-all duration-300 hover:bg-slate-800/50"
            >
              Browse challenges
            </Link>
          </div>

          {/* Help link */}
          <p className="mt-10 text-sm text-slate-500 animate-rise-delay-2">
            Think this is a bug?{" "}
            <Link to="/help" className="text-slate-400 hover:text-white underline underline-offset-4 transition-colors">
              Contact support
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
