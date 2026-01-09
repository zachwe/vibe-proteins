/**
 * Mol* Viewer Component
 *
 * A React wrapper for the Mol* 3D molecular visualization library.
 * Uses the Viewer class for a simpler integration.
 */

import { useEffect, useRef, useState } from "react";
import { Viewer } from "molstar/lib/apps/viewer/app";
import { PluginConfig } from "molstar/lib/mol-plugin/config";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import {
  StructureSelectionQueries,
  StructureSelectionQuery,
} from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";
import { Color } from "molstar/lib/mol-util/color";

// Import Mol* styles
import "molstar/lib/mol-plugin-ui/skin/light.scss";

/**
 * Convert RCSB PDB URLs to PDBe mirror URLs.
 * Used as fallback when RCSB fails (e.g., SSL cert issues).
 *
 * RCSB: https://files.rcsb.org/download/1VPF.pdb
 * PDBe: https://www.ebi.ac.uk/pdbe/entry-files/download/pdb1vpf.ent
 */
function convertToPDBeMirror(url: string): string | null {
  const rcsbMatch = url.match(/files\.rcsb\.org\/download\/(\w+)\.pdb/i);
  if (rcsbMatch) {
    const pdbId = rcsbMatch[1].toLowerCase();
    return `https://www.ebi.ac.uk/pdbe/entry-files/download/pdb${pdbId}.ent`;
  }
  return null;
}

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
    context?: string[];
  };
  /** Enable auto-spin animation */
  autoSpin?: boolean;
  /** Hide water molecules and ions by default */
  hideNonPolymers?: boolean;
}

