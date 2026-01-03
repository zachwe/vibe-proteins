/**
 * SequenceSelector Component
 *
 * Interactive amino acid sequence display with click/drag selection for hotspots.
 * Shows the PDB sequence with optional expansion to canonical UniProt sequence.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type { SuggestedHotspot } from "../lib/api";

interface SequenceSelectorProps {
  sequence: string;
  chainId: string;
  startResidueNumber?: number; // PDB residue numbering start (default 1)
  selectedResidues: string[];
  onSelectionChange: (residues: string[]) => void;
  suggestedHotspots?: SuggestedHotspot[] | null;
  uniprotId?: string | null; // UniProt ID for fetching full sequence
  className?: string;
}

// Fetch full sequence from UniProt API
async function fetchUniprotSequence(uniprotId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://rest.uniprot.org/uniprotkb/${uniprotId}.fasta`
    );
    if (!response.ok) return null;
    const fasta = await response.text();
    // Parse FASTA - skip header line, join remaining lines
    const lines = fasta.split("\n");
    return lines.slice(1).join("").trim();
  } catch {
    return null;
  }
}

// Number of residues per row
const RESIDUES_PER_ROW = 30;

// Parse residue string like "E:417" into components
function parseResidue(residue: string): { chain: string; number: number } | null {
  const match = residue.match(/^([A-Za-z]):(\d+)$/);
  if (!match) return null;
  return { chain: match[1], number: parseInt(match[2], 10) };
}

// Format residue as "Chain:Number"
function formatResidue(chainId: string, residueNumber: number): string {
  return `${chainId}:${residueNumber}`;
}

export default function SequenceSelector({
  sequence,
  chainId,
  startResidueNumber = 1,
  selectedResidues,
  onSelectionChange,
  suggestedHotspots,
  uniprotId,
  className = "",
}: SequenceSelectorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [showFullSequence, setShowFullSequence] = useState(false);
  const [uniprotSequence, setUniprotSequence] = useState<string | null>(null);
  const [isLoadingUniprot, setIsLoadingUniprot] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch UniProt sequence when toggle is clicked
  useEffect(() => {
    if (showFullSequence && uniprotId && !uniprotSequence && !isLoadingUniprot) {
      setIsLoadingUniprot(true);
      fetchUniprotSequence(uniprotId).then((seq) => {
        setUniprotSequence(seq);
        setIsLoadingUniprot(false);
      });
    }
  }, [showFullSequence, uniprotId, uniprotSequence, isLoadingUniprot]);

  // Determine which sequence to display and the effective start residue
  const displaySequence = showFullSequence && uniprotSequence ? uniprotSequence : sequence;
  const effectiveStartResidue = showFullSequence && uniprotSequence ? 1 : startResidueNumber;

  // Calculate where the PDB range is within the UniProt sequence
  const pdbRangeInUniprot = useMemo(() => {
    if (!showFullSequence || !uniprotSequence) return null;
    // Find the PDB sequence within the UniProt sequence
    const pdbIndex = uniprotSequence.indexOf(sequence);
    if (pdbIndex === -1) return null;
    return {
      start: pdbIndex + 1, // 1-indexed
      end: pdbIndex + sequence.length,
    };
  }, [showFullSequence, uniprotSequence, sequence]);

  // Build a set of suggested residue numbers for quick lookup
  const suggestedResidueNumbers = useMemo(() => {
    if (!suggestedHotspots) return new Set<number>();
    const numbers = new Set<number>();
    for (const hotspot of suggestedHotspots) {
      for (const residue of hotspot.residues) {
        const parsed = parseResidue(residue);
        if (parsed && parsed.chain === chainId) {
          numbers.add(parsed.number);
        }
      }
    }
    return numbers;
  }, [suggestedHotspots, chainId]);

  // Build a set of selected residue numbers for quick lookup
  const selectedResidueNumbers = useMemo(() => {
    const numbers = new Set<number>();
    for (const residue of selectedResidues) {
      const parsed = parseResidue(residue);
      if (parsed && parsed.chain === chainId) {
        numbers.add(parsed.number);
      }
    }
    return numbers;
  }, [selectedResidues, chainId]);

  // Compute the range being dragged (for preview highlight)
  const dragRange = useMemo(() => {
    if (dragStart === null || dragEnd === null) return new Set<number>();
    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);
    const range = new Set<number>();
    for (let i = start; i <= end; i++) {
      range.add(i);
    }
    return range;
  }, [dragStart, dragEnd]);

  // Handle mouse down on a residue
  const handleMouseDown = useCallback((residueNumber: number) => {
    setIsDragging(true);
    setDragStart(residueNumber);
    setDragEnd(residueNumber);
  }, []);

  // Handle mouse enter while dragging
  const handleMouseEnter = useCallback(
    (residueNumber: number) => {
      if (isDragging) {
        setDragEnd(residueNumber);
      }
    },
    [isDragging]
  );

  // Handle mouse up - finalize selection
  const handleMouseUp = useCallback(() => {
    if (!isDragging || dragStart === null || dragEnd === null) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);

    // If it's a single click (same start and end), toggle that residue
    if (start === end) {
      const residue = formatResidue(chainId, start);
      if (selectedResidues.includes(residue)) {
        onSelectionChange(selectedResidues.filter((r) => r !== residue));
      } else {
        onSelectionChange([...selectedResidues, residue]);
      }
    } else {
      // For a drag, add all residues in range
      const newResidues = new Set(selectedResidues);
      for (let i = start; i <= end; i++) {
        newResidues.add(formatResidue(chainId, i));
      }
      onSelectionChange(Array.from(newResidues));
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, chainId, selectedResidues, onSelectionChange]);

  // Handle mouse leaving the container
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      // Cancel the drag
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    }
  }, [isDragging]);

  // Split sequence into rows
  const rows = useMemo(() => {
    const result: { startIdx: number; residues: string[] }[] = [];
    for (let i = 0; i < displaySequence.length; i += RESIDUES_PER_ROW) {
      result.push({
        startIdx: i,
        residues: displaySequence.slice(i, i + RESIDUES_PER_ROW).split(""),
      });
    }
    return result;
  }, [displaySequence]);

  // Copy sequence to clipboard
  const handleCopy = async () => {
    await navigator.clipboard.writeText(displaySequence);
  };

  // Check if a UniProt position is within the PDB range (selectable)
  const isInPdbRange = (uniprotPosition: number): boolean => {
    if (!showFullSequence || !pdbRangeInUniprot) return true;
    return uniprotPosition >= pdbRangeInUniprot.start && uniprotPosition <= pdbRangeInUniprot.end;
  };

  // Convert UniProt position to PDB residue number
  const uniprotToPdbResidue = (uniprotPosition: number): number | null => {
    if (!showFullSequence || !pdbRangeInUniprot) return uniprotPosition;
    if (!isInPdbRange(uniprotPosition)) return null;
    // Map UniProt position to PDB residue number
    const offsetInPdb = uniprotPosition - pdbRangeInUniprot.start;
    return startResidueNumber + offsetInPdb;
  };

  return (
    <div className={`bg-slate-700/50 rounded-lg ${className}`}>
      <div className="flex items-center justify-between p-3 border-b border-slate-600/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">
            {showFullSequence ? "Full UniProt Sequence" : `Target Sequence (Chain ${chainId})`}
          </span>
          <span className="text-xs text-slate-500">
            ({displaySequence.length} residues)
          </span>
          {showFullSequence && pdbRangeInUniprot && (
            <span className="text-xs text-blue-400">
              PDB: {pdbRangeInUniprot.start}-{pdbRangeInUniprot.end}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {uniprotId && (
            <button
              onClick={() => setShowFullSequence(!showFullSequence)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                showFullSequence
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-slate-600 hover:bg-slate-500 text-slate-300"
              }`}
              disabled={isLoadingUniprot}
            >
              {isLoadingUniprot ? "Loading..." : showFullSequence ? "PDB Range" : "Full Sequence"}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-300 px-2 py-1 rounded transition-colors"
          >
            Copy
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-300 px-2 py-1 rounded transition-colors"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          ref={containerRef}
          className="p-3 select-none overflow-x-auto"
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
        >
          <div className="font-mono text-xs space-y-1">
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex items-center gap-1">
                {/* Row number label */}
                <span className="text-slate-500 w-10 text-right shrink-0">
                  {effectiveStartResidue + row.startIdx}
                </span>

                {/* Residues */}
                <div className="flex gap-px">
                  {row.residues.map((aa, colIdx) => {
                    const displayPosition = effectiveStartResidue + row.startIdx + colIdx;
                    // In UniProt mode, we need to map to PDB residue numbers
                    const pdbResidueNumber = showFullSequence
                      ? uniprotToPdbResidue(displayPosition)
                      : displayPosition;
                    const inPdbRange = isInPdbRange(displayPosition);
                    const isSelected = pdbResidueNumber !== null && selectedResidueNumbers.has(pdbResidueNumber);
                    const isSuggested = pdbResidueNumber !== null && suggestedResidueNumbers.has(pdbResidueNumber);
                    const isInDragRangeVal = pdbResidueNumber !== null && dragRange.has(pdbResidueNumber);

                    let bgColor = "bg-slate-600/50 hover:bg-slate-500/50";
                    if (!inPdbRange) {
                      // Outside PDB range - dimmed, not selectable
                      bgColor = "bg-slate-700/30";
                    } else if (isSelected) {
                      bgColor = "bg-purple-600/70";
                    } else if (isInDragRangeVal) {
                      bgColor = "bg-purple-500/50";
                    } else if (isSuggested) {
                      bgColor = "bg-blue-600/30 hover:bg-blue-500/40";
                    }

                    return (
                      <button
                        key={colIdx}
                        className={`w-5 h-6 flex items-center justify-center rounded-sm transition-colors ${
                          inPdbRange ? "cursor-pointer" : "cursor-not-allowed"
                        } ${bgColor} ${
                          isSelected ? "text-white font-medium" : inPdbRange ? "text-slate-300" : "text-slate-500"
                        }`}
                        onMouseDown={(e) => {
                          if (!inPdbRange || pdbResidueNumber === null) return;
                          e.preventDefault();
                          handleMouseDown(pdbResidueNumber);
                        }}
                        onMouseEnter={() => {
                          if (!inPdbRange || pdbResidueNumber === null) return;
                          handleMouseEnter(pdbResidueNumber);
                        }}
                        title={
                          inPdbRange
                            ? `${aa}${pdbResidueNumber}${isSuggested ? " (suggested)" : ""}`
                            : `${aa}${displayPosition} (outside PDB range)`
                        }
                        disabled={!inPdbRange}
                      >
                        {aa}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-600/50 text-xs text-slate-400 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-purple-600/70" />
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-600/30" />
              <span>Suggested</span>
            </div>
            {showFullSequence && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-slate-700/30" />
                <span>Outside PDB</span>
              </div>
            )}
            <span className="text-slate-500 ml-auto">Click or drag to select residues</span>
          </div>
        </div>
      )}
    </div>
  );
}
