/**
 * HotspotIndicator Component
 *
 * Displays currently selected hotspot residues below the Mol* viewer.
 * Shows residues as chips, collapsing consecutive residues into ranges (e.g., E:17-25).
 */

import { useMemo } from "react";

interface HotspotIndicatorProps {
  selectedHotspots: string[];
  onHotspotsChange: (residues: string[]) => void;
  hotspotLabel?: string; // e.g., "ACE2 Binding Site" if from a preset
}

// Parse residue string like "E:417" into components
function parseResidue(residue: string): { chain: string; number: number } | null {
  const match = residue.match(/^([A-Za-z]):(\d+)$/);
  if (!match) return null;
  return { chain: match[1], number: parseInt(match[2], 10) };
}

// Represents either a single residue or a range
interface ResidueRange {
  chain: string;
  start: number;
  end: number;
  residues: string[]; // Original residue strings in this range
}

// Collapse consecutive residues into ranges
function collapseToRanges(hotspots: string[]): ResidueRange[] {
  if (hotspots.length === 0) return [];

  // Parse and sort by chain, then by number
  const parsed = hotspots
    .map((r) => ({ original: r, parsed: parseResidue(r) }))
    .filter((r): r is { original: string; parsed: { chain: string; number: number } } => r.parsed !== null)
    .sort((a, b) => {
      if (a.parsed.chain !== b.parsed.chain) {
        return a.parsed.chain.localeCompare(b.parsed.chain);
      }
      return a.parsed.number - b.parsed.number;
    });

  if (parsed.length === 0) return [];

  const ranges: ResidueRange[] = [];
  let currentRange: ResidueRange = {
    chain: parsed[0].parsed.chain,
    start: parsed[0].parsed.number,
    end: parsed[0].parsed.number,
    residues: [parsed[0].original],
  };

  for (let i = 1; i < parsed.length; i++) {
    const { chain, number } = parsed[i].parsed;
    const original = parsed[i].original;

    // Check if this residue extends the current range
    if (chain === currentRange.chain && number === currentRange.end + 1) {
      currentRange.end = number;
      currentRange.residues.push(original);
    } else {
      // Start a new range
      ranges.push(currentRange);
      currentRange = {
        chain,
        start: number,
        end: number,
        residues: [original],
      };
    }
  }

  // Don't forget the last range
  ranges.push(currentRange);

  return ranges;
}

// Format a range for display
function formatRange(range: ResidueRange): string {
  if (range.start === range.end) {
    return `${range.chain}:${range.start}`;
  }
  return `${range.chain}:${range.start}-${range.end}`;
}

export default function HotspotIndicator({
  selectedHotspots,
  onHotspotsChange,
  hotspotLabel,
}: HotspotIndicatorProps) {
  const ranges = useMemo(() => collapseToRanges(selectedHotspots), [selectedHotspots]);

  if (selectedHotspots.length === 0) {
    return null;
  }

  const handleRemoveRange = (range: ResidueRange) => {
    // Remove all residues in this range
    onHotspotsChange(selectedHotspots.filter((r) => !range.residues.includes(r)));
  };

  const handleClearAll = () => {
    onHotspotsChange([]);
  };

  return (
    <div className="bg-slate-700/50 rounded-lg p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-purple-400">
            Selected Hotspots
          </span>
          <span className="text-xs text-slate-500">
            ({selectedHotspots.length} residues)
          </span>
          {hotspotLabel && (
            <span className="text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
              {hotspotLabel}
            </span>
          )}
        </div>
        <button
          onClick={handleClearAll}
          className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ranges.map((range) => (
          <button
            key={formatRange(range)}
            onClick={() => handleRemoveRange(range)}
            className="group inline-flex items-center gap-1 text-xs bg-purple-600/30 text-purple-200 px-2 py-1 rounded font-mono hover:bg-purple-600/50 transition-colors"
            title={`Click to remove ${formatRange(range)}${range.residues.length > 1 ? ` (${range.residues.length} residues)` : ""}`}
          >
            {formatRange(range)}
            <span className="text-purple-400 group-hover:text-white transition-colors">
              &times;
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