export default function MolstarViewer({
  pdbUrl,
  pdbId,
  highlightResidues,
  className = "",
  minHeight = 400,
  chainColors,
  autoSpin = true,
  hideNonPolymers = true,
}: MolstarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const loadCounterRef = useRef(0);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isSpinning, setIsSpinning] = useState(autoSpin);
  const [showWaters, setShowWaters] = useState(!hideNonPolymers);
  const [showChainPanel, setShowChainPanel] = useState(false);
  const [availableChains, setAvailableChains] = useState<string[]>([]);
  const [chainVisibility, setChainVisibility] = useState<Record<string, boolean>>({});

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
          viewportShowControls: true,
          viewportShowSelectionMode: true,
          viewportShowToggleFullscreen: false,
          viewportShowAnimation: false,
          viewportShowSettings: false,
          config: [
            [PluginConfig.Viewport.ShowXR, "never"],
            [PluginConfig.Viewport.ShowIllumination, false],
            [PluginConfig.Viewport.ShowScreenshotControls, false],
          ],
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

  // Handle hotspot residue highlighting
  useEffect(() => {
    if (!viewerRef.current || !initialized) return;

    const viewer = viewerRef.current;

    if (highlightResidues && highlightResidues.length > 0) {
      // First re-apply chain colors (resets colors), then highlight residues on top
      applyChainColors(viewer, chainColors).then(() => {
        applyResidueHighlight(viewer, highlightResidues);
      });
    } else {
      // Clear highlights by just re-applying chain colors
      clearResidueHighlight(viewer, chainColors);
    }
  }, [highlightResidues, chainColors, initialized]);

  // Handle water/ion visibility
  useEffect(() => {
    if (!viewerRef.current || !initialized || isLoading) return;
    setWaterVisibility(viewerRef.current, showWaters);
  }, [showWaters, initialized, isLoading]);

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

      // Try to load the structure, fall back to PDBe mirror if RCSB fails
      try {
        await viewer.loadStructureFromUrl(structureUrl, format, isBinary);
      } catch (primaryError) {
        const mirrorUrl = convertToPDBeMirror(structureUrl);
        if (mirrorUrl) {
          console.warn(`Primary source failed, trying PDBe mirror: ${mirrorUrl}`);
          const mirrorFormat = inferStructureFormat(mirrorUrl);
          await viewer.loadStructureFromUrl(mirrorUrl, mirrorFormat.format, mirrorFormat.isBinary);
        } else {
          throw primaryError;
        }
      }
      if (loadId !== loadCounterRef.current) return;
      if (viewerRef.current !== viewer) return;

      await applyChainColors(viewer, colors);

      // Extract available chains from the structure
      const chains = extractChains(viewer);
      setAvailableChains(chains);
      // Initialize all chains as visible
      const visibility: Record<string, boolean> = {};
      chains.forEach(chain => { visibility[chain] = true; });
      setChainVisibility(visibility);

      // Hide waters/ions if requested (use current state from component)
      // This will be handled by the effect below

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

      {/* Control buttons */}
      {hasStructure && initialized && (
        <div className="absolute top-3 left-3 flex gap-1 z-10">
          {/* Spin toggle */}
          <button
            onClick={() => setIsSpinning(!isSpinning)}
            className={`p-2 rounded-lg transition-colors ${
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

          {/* Water/ion visibility toggle */}
          <button
            onClick={() => setShowWaters(!showWaters)}
            className={`p-2 rounded-lg transition-colors ${
              showWaters
                ? "bg-blue-600 text-white"
                : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80"
            }`}
            title={showWaters ? "Hide water molecules" : "Show water molecules"}
          >
            {/* Water droplet icon */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" />
            </svg>
          </button>

          {/* Chain visibility toggle */}
          {availableChains.length > 1 && (
            <button
              onClick={() => setShowChainPanel(!showChainPanel)}
              className={`p-2 rounded-lg transition-colors ${
                showChainPanel
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80"
              }`}
              title="Toggle chain visibility panel"
            >
              {/* Layers/chains icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Chain visibility panel */}
      {hasStructure && initialized && showChainPanel && availableChains.length > 1 && (
        <div className="absolute top-14 left-3 bg-slate-800/95 rounded-lg p-3 z-10 min-w-[140px] shadow-lg">
          <p className="text-xs font-medium text-slate-300 mb-2">Chains</p>
          <div className="space-y-1.5">
            {availableChains.map((chainId) => (
              <label
                key={chainId}
                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-700/50 rounded px-1.5 py-1 -mx-1.5"
              >
                <input
                  type="checkbox"
                  checked={chainVisibility[chainId] ?? true}
                  onChange={() => {
                    const newVisibility = !chainVisibility[chainId];
                    setChainVisibility(prev => ({ ...prev, [chainId]: newVisibility }));
                    if (viewerRef.current) {
                      setChainVisibilityInViewer(viewerRef.current, chainId, newVisibility);
                    }
                  }}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-slate-300">Chain {chainId}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700 flex gap-2">
            <button
              onClick={async () => {
                const newVisibility: Record<string, boolean> = {};
                availableChains.forEach(id => { newVisibility[id] = true; });
                setChainVisibility(newVisibility);
                if (viewerRef.current) {
                  // Run sequentially to avoid race conditions
                  for (const id of availableChains) {
                    await setChainVisibilityInViewer(viewerRef.current, id, true);
                  }
                }
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Show all
            </button>
            <button
              onClick={async () => {
                const newVisibility: Record<string, boolean> = {};
                availableChains.forEach(id => { newVisibility[id] = false; });
                setChainVisibility(newVisibility);
                if (viewerRef.current) {
                  // Run sequentially to avoid race conditions
                  for (const id of availableChains) {
                    await setChainVisibilityInViewer(viewerRef.current, id, false);
                  }
                }
              }}
              className="text-[10px] text-slate-400 hover:text-slate-300"
            >
              Hide all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TARGET_COLOR = Color(0x60a5fa);  // Blue (tailwind blue-400)
const BINDER_COLOR = Color(0xfcd34d);  // Yellow (tailwind yellow-300)
const CONTEXT_COLOR = Color(0x34d399); // Green/teal (tailwind emerald-400)
const HOTSPOT_COLOR = Color(0xff1493); // Bright magenta/deep pink for hotspot highlighting

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

/**
 * Parse residue strings like "E:417" into chain and residue number
 */
function parseResidueSpec(residue: string): { chain: string; resNum: number } | null {
  const match = residue.match(/^([A-Za-z]):(\d+)$/);
  if (!match) return null;
  return { chain: match[1], resNum: parseInt(match[2], 10) };
}

/**
 * Build a query to select specific residues by chain and residue number
 * Residues should be in format "A:417" (chain:residue_number)
 */
function buildResidueQuery(label: string, residues: string[]) {
  const parsed = residues
    .map(parseResidueSpec)
    .filter((r): r is { chain: string; resNum: number } => r !== null);

  if (parsed.length === 0) return null;

  // Group residues by chain for more efficient query
  const byChain = new Map<string, number[]>();
  for (const { chain, resNum } of parsed) {
    if (!byChain.has(chain)) byChain.set(chain, []);
    byChain.get(chain)!.push(resNum);
  }

  // Build a query that matches any of the chain+residue combinations
  const chainQueries = Array.from(byChain.entries()).map(([chain, resNums]) => {
    // Match chain by either auth_asym_id or label_asym_id
    const chainTest = MS.core.logic.or([
      MS.core.rel.eq([MS.ammp("auth_asym_id"), chain]),
      MS.core.rel.eq([MS.ammp("label_asym_id"), chain]),
    ]);
    // Match residue by either auth_seq_id or label_seq_id
    const resTest = MS.core.logic.or([
      MS.core.set.has([MS.set(...resNums), MS.ammp("auth_seq_id")]),
      MS.core.set.has([MS.set(...resNums), MS.ammp("label_seq_id")]),
    ]);
    return MS.core.logic.and([chainTest, resTest]);
  });

  const combinedTest =
    chainQueries.length === 1
      ? chainQueries[0]
      : MS.core.logic.or(chainQueries);

  const expression = MS.struct.generator.atomGroups({
    "residue-test": combinedTest,
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
  const hasContext = (chainColors.context?.length ?? 0) > 0;
  if (!hasTargets && !hasBinders && !hasContext) return;

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

  if (hasContext) {
    const query = buildChainQuery("Context Chains", chainColors.context || []);
    if (query) {
      try {
        await manager.applyTheme(
          {
            selection: query,
            action: { name: "color", params: { color: CONTEXT_COLOR } },
            representations: [],
          },
          structures
        );
      } catch (error) {
        console.warn("Unable to apply context chain colors:", error);
      }
    }
  }
}

/**
 * Toggle visibility of water molecules and ions
 */
async function setWaterVisibility(viewer: Viewer, visible: boolean) {
  const plugin = viewer.plugin;
  const structures = plugin.managers.structure.hierarchy.current.structures;
  if (!structures.length) return;

  try {
    for (const structure of structures) {
      for (const component of structure.components) {
        const cell = component.cell;
        const obj = cell.obj;
        if (!obj) continue;

        const label = (obj.label || "").toLowerCase();
        const key = (component.key || "").toLowerCase();

        const isWaterOrIon =
          label.includes("water") ||
          label.includes("ion") ||
          key.includes("water") ||
          key.includes("ion");

        if (isWaterOrIon) {
          // Toggle visibility of the component
          if (cell.state.isHidden !== !visible) {
            await plugin.state.data.updateCellState(cell.transform.ref, { isHidden: !visible });
          }

          // Also toggle the representations within this component
          for (const repr of component.representations) {
            if (repr.cell.state.isHidden !== !visible) {
              await plugin.state.data.updateCellState(repr.cell.transform.ref, { isHidden: !visible });
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn("Unable to toggle water visibility:", error);
  }
}

/**
 * Apply highlighting to specific residues (e.g., hotspots)
 * Format: ["E:417", "E:453", "E:484"] for chain E residues 417, 453, 484
 */
async function applyResidueHighlight(
  viewer: Viewer,
  residues: string[]
) {
  if (!residues || residues.length === 0) return;

  const plugin = viewer.plugin;
  const manager = plugin.managers.structure.component;
  const structures = plugin.managers.structure.hierarchy.current.structures;
  if (!structures.length) return;

  // Parse residues and build MolScript expression
  const parsed = residues
    .map(parseResidueSpec)
    .filter((r): r is { chain: string; resNum: number } => r !== null);

  if (parsed.length === 0) return;

  // Group by chain
  const byChain = new Map<string, number[]>();
  for (const { chain, resNum } of parsed) {
    if (!byChain.has(chain)) byChain.set(chain, []);
    byChain.get(chain)!.push(resNum);
  }

  // Build MolScript expression for residue selection
  const chainQueries = Array.from(byChain.entries()).map(([chain, resNums]) => {
    const chainTest = MS.core.logic.or([
      MS.core.rel.eq([MS.ammp("auth_asym_id"), chain]),
      MS.core.rel.eq([MS.ammp("label_asym_id"), chain]),
    ]);
    const resTest = MS.core.logic.or([
      MS.core.set.has([MS.set(...resNums), MS.ammp("auth_seq_id")]),
      MS.core.set.has([MS.set(...resNums), MS.ammp("label_seq_id")]),
    ]);
    return MS.core.logic.and([chainTest, resTest]);
  });

  const combinedTest =
    chainQueries.length === 1
      ? chainQueries[0]
      : MS.core.logic.or(chainQueries);

  const expression = MS.struct.generator.atomGroups({
    "residue-test": combinedTest,
  });

  // Create a StructureSelectionQuery for the theme system
  const hotspotQuery = StructureSelectionQuery("Hotspot Residues", expression);

  try {
    // Apply hotspot color using the theme system (same as chain colors)
    await manager.applyTheme(
      {
        selection: hotspotQuery,
        action: { name: "color", params: { color: HOTSPOT_COLOR } },
        representations: [],
      },
      structures
    );
  } catch (error) {
    console.warn("Unable to apply residue highlight:", error);
  }
}

/**
 * Clear all residue highlights and reset colors
 */
async function clearResidueHighlight(
  viewer: Viewer,
  chainColors?: MolstarViewerProps["chainColors"]
) {
  try {
    // Re-apply chain colors to reset visual appearance (clears hotspot colors)
    await applyChainColors(viewer, chainColors);
  } catch (error) {
    console.warn("Unable to clear highlights:", error);
  }
}

/**
 * Extract available chain IDs from the loaded structure
 */
function extractChains(viewer: Viewer): string[] {
  const chains = new Set<string>();

  try {
    const structures = viewer.plugin.managers.structure.hierarchy.current.structures;
    for (const structure of structures) {
      const data = structure.cell.obj?.data;
      if (!data) continue;

      // Get chains from the model's hierarchy
      const model = data.models?.[0];
      if (model) {
        const authAsymId = model.atomicHierarchy?.chains?.auth_asym_id;
        if (authAsymId) {
          // Iterate over all chain indices
          for (let i = 0; i < authAsymId.rowCount; i++) {
            const chainId = authAsymId.value(i);
            if (chainId && typeof chainId === 'string') {
              chains.add(chainId);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn("Unable to extract chains:", error);
  }

  return Array.from(chains).sort();
}

/**
 * Set visibility of a specific chain using transparency/overpaint
 */
async function setChainVisibilityInViewer(
  viewer: Viewer,
  chainId: string,
  visible: boolean
) {
  const plugin = viewer.plugin;
  const manager = plugin.managers.structure.component;
  const structures = plugin.managers.structure.hierarchy.current.structures;

  if (!structures.length) return;

  // Build a query for this specific chain
  const chainQuery = buildChainQuery(`Chain ${chainId}`, [chainId]);
  if (!chainQuery) return;

  try {
    // Use transparency to hide/show the chain
    // Setting transparency to 1 makes it invisible, 0 makes it fully visible
    await manager.applyTheme(
      {
        selection: chainQuery,
        action: {
          name: "transparency",
          params: { value: visible ? 0 : 1 },
        },
        representations: [],
      },
      structures
    );
  } catch (error) {
    console.warn(`Unable to set visibility for chain ${chainId}:`, error);
  }
}
