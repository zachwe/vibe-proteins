/**
 * Design Tools Help Page
 *
 * Guide to using the protein design tools: RFDiffusion3, ProteinMPNN, Boltz-2.
 */

import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

interface ToolInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  whenToUse: string[];
  inputs: string[];
  outputs: string[];
  tips: string[];
  cost: string;
  time: string;
  detailPage?: string;
  color: string;
}

const TOOLS: ToolInfo[] = [
  {
    id: "rfdiffusion3",
    name: "RFDiffusion3",
    tagline: "De novo binder design",
    description:
      "RFDiffusion3 is the latest version of the RFDiffusion model, which uses diffusion-based generative AI to design protein backbones from scratch. It's particularly good at designing binders that attach to specific regions of a target protein.",
    whenToUse: [
      "You want to design a new protein binder from scratch",
      "You have a specific target site (hotspot) in mind",
      "You're starting a new design project",
    ],
    inputs: [
      "Target protein structure (PDB)",
      "Optional: Hotspot residues to target",
      "Optional: Binder length constraints",
    ],
    outputs: [
      "Multiple backbone designs (typically 4-8)",
      "Each backbone is then sequenced with ProteinMPNN",
      "Final structures validated with Boltz-2",
    ],
    tips: [
      "Select a hotspot for more targeted designs",
      "The recommended hotspots are expert-curated for each challenge",
      "Run multiple times to explore different design solutions",
    ],
    cost: "$0.50-2.00",
    time: "2-5 minutes",
    detailPage: "/help/design/rfdiffusion",
    color: "blue",
  },
  {
    id: "bindcraft",
    name: "BindCraft",
    tagline: "AlphaFold2-based binder design",
    description:
      "BindCraft uses AlphaFold2 backpropagation to optimize binder sequences, combined with ProteinMPNN and PyRosetta for comprehensive design and validation. It's particularly good for high-confidence designs with physics-based filtering.",
    whenToUse: [
      "You want designs validated by physics-based scoring",
      "You're targeting hydrophobic binding interfaces",
      "You need high-confidence binder predictions",
    ],
    inputs: [
      "Target protein structure (PDB)",
      "Hotspot residues (recommended)",
      "Binder length range",
    ],
    outputs: [
      "Designed binder-target complexes",
      "Rosetta-relaxed structures",
      "Comprehensive scoring (pLDDT, PAE, interface metrics)",
    ],
    tips: [
      "Works better for hydrophobic interfaces",
      "Generate at least 100 final designs",
      "Interface pTM is a good binary predictor of binding",
    ],
    cost: "$1.00-5.00",
    time: "10-30 minutes",
    detailPage: "/help/design/bindcraft",
    color: "amber",
  },
  {
    id: "boltzgen",
    name: "BoltzGen",
    tagline: "Boltz-2 powered binder generation",
    description:
      "BoltzGen uses diffusion models built on Boltz-2 to generate diverse protein binders. It supports multiple protocols including protein, peptide, nanobody, and antibody design, with built-in quality vs diversity optimization.",
    whenToUse: [
      "You need diverse candidate exploration",
      "You're designing nanobodies or antibodies",
      "You want to bind small molecules",
    ],
    inputs: [
      "Target specification (YAML)",
      "Number of designs to generate",
      "Protocol (protein/peptide/nanobody/antibody)",
    ],
    outputs: [
      "Ranked binder candidates",
      "Diversity-optimized design sets",
      "Quality metrics and visual reports",
    ],
    tips: [
      "Generate 10,000-60,000 designs for best results",
      "Use alpha ~0.3-0.5 for quality-diversity balance",
      "Choose protocol matching your binder type",
    ],
    cost: "$0.50-3.00",
    time: "5-20 minutes",
    detailPage: "/help/design/boltzgen",
    color: "emerald",
  },
  {
    id: "proteinmpnn",
    name: "ProteinMPNN",
    tagline: "Sequence design for backbones",
    description:
      "ProteinMPNN is a neural network that designs amino acid sequences for a given protein backbone structure. It predicts which amino acids should go at each position to make the structure stable and functional.",
    whenToUse: [
      "You have a backbone structure and need a sequence",
      "You want to optimize an existing protein's sequence",
      "You're using it as part of the RFDiffusion3 pipeline",
    ],
    inputs: [
      "Protein backbone structure (coordinates)",
      "Optional: Fixed residues to keep unchanged",
      "Optional: Sequence constraints",
    ],
    outputs: [
      "Multiple sequence designs per backbone",
      "Confidence scores for each position",
      "Ready for structure prediction validation",
    ],
    tips: [
      "Usually runs automatically after RFDiffusion3",
      "Higher temperatures = more sequence diversity",
      "Can be run standalone for sequence optimization",
    ],
    cost: "$0.05-0.20",
    time: "15s-1 minute",
    color: "purple",
  },
  {
    id: "boltz2",
    name: "Boltz-2",
    tagline: "Structure prediction & validation",
    description:
      "Boltz-2 is a fast structure prediction model that predicts how a protein sequence will fold. It's used to validate designs by checking if the designed sequence actually folds into the intended structure and binds to the target.",
    whenToUse: [
      "Validating a designed binder sequence",
      "Checking if your binder will fold correctly",
      "Getting confidence scores for binding",
    ],
    inputs: [
      "Binder sequence (amino acids)",
      "Target sequence (amino acids)",
      "Target structure (optional, for reference)",
    ],
    outputs: [
      "Predicted complex structure",
      "Confidence metrics (pLDDT, pTM, ipTM)",
      "Binding quality scores (ipSAE, pDockQ)",
    ],
    tips: [
      "Automatically runs after ProteinMPNN in the pipeline",
      "Check ipSAE and pDockQ for binding confidence",
      "Low pLDDT regions indicate uncertainty",
    ],
    cost: "$0.10-0.50",
    time: "30s-2 minutes",
    color: "green",
  },
];

