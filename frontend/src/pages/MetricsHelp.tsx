/**
 * Metrics Help Page
 *
 * Explains each binding metric used in protein design scoring.
 */

import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

interface MetricInfo {
  id: string;
  name: string;
  shortName: string;
  description: string;
  interpretation: string;
  thresholds: {
    good: string;
    moderate: string;
    poor: string;
  };
  examples?: string[];
  learnMore?: string;
}

const METRICS: MetricInfo[] = [
  {
    id: "ipsae",
    name: "Interface Predicted Structure-Aligned Energy (ipSAE)",
    shortName: "ipSAE",
    description:
      "ipSAE measures how confidently the AI predicts that two proteins will bind together. It's calculated from the PAE (Predicted Aligned Error) matrix, which shows how sure the model is about the relative positions of different parts of the structure.",
    interpretation:
      "Lower (more negative) values indicate stronger predicted binding. Think of it like a \"confidence score\" - if the AI is very confident about where your binder sits relative to the target, that suggests a stable interaction.",
    thresholds: {
      good: "< -0.7 (Strong predicted binding)",
      moderate: "-0.7 to -0.4 (Moderate interaction)",
      poor: "> -0.4 (Weak or uncertain binding)",
    },
    examples: [
      "ipSAE of -0.9: Excellent! The model is highly confident about the binding pose.",
      "ipSAE of -0.3: Uncertain binding - the model isn't sure how the proteins interact.",
    ],
    learnMore: "https://github.com/DunbrackLab/IPSAE",
  },
  {
    id: "pdockq",
    name: "Predicted DockQ Score (pDockQ)",
    shortName: "pDockQ",
    description:
      "pDockQ estimates the quality of a protein-protein docking pose. It was developed by analyzing thousands of protein complexes and correlates well with experimental binding data.",
    interpretation:
      "Higher values (0-1) indicate better predicted docking quality. A pDockQ > 0.5 suggests the interface is likely real and stable.",
    thresholds: {
      good: "> 0.5 (High-quality interface)",
      moderate: "0.23 to 0.5 (Possible interaction)",
      poor: "< 0.23 (Unlikely to be a true interface)",
    },
    examples: [
      "pDockQ of 0.7: Great! This interface looks solid.",
      "pDockQ of 0.15: The proteins might not actually bind this way.",
    ],
    learnMore: "https://www.nature.com/articles/s41467-022-28865-w",
  },
  {
    id: "iptm",
    name: "Interface predicted TM-score (ipTM)",
    shortName: "ipTM",
    description:
      "ipTM measures the predicted quality of the interface region specifically. It's derived from the overall pTM (predicted Template Modeling) score but focuses on the residues at the protein-protein interface.",
    interpretation:
      "Higher values (0-1) indicate the model is more confident about the interface structure. An ipTM > 0.7 suggests a reliable interface prediction.",
    thresholds: {
      good: "> 0.7 (Confident interface prediction)",
      moderate: "0.5 to 0.7 (Moderate confidence)",
      poor: "< 0.5 (Low confidence in interface)",
    },
    examples: [
      "ipTM of 0.8: The interface structure is well-predicted.",
      "ipTM of 0.4: Take these results with caution - the interface may not be accurate.",
    ],
  },
  {
    id: "plddt",
    name: "Predicted Local Distance Difference Test (pLDDT)",
    shortName: "pLDDT",
    description:
      "pLDDT is a per-residue confidence score (0-100) that indicates how confident the AI is about each amino acid's position. For complex predictions, this is averaged across the structure.",
    interpretation:
      "Higher values indicate more confident structure predictions. Scores above 90 are highly reliable; below 70 suggests disorder or uncertainty.",
    thresholds: {
      good: "> 90 (Very high confidence)",
      moderate: "70 to 90 (Confident prediction)",
      poor: "< 70 (Low confidence or disordered region)",
    },
    examples: [
      "pLDDT of 95: Excellent! The structure is very well-defined.",
      "pLDDT of 55: Parts of this structure might be flexible or incorrectly predicted.",
    ],
    learnMore: "https://alphafold.ebi.ac.uk/faq#faq-7",
  },
  {
    id: "lis",
    name: "Local Interaction Score (LIS)",
    shortName: "LIS",
    description:
      "LIS quantifies the quality of local interactions at the interface. It considers both the confidence of the prediction and the geometry of the contacts between the two proteins.",
    interpretation:
      "Higher values (0-1) indicate better local interactions. A high LIS means the atomic-level contacts look realistic and favorable.",
    thresholds: {
      good: "> 0.7 (Strong local interactions)",
      moderate: "0.4 to 0.7 (Moderate interactions)",
      poor: "< 0.4 (Weak local contacts)",
    },
  },
  {
    id: "n_interface_contacts",
    name: "Number of Interface Contacts",
    shortName: "Contacts",
    description:
      "The count of confident contacts (residue pairs with low PAE) between the binder and target. More contacts generally indicate a larger, more stable interface.",
    interpretation:
      "More contacts suggest a larger binding interface. However, quality matters more than quantity - a few strong contacts can be better than many weak ones.",
    thresholds: {
      good: "> 100 (Large interface)",
      moderate: "30 to 100 (Medium interface)",
      poor: "< 30 (Small or weak interface)",
    },
    examples: [
      "24372 contacts: Very large interface! (Note: this might include all PAE pairs, not just strong contacts)",
      "50 contacts: A reasonable interface size for a small binder.",
    ],
  },
];

