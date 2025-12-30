/**
 * Header Component
 *
 * Site header with navigation and auth status.
 */

import { Link } from "react-router-dom";
import { useSession, signOut } from "../lib/auth";
import { useCurrentUser } from "../lib/hooks";

export default function Header() {
  const { data: session, isPending } = useSession();
  const { data: user } = useCurrentUser();

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
            <Link
              to="/help"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Help
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
                <Link
                  to="/billing"
                  className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span className="text-white font-medium">
                    {user?.balanceFormatted ?? "$0.00"}
                  </span>
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