interface ConceptInfo {
  id: string;
  name: string;
  description: string;
  details: string;
  example?: string;
}

const CONCEPTS: ConceptInfo[] = [
  {
    id: "hotspots",
    name: "Hotspots",
    description:
      "Hotspots are specific residues on the target protein where you want your binder to attach. Think of them like \"bullseyes\" - the design algorithm will create a protein that sticks to these exact residues.",
    details:
      "Selecting a hotspot makes your design more targeted and often leads to stronger binding. Hotspot residues are shown in the format \"Chain:ResidueNumber\" (e.g., E:417 means chain E, residue 417). The recommended hotspots for each challenge are expert-curated based on known binding sites or functional regions.",
    example:
      "For the Spike RBD challenge, hotspots E:417, E:453, E:484, E:493, E:498, E:500, E:501, E:502, E:505 target the ACE2 receptor binding interface.",
  },
  {
    id: "chains",
    name: "Chains",
    description:
      "Proteins in PDB structures are organized into chains, labeled with letters (A, B, C, etc.). Each chain represents a separate polypeptide molecule in the structure.",
    details:
      "When viewing a structure, the target chain is highlighted in blue, context chains (like binding partners) in green. Understanding which chain is your target helps you select appropriate hotspots and interpret results.",
    example:
      "In PDB 6M0J (Spike-ACE2 complex): Chain E is the Spike RBD (target), Chain A is ACE2 (context/binding partner).",
  },
  {
    id: "residues",
    name: "Residues",
    description:
      "Residues are individual amino acids in a protein chain. Each residue has a number based on its position in the sequence.",
    details:
      "Residue numbering in PDB files often doesn't start at 1 - it usually matches the numbering in the UniProt reference sequence. This is because PDB structures often contain only a fragment (like a single domain) of the full protein. When selecting hotspots, use the residue numbers shown in the viewer.",
    example:
      "The Spike RBD in PDB 6M0J uses residue numbers 319-541, matching the UniProt sequence (P0DTC2), even though the structure only contains ~220 amino acids.",
  },
];

const colorClasses: Record<string, { tagline: string; bullet: string }> = {
  blue: { tagline: "text-blue-400", bullet: "text-blue-400" },
  amber: { tagline: "text-amber-400", bullet: "text-amber-400" },
  emerald: { tagline: "text-emerald-400", bullet: "text-emerald-400" },
  purple: { tagline: "text-purple-400", bullet: "text-purple-400" },
  green: { tagline: "text-green-400", bullet: "text-green-400" },
};