function MetricCard({ metric }: { metric: MetricInfo }) {
  return (
    <div id={metric.id} className="bg-slate-800 rounded-xl p-6 scroll-mt-24">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{metric.shortName}</h2>
          <p className="text-sm text-slate-400">{metric.name}</p>
        </div>
        {metric.learnMore && (
          <a
            href={metric.learnMore}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            Paper
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">What is it?</h3>
          <p className="text-slate-400 text-sm">{metric.description}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">How to interpret</h3>
          <p className="text-slate-400 text-sm">{metric.interpretation}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">Score ranges</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-400"></span>
              <span className="text-green-400 text-sm">{metric.thresholds.good}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
              <span className="text-yellow-400 text-sm">{metric.thresholds.moderate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400"></span>
              <span className="text-red-400 text-sm">{metric.thresholds.poor}</span>
            </div>
          </div>
        </div>

        {metric.examples && metric.examples.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Examples</h3>
            <ul className="space-y-1">
              {metric.examples.map((example, index) => (
                <li key={index} className="text-slate-400 text-sm pl-4 border-l-2 border-slate-600">
                  {example}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MetricsHelp() {
  const location = useLocation();
  const hasScrolled = useRef(false);

  // Scroll to specific metric if hash is present
  useEffect(() => {
    if (location.hash && !hasScrolled.current) {
      const id = location.hash.slice(1);
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        hasScrolled.current = true;
      }
    }
  }, [location.hash]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Helmet>
        <title>Binding Metrics Guide | VibeProteins</title>
        <meta name="description" content="Learn how to interpret protein binding metrics like ipSAE, pDockQ, ipTM, pLDDT, and more." />
      </Helmet>

      <div className="mb-6">
        <Link to="/jobs" className="text-blue-400 hover:text-blue-300">
          &larr; Back to Jobs
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Understanding Binding Metrics</h1>
        <p className="text-slate-400">
          When you run a protein design job, we calculate several metrics to help you evaluate how well your
          designed binder might work. Here's what each metric means and how to interpret the scores.
        </p>
      </div>

      {/* Quick reference */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-8">
        <h2 className="text-sm font-medium text-slate-300 mb-3">Quick Reference</h2>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((metric) => (
            <a
              key={metric.id}
              href={`#${metric.id}`}
              className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-full transition-colors"
            >
              {metric.shortName}
            </a>
          ))}
        </div>
      </div>

      {/* Color legend */}
      <div className="bg-gradient-to-r from-green-500/10 via-yellow-500/10 to-red-500/10 border border-slate-700 rounded-xl p-4 mb-8">
        <h2 className="text-sm font-medium text-slate-300 mb-2">Color Guide</h2>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-green-400">Green</span>
            <span className="text-slate-400">= Good (proceed with confidence)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">Yellow</span>
            <span className="text-slate-400">= Moderate (might work, worth trying)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-400">Red</span>
            <span className="text-slate-400">= Needs improvement (consider redesigning)</span>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="space-y-6">
        {METRICS.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      {/* Tips section */}
      <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-blue-400 mb-3">Tips for Beginners</h2>
        <ul className="space-y-2 text-slate-300 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-blue-400">1.</span>
            <span>Don't focus on just one metric - look at the overall picture. A design with moderate scores across all metrics is often better than one with one great score and several poor ones.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">2.</span>
            <span>pLDDT tells you about structure confidence, while ipSAE and pDockQ tell you about binding confidence. You need both to be good!</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">3.</span>
            <span>These are predictions, not experimental results. Even a design with perfect scores should be tested in the lab.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">4.</span>
            <span>If your scores are poor, try running more designs or adjusting your hotspot selection. Each run generates different candidates.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
