/**
 * Header Component
 *
 * Site header with navigation and auth status.
 */

import { Link } from "react-router-dom";
import { useSession, signOut } from "../lib/auth";

export default function Header() {
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold text-white">
            VibeProteins
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              to="/challenges"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Challenges
            </Link>

            {isPending ? (
              <div className="w-20 h-8 bg-slate-700 rounded animate-pulse" />
            ) : session?.user ? (
              <div className="flex items-center gap-4">
                <Link
                  to="/jobs"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Jobs
                </Link>
                <span className="text-slate-300 text-sm">
                  {session.user.name || session.user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-slate-400 hover:text-white text-sm transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
