/**
 * Header Component
 *
 * Site header with navigation and auth status.
 * Responsive: shows hamburger menu on mobile.
 */

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSession } from "../lib/auth";
import { useCurrentUser } from "../lib/hooks";

export default function Header() {
  const { data: session, isPending } = useSession();
  const { data: user } = useCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold text-white">
            ProteinDojo
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/challenges"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Challenges
            </Link>
            <Link
              to="/leaderboards"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Leaderboards
            </Link>
            <Link
              to="/help"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Help
            </Link>
            {isHomePage && (
              <Link
                to="/blog"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Blog
              </Link>
            )}

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
                <Link
                  to="/dashboard"
                  className="text-slate-300 hover:text-white text-sm transition-colors"
                >
                  {user?.username || session.user.name || session.user.email}
                </Link>
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

          {/* Mobile: Sign Up button + hamburger */}
          <div className="flex md:hidden items-center gap-3">
            {!session?.user && (
              <Link
                to="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Sign Up
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-slate-700">
            <div className="flex flex-col gap-3">
              <Link
                to="/challenges"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-300 hover:text-white transition-colors py-2"
              >
                Challenges
              </Link>
              <Link
                to="/leaderboards"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-300 hover:text-white transition-colors py-2"
              >
                Leaderboards
              </Link>
              <Link
                to="/help"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-300 hover:text-white transition-colors py-2"
              >
                Help
              </Link>
              {isHomePage && (
                <Link
                  to="/blog"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-slate-300 hover:text-white transition-colors py-2"
                >
                  Blog
                </Link>
              )}

              {session?.user ? (
                <>
                  <div className="h-px bg-slate-700 my-2" />
                  <Link
                    to="/jobs"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-slate-300 hover:text-white transition-colors py-2"
                  >
                    Jobs
                  </Link>
                  <Link
                    to="/billing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors py-2"
                  >
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Balance: {user?.balanceFormatted ?? "$0.00"}
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-slate-300 hover:text-white transition-colors py-2"
                  >
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-700 my-2" />
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-slate-300 hover:text-white transition-colors py-2"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
