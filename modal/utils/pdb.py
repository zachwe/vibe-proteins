"""
PDB file parsing and manipulation utilities.
"""

from __future__ import annotations

import difflib
import gzip
import re
from pathlib import Path
from typing import List


def estimate_backbone_length(path: Path) -> int:
    """Estimate the number of residues from CA atoms in a PDB file."""
    length = 0
    for line in path.read_text().splitlines():
        if line.startswith("ATOM") and line[12:16].strip() == "CA":
            length += 1
    return max(length, 60)


def chain_lengths_from_pdb(path: Path) -> dict[str, int]:
    """Get the number of residues per chain from a PDB file."""
    lengths: dict[str, int] = {}
    for line in path.read_text().splitlines():
        if line.startswith("ATOM") and line[12:16].strip() == "CA":
            chain_id = line[21].strip() or "_"
            lengths[chain_id] = lengths.get(chain_id, 0) + 1
    return lengths


def chain_residue_segments_from_pdb(path: Path) -> dict[str, list[tuple[int, int]]]:
    """Get contiguous residue segments per chain from a PDB file."""
    residues_by_chain: dict[str, list[int]] = {}
    for line in path.read_text().splitlines():
        if not line.startswith("ATOM"):
            continue
        if line[12:16].strip() != "CA":
            continue
        chain_id = line[21].strip() or "_"
        residue_field = line[22:26].strip()
        if not residue_field:
            continue
        try:
            residue_id = int(residue_field)
        except ValueError:
            continue
        residues = residues_by_chain.setdefault(chain_id, [])
        if not residues or residues[-1] != residue_id:
            residues.append(residue_id)

    segments_by_chain: dict[str, list[tuple[int, int]]] = {}
    for chain_id, residues in residues_by_chain.items():
        if not residues:
            continue
        segments: list[tuple[int, int]] = []
        start = residues[0]
        prev = residues[0]
        for residue_id in residues[1:]:
            if residue_id == prev + 1:
                prev = residue_id
                continue
            segments.append((start, prev))
            start = residue_id
            prev = residue_id
        segments.append((start, prev))
        segments_by_chain[chain_id] = segments

    return segments_by_chain


def ordered_chain_ids_from_pdb(path: Path) -> List[str]:
    """Get chain IDs in order of appearance in a PDB file."""
    seen: List[str] = []
    for line in path.read_text().splitlines():
        if line.startswith("ATOM"):
            chain_id = line[21].strip() or "_"
            if chain_id not in seen:
                seen.append(chain_id)
    return seen


def write_pdb_chains(source_path: Path, chain_ids: set[str], output_path: Path) -> Path:
    """Extract specific chains from a PDB file to a new file."""
    keep_lines: List[str] = []
    last_chain = None
    for line in source_path.read_text().splitlines():
        if line.startswith(("ATOM", "HETATM")):
            chain_id = line[21].strip() or "_"
            if chain_id in chain_ids:
                keep_lines.append(line)
                last_chain = chain_id
        elif line.startswith("TER") and last_chain in chain_ids:
            keep_lines.append(line)
        elif line.startswith("END"):
            continue
    keep_lines.append("END")
    output_path.write_text("\n".join(keep_lines) + "\n")
    return output_path


def cif_to_pdb(cif_path: Path, pdb_path: Path) -> Path:
    """Convert a CIF file to PDB format using BioPython."""
    from Bio.PDB import MMCIFParser, PDBIO

    parser = MMCIFParser(QUIET=True)
    if cif_path.suffix == ".gz":
        decompressed = pdb_path.with_suffix(".cif")
        with gzip.open(cif_path, "rb") as handle:
            decompressed.write_bytes(handle.read())
        structure = parser.get_structure("struct", str(decompressed))
    else:
        structure = parser.get_structure("struct", str(cif_path))

    io = PDBIO()
    io.set_structure(structure)
    io.save(str(pdb_path))
    return pdb_path


def sequence_similarity(sequence_a: str, sequence_b: str) -> float:
    """Calculate sequence similarity between two sequences."""
    if not sequence_a or not sequence_b:
        return 0.0
    if sequence_a == sequence_b:
        return 1.0
    if sequence_a in sequence_b or sequence_b in sequence_a:
        return min(len(sequence_a), len(sequence_b)) / max(len(sequence_a), len(sequence_b))
    return difflib.SequenceMatcher(a=sequence_a, b=sequence_b).ratio()


def match_output_target_chains(
    output_sequences: List[tuple[str, str]],
    target_sequences: List[tuple[str, str]],
    min_similarity: float = 0.9,
) -> set[str]:
    """Match output chains to target chains by sequence similarity."""
    matched: set[str] = set()
    if not output_sequences or not target_sequences:
        return matched
    for output_chain_id, output_sequence in output_sequences:
        best_score = 0.0
        for _, target_sequence in target_sequences:
            score = sequence_similarity(output_sequence, target_sequence)
            if score > best_score:
                best_score = score
        if best_score >= min_similarity:
            matched.add(output_chain_id)
    return matched


def format_hotspot_residues(hotspots: list[str] | None, default_chain: str) -> str | None:
    """Format hotspot residues for use with tools like ProteinMPNN."""
    if not hotspots:
        return None
    formatted: List[str] = []
    for residue in hotspots:
        if not residue:
            continue
        match = re.search(r"([A-Za-z])\s*[:\-_/]?\s*(\d+)", residue)
        if match:
            chain_id, res_id = match.groups()
        elif residue.isdigit():
            chain_id, res_id = default_chain, residue
        else:
            continue
        formatted.append(f"{chain_id.upper()}{int(res_id)}")
    if not formatted:
        return None
    return ",".join(formatted)


def tail_file(path: Path, max_bytes: int = 20000) -> str:
    """Read the last max_bytes of a file."""
    if not path.exists():
        return ""
    data = path.read_bytes()
    if len(data) > max_bytes:
        data = data[-max_bytes:]
    return data.decode("utf-8", errors="replace")