function ToolCard({ tool }: { tool: ToolInfo }) {
  const colors = colorClasses[tool.color] || colorClasses.blue;

  return (
    <div id={tool.id} className="bg-slate-800 rounded-xl p-6 scroll-mt-24">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{tool.name}</h2>
          <p className={`text-sm ${colors.tagline}`}>{tool.tagline}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>{tool.cost}</p>
          <p>{tool.time}</p>
        </div>
      </div>

      <p className="text-slate-300 text-sm mb-4">{tool.description}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">When to use</h3>
          <ul className="space-y-1">
            {tool.whenToUse.map((item, i) => (
              <li key={i} className="text-slate-400 text-sm flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">Tips</h3>
          <ul className="space-y-1">
            {tool.tips.map((tip, i) => (
              <li key={i} className="text-slate-400 text-sm flex items-start gap-2">
                <span className={`${colors.bullet} mt-0.5`}>•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase mb-1">Inputs</h3>
            <ul className="text-slate-400 text-xs space-y-0.5">
              {tool.inputs.map((input, i) => (
                <li key={i}>{input}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase mb-1">Outputs</h3>
            <ul className="text-slate-400 text-xs space-y-0.5">
              {tool.outputs.map((output, i) => (
                <li key={i}>{output}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {tool.detailPage && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <Link
            to={tool.detailPage}
            className={`text-sm ${colors.tagline} hover:underline flex items-center gap-1`}
          >
            Read full guide
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

function ConceptCard({ concept }: { concept: ConceptInfo }) {
  return (
    <div id={concept.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 scroll-mt-24">
      <h3 className="text-lg font-semibold text-white mb-2">{concept.name}</h3>
      <p className="text-slate-300 text-sm mb-3">{concept.description}</p>
      <p className="text-slate-400 text-sm">{concept.details}</p>
      {concept.example && (
        <div className="mt-3 bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase mb-1">Example</p>
          <p className="text-slate-300 text-sm">{concept.example}</p>
        </div>
      )}
    </div>
  );
}

export default function DesignHelp() {
  const location = useLocation();
  const hasScrolled = useRef(false);

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
        <title>Design Tools Guide | VibeProteins</title>
        <meta name="description" content="Learn how to use RFDiffusion3, ProteinMPNN, and Boltz-2 for protein binder design." />
      </Helmet>

      <div className="mb-6">
        <Link to="/help" className="text-blue-400 hover:text-blue-300">
          &larr; Back to Help
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Design Tools Guide</h1>
        <p className="text-slate-400">
          VibeProteins uses state-of-the-art AI models to design protein binders.
          Here's how each tool works and when to use them.
        </p>
      </div>

      {/* Quick navigation */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-8">
        <h2 className="text-sm font-medium text-slate-300 mb-3">Jump to</h2>
        <div className="flex flex-wrap gap-2">
          {TOOLS.map((tool) => (
            <a
              key={tool.id}
              href={`#${tool.id}`}
              className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-full transition-colors"
            >
              {tool.name}
            </a>
          ))}
          <span className="text-slate-600">|</span>
          {CONCEPTS.map((concept) => (
            <a
              key={concept.id}
              href={`#${concept.id}`}
              className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-full transition-colors"
            >
              {concept.name}
            </a>
          ))}
        </div>
      </div>

      {/* Pipeline overview */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-blue-400 mb-3">The Design Pipeline</h2>
        <p className="text-slate-300 text-sm mb-4">
          When you run RFDiffusion3, it automatically chains together all three tools:
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-lg font-medium">
            1. RFDiffusion3
          </span>
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-lg font-medium">
            2. ProteinMPNN
          </span>
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded-lg font-medium">
            3. Boltz-2
          </span>
        </div>
        <p className="text-slate-400 text-xs mt-3">
          Backbone design → Sequence design → Structure validation
        </p>
      </div>

      {/* Tool cards */}
      <div className="space-y-6 mb-12">
        <h2 className="text-xl font-semibold text-white">Tools</h2>
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

      {/* Concepts */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-white">Key Concepts</h2>
        {CONCEPTS.map((concept) => (
          <ConceptCard key={concept.id} concept={concept} />
        ))}
      </div>

      {/* Next steps */}
      <div className="mt-8 bg-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">Next Steps</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/help/metrics"
            className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg transition-colors"
          >
            Learn about Metrics →
          </Link>
          <Link
            to="/challenges"
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Start a Challenge →
          </Link>
        </div>
      </div>
    </div>
  );
}
