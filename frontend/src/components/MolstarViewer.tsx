/**
 * Mol* Viewer Component
 *
 * A React wrapper for the Mol* 3D molecular visualization library.
 * Uses the Viewer class for a simpler integration.
 */

import { useEffect, useRef, useState } from "react";
import { Viewer } from "molstar/lib/apps/viewer/app";

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
}

export default function MolstarViewer({
  pdbUrl,
  pdbId,
  highlightResidues: _highlightResidues,
  className = "",
}: MolstarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

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
          await loadStructure(viewer, pdbUrl, pdbId);
        }
      } catch (err) {
        console.error("Failed to initialize Mol*:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize viewer");
      }
    }

    init();

    return () => {
      viewer?.plugin.dispose();
      viewerRef.current = null;
    };
  }, []);

  // Reload structure when URL/ID changes
  useEffect(() => {
    if (!viewerRef.current || !initialized) return;
    if (!pdbUrl && !pdbId) return;

    loadStructure(viewerRef.current, pdbUrl, pdbId);
  }, [pdbUrl, pdbId, initialized]);

  async function loadStructure(
    viewer: Viewer,
    url?: string,
    id?: string
  ) {
    setIsLoading(true);
    setError(null);

    try {
      // Clear existing structures
      await viewer.plugin.clear();

      let structureUrl = url;

      // If PDB ID provided, construct RCSB URL
      if (id && !url) {
        structureUrl = `https://files.rcsb.org/download/${id}.pdb`;
      }

      if (!structureUrl) {
        throw new Error("No structure URL provided");
      }

      // Load the structure
      await viewer.loadStructureFromUrl(structureUrl, "pdb");

      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load structure:", err);
      setError(err instanceof Error ? err.message : "Failed to load structure");
      setIsLoading(false);
    }
  }

  // Determine what to show
  const hasStructure = pdbUrl || pdbId;

  return (
    <div className={`relative ${className}`} style={{ minHeight: "400px" }}>
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
    </div>
  );
}
