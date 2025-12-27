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
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" clipRule="evenodd" />
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
