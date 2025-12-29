/**
 * Mol* Viewer Component
 *
 * A React wrapper for the Mol* 3D molecular visualization library.
 * Uses the Viewer class for a simpler integration.
 */

import { useEffect, useRef, useState } from "react";
import { Viewer } from "molstar/lib/apps/viewer/app";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import {
  StructureSelectionQueries,
  StructureSelectionQuery,
} from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";
import { Color } from "molstar/lib/mol-util/color";

// Import Mol* styles
import "molstar/lib/mol-plugin-ui/skin/light.scss";

interface MolstarViewerProps {
  /** URL to a PDB file */
  pdbUrl?: string;
  /** PDB ID to load from RCSB (e.g., "6M0J") */
  pdbId?: string;
  /** Residues to highlight (e.g., ["A:417", "A:453"]) */
  highlightResidues?: string[];
  /** CSS class for the container */
  className?: string;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Chain coloring groups */
  chainColors?: {
    target?: string[];
    binder?: string[];
  };
  /** Enable auto-spin animation */
  autoSpin?: boolean;
}

export default function MolstarViewer({
  pdbUrl,
  pdbId,
  highlightResidues: _highlightResidues,
  className = "",
  minHeight = 400,
  chainColors,
  autoSpin = true,
}: MolstarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const loadCounterRef = useRef(0);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isSpinning, setIsSpinning] = useState(autoSpin);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: Viewer | null = null;

    async function init() {
      if (!containerRef.current) return;

      try {
        // Create viewer
        viewer = await Viewer.create(containerRef.current, {
          layoutIsExpanded: false,
          layoutShowControls: false,
          layoutShowRemoteState: false,
          layoutShowSequence: false,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          viewportShowExpand: false,
          viewportShowSelectionMode: false,
          viewportShowAnimation: false,
        });

        viewerRef.current = viewer;
        setInitialized(true);

        // Load structure if URL or ID provided
        if (pdbUrl || pdbId) {
          await loadStructure(viewer, pdbUrl, pdbId, chainColors);
        }
      } catch (err) {
        console.error("Failed to initialize Mol*:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize viewer");
      }
    }

    init();

    return () => {
      loadCounterRef.current += 1;
      viewer?.plugin.dispose();
      viewerRef.current = null;
    };
  }, []);

  // Reload structure when URL/ID changes
  useEffect(() => {
    if (!viewerRef.current || !initialized) return;
    if (!pdbUrl && !pdbId) return;

    loadStructure(viewerRef.current, pdbUrl, pdbId, chainColors);
  }, [pdbUrl, pdbId, initialized]);

  useEffect(() => {
    if (!viewerRef.current || !initialized) return;
    if (!chainColors?.target?.length && !chainColors?.binder?.length) return;
    applyChainColors(viewerRef.current, chainColors);
  }, [chainColors, initialized]);

  // Handle auto-spin
  useEffect(() => {
    if (!viewerRef.current || !initialized) return;

    if (isSpinning) {
      // Start spinning - rotate the camera around Y axis
      spinIntervalRef.current = setInterval(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        try {
          const canvas = viewer.plugin.canvas3d;
          if (canvas) {
            const snapshot = canvas.camera.getSnapshot();
            // Rotate around Y axis by 1 degree
            const angle = Math.PI / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = snapshot.position[0];
            const z = snapshot.position[2];
            snapshot.position[0] = x * cos - z * sin;
            snapshot.position[2] = x * sin + z * cos;
            canvas.camera.setState({ ...snapshot }, 0);
          }
        } catch {
          // Ignore errors during rotation
        }
      }, 50); // ~20fps rotation
    } else {
      // Stop spinning
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
    }

    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
    };
  }, [isSpinning, initialized]);

  async function loadStructure(
    viewer: Viewer,
    url?: string,
    id?: string,
    colors?: MolstarViewerProps["chainColors"]
  ) {
    const loadId = ++loadCounterRef.current;
    if (viewerRef.current !== viewer) return;
    setIsLoading(true);
    setError(null);

    try {
      // Clear existing structures
      await viewer.plugin.clear();
      if (loadId !== loadCounterRef.current) return;
      if (viewerRef.current !== viewer) return;

      let structureUrl = url;

      // If PDB ID provided, construct RCSB URL
      if (id && !url) {
        structureUrl = `https://files.rcsb.org/download/${id}.pdb`;
      }

      if (!structureUrl) {
        throw new Error("No structure URL provided");
      }

      const { format, isBinary } = inferStructureFormat(structureUrl);

      // Load the structure
      await viewer.loadStructureFromUrl(structureUrl, format, isBinary);
      if (loadId !== loadCounterRef.current) return;
      if (viewerRef.current !== viewer) return;

      await applyChainColors(viewer, colors);

      setIsLoading(false);
    } catch (err) {
      if (loadId !== loadCounterRef.current || viewerRef.current !== viewer) {
        return;
      }
      console.error("Failed to load structure:", err);
      setError(err instanceof Error ? err.message : "Failed to load structure");
      setIsLoading(false);
    }
  }

  // Determine what to show
  const hasStructure = pdbUrl || pdbId;

  return (
    <div className={`relative ${className}`} style={{ minHeight: `${minHeight}px` }}>
      {/* Mol* container */}
      <div
        ref={containerRef}
        className="w-full h-full absolute inset-0"
        style={{ position: "relative" }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-slate-300">Loading structure...</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
          <div className="text-center p-4">
            <p className="text-red-400 mb-2">Failed to load structure</p>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* No structure placeholder */}
      {!hasStructure && !isLoading && !error && (
        <div className="absolute inset-0 bg-slate-700 flex items-center justify-center z-10">
          <p className="text-slate-400">No structure available</p>
        </div>
      )}

      {/* Spin toggle button */}
      {hasStructure && initialized && (
        <button
          onClick={() => setIsSpinning(!isSpinning)}
          className={`absolute top-3 left-3 p-2 rounded-lg transition-colors z-10 ${
            isSpinning
              ? "bg-blue-600 text-white"
              : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80"
          }`}
          title={isSpinning ? "Stop spinning" : "Start spinning"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

const TARGET_COLOR = Color(0x60a5fa);
const BINDER_COLOR = Color(0xfcd34d);

function inferStructureFormat(url: string): { format: "pdb" | "mmcif" | "bcif"; isBinary: boolean } {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // Keep raw url if parsing fails.
  }
  const lower = pathname.toLowerCase();
  const isGz = lower.endsWith(".gz");
  const base = isGz ? lower.slice(0, -3) : lower;

  if (base.endsWith(".bcif")) {
    return { format: "bcif", isBinary: true };
  }
  if (base.endsWith(".cif") || base.endsWith(".mmcif")) {
    return { format: "mmcif", isBinary: isGz };
  }
  return { format: "pdb", isBinary: isGz };
}

function buildChainQuery(label: string, chainIds: string[]) {
  const cleaned = chainIds.map((chain) => chain.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  const chainTest = MS.core.logic.or([
    MS.core.set.has([MS.set(...cleaned), MS.ammp("auth_asym_id")]),
    MS.core.set.has([MS.set(...cleaned), MS.ammp("label_asym_id")]),
  ]);
  const expression = MS.struct.generator.atomGroups({
    "chain-test": chainTest,
  });
  return StructureSelectionQuery(label, expression);
}

async function applyChainColors(
  viewer: Viewer,
  chainColors?: MolstarViewerProps["chainColors"]
) {
  if (!chainColors) return;
  const hasTargets = (chainColors.target?.length ?? 0) > 0;
  const hasBinders = (chainColors.binder?.length ?? 0) > 0;
  if (!hasTargets && !hasBinders) return;

  const manager = viewer.plugin.managers.structure.component;
  const structures = viewer.plugin.managers.structure.hierarchy.current.structures;
  if (!structures.length) return;

  try {
    await manager.applyTheme(
      {
        selection: StructureSelectionQueries.all,
        action: { name: "resetColor", params: {} },
        representations: [],
      },
      structures
    );
  } catch (error) {
    console.warn("Unable to reset Mol* colors:", error);
    return;
  }

  if (hasTargets) {
    const query = buildChainQuery("Target Chains", chainColors.target || []);
    if (query) {
      try {
        await manager.applyTheme(
          {
            selection: query,
            action: { name: "color", params: { color: TARGET_COLOR } },
            representations: [],
          },
          structures
        );
      } catch (error) {
        console.warn("Unable to apply target chain colors:", error);
      }
    }
  }

  if (hasBinders) {
    const query = buildChainQuery("Binder Chains", chainColors.binder || []);
    if (query) {
      try {
        await manager.applyTheme(
          {
            selection: query,
            action: { name: "color", params: { color: BINDER_COLOR } },
            representations: [],
          },
          structures
        );
      } catch (error) {
        console.warn("Unable to apply binder chain colors:", error);
      }
    }
  }
}
