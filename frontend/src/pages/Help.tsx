/**
 * Help Index Page
 *
 * Table of contents for all help documentation.
 */

import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

interface HelpSection {
  title: string;
  description: string;
  link: string;
  icon: string;
  topics: string[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Design Tools",
    description: "Learn how to use the protein design tools available on ProteinDojo.",
    link: "/help/design",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    topics: ["RFDiffusion3", "ProteinMPNN", "Boltz-2", "Hotspots", "Target selection"],
  },
  {
    title: "Binding Metrics",
    description: "Understand the scores and metrics used to evaluate your protein designs.",
    link: "/help/metrics",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    topics: ["ipSAE", "pDockQ", "ipTM", "pLDDT", "Interface contacts"],
  },
];

export default function Help() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Helmet>
        <title>Help Center | ProteinDojo</title>
        <meta name="description" content="Learn how to use ProteinDojo for protein design, understand metrics, and get the most out of the platform." />
      </Helmet>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Help Center</h1>
        <p className="text-slate-400">
          Everything you need to know about designing proteins with ProteinDojo.
          New to protein design? Start with the Design Tools guide.
        </p>
      </div>

      {/* Help sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {HELP_SECTIONS.map((section) => (
          <Link
            key={section.link}
            to={section.link}
            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-xl p-6 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={section.icon} />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                  {section.title}
                </h2>
                <p className="text-slate-400 text-sm mb-3">{section.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {section.topics.map((topic) => (
                    <span
                      key={topic}
                      className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Links</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/challenges"
            className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Browse Challenges
          </Link>
          <Link
            to="/jobs"
            className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View Your Jobs
          </Link>
          <Link
            to="/billing"
            className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Billing & Credits
          </Link>
          <a
            href="https://github.com/anthropics/claude-code/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Report an Issue
          </a>
        </div>
      </div>

      {/* Getting started */}
      <div className="mt-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-blue-400 mb-2">New to Protein Design?</h2>
        <p className="text-slate-300 text-sm mb-4">
          Start with a Level 1 challenge like BDNF - it's beginner-friendly and includes
          detailed guidance. The platform will walk you through the entire design process.
        </p>
        <Link
          to="/challenges/bdnf"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Try BDNF Challenge
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
