"""
PAE-based ipSAE (Interface Predicted Structure-Aligned Energy) scoring.

Adapted from DunbrackLab/IPSAE (https://github.com/DunbrackLab/IPSAE)
for use with Boltz-2 predictions.

Reference:
  - Yang & Skolnick (2002) d0 formula
  - Bryant et al. pDockQ
  - Zhu et al. pDockQ2
  - Kim et al. LIS (Local Interaction Score)
"""

from __future__ import annotations

import json
from math import exp, log10
from pathlib import Path
from typing import Any

import numpy as np
from Bio.PDB import MMCIFParser, PDBParser


def ptm_func(pae: float | np.ndarray, d0: float) -> float | np.ndarray:
    """
    Convert PAE values to confidence scores using the TM-score formula.

    Args:
        pae: PAE value(s) in Angstroms
        d0: Distance threshold parameter

    Returns:
        Score(s) in range [0, 1] where 1 = high confidence
    """
    return 1.0 / (1.0 + (pae / d0) ** 2.0)


def calc_d0(length: int, pair_type: str = "protein") -> float:
    """
    Calculate the d0 parameter for TM-score based on sequence length.

    Based on Yang & Skolnick (2002) formula.

    Args:
        length: Number of residues
        pair_type: "protein" or "nucleic_acid"

    Returns:
        d0 distance threshold in Angstroms
    """
    L = float(max(length, 27))  # Minimum 27 for formula validity
    min_value = 1.0 if pair_type == "protein" else 2.0
    d0 = 1.24 * (L - 15) ** (1.0 / 3.0) - 1.8
    return max(min_value, d0)


def _load_structure(path: Path):
    """Load a structure from PDB or CIF file."""
    if path.suffix.lower() == ".cif":
        parser = MMCIFParser(QUIET=True)
    else:
        parser = PDBParser(QUIET=True)
    return parser.get_structure("structure", str(path))


def _get_chain_residue_mapping(path: Path) -> dict[str, list[int]]:
    """
    Get mapping of chain IDs to residue indices in the structure.

    Returns dict mapping chain_id -> list of global residue indices (0-based).
    """
    structure = _load_structure(path)
    chain_residues: dict[str, list[int]] = {}
    idx = 0

    for model in structure:
        for chain in model:
            chain_id = chain.id
            if chain_id not in chain_residues:
                chain_residues[chain_id] = []
            for residue in chain:
                # Skip hetero atoms
                if residue.id[0] != " ":
                    continue
                chain_residues[chain_id].append(idx)
                idx += 1

    return chain_residues


def _get_plddt_per_residue(path: Path) -> np.ndarray | None:
    """
    Extract per-residue pLDDT from B-factors in a structure file.

    Returns array of pLDDT values (0-100 scale) or None if not available.
    """
    structure = _load_structure(path)
    plddts = []

    for model in structure:
        for chain in model:
            for residue in chain:
                if residue.id[0] != " ":
                    continue
                # Get CA atom B-factor (pLDDT is stored here by AF2/Boltz)
                if "CA" in residue:
                    plddts.append(residue["CA"].get_bfactor())
                elif len(residue) > 0:
                    # Fallback to first atom
                    plddts.append(list(residue.get_atoms())[0].get_bfactor())

    if not plddts:
        return None
    return np.array(plddts)


def compute_ipsae_from_pae(
    pae_matrix: np.ndarray,
    structure_path: Path,
    chain_pairs: list[tuple[str, str]] | None = None,
    pae_cutoff: float = 12.0,
) -> dict[str, Any]:
    """
    Compute ipSAE and related metrics from PAE matrix.

    This implements three variants of ipSAE based on d0 calculation:
    - ipSAE_d0chn: d0 based on total chain lengths
    - ipSAE_d0dom: d0 based on residues with PAE < cutoff
    - ipSAE_d0res: d0 based on per-residue contact count

    Args:
        pae_matrix: PAE matrix of shape (n_tokens, n_tokens)
        structure_path: Path to structure file (PDB or CIF)
        chain_pairs: List of (chain1, chain2) pairs to analyze.
                    If None, analyzes all inter-chain pairs.
        pae_cutoff: PAE cutoff for confident interactions (default 12 Å)

    Returns:
        dict with:
            - ipsae: Primary ipSAE score (d0chn variant, lower = better)
            - ipsae_d0dom: ipSAE with d0 from domain size
            - iptm: Interface pTM score (0-1, higher = better)
            - pdockq: pDockQ score (0-1, higher = better)
            - pdockq2: pDockQ2 score (0-1, higher = better)
            - lis: Local Interaction Score (0-1, higher = better)
            - n_interface_contacts: Number of confident interface contacts
    """
    chain_residues = _get_chain_residue_mapping(structure_path)
    plddts = _get_plddt_per_residue(structure_path)

    if not chain_residues:
        return _empty_scores()

    # Get all chain IDs
    chain_ids = list(chain_residues.keys())

    # Determine chain pairs to analyze
    if chain_pairs is None:
        # Analyze all inter-chain pairs
        chain_pairs = [
            (c1, c2) for i, c1 in enumerate(chain_ids) for c2 in chain_ids[i + 1 :]
        ]

    if not chain_pairs:
        return _empty_scores()

    # Compute scores for each chain pair
    all_ipsae_chn = []
    all_ipsae_dom = []
    all_iptm = []
    all_lis = []
    all_contacts = []
    all_interface_plddts = []

    for chain1, chain2 in chain_pairs:
        if chain1 not in chain_residues or chain2 not in chain_residues:
            continue

        residues1 = chain_residues[chain1]
        residues2 = chain_residues[chain2]

        if not residues1 or not residues2:
            continue

        # Extract interface PAE submatrix
        idx1 = np.array(residues1)
        idx2 = np.array(residues2)

        # Handle case where PAE matrix might be smaller than expected
        max_idx = max(idx1.max(), idx2.max())
        if max_idx >= pae_matrix.shape[0]:
            # Indices exceed PAE matrix - skip this pair
            continue

        # Get PAE values for this chain pair (both directions)
        pae_1to2 = pae_matrix[np.ix_(idx1, idx2)]
        pae_2to1 = pae_matrix[np.ix_(idx2, idx1)]

        # Symmetric PAE (minimum of both directions)
        pae_interface = np.minimum(pae_1to2, pae_2to1.T)

        # Find confident contacts
        contact_mask = pae_interface < pae_cutoff
        n_contacts = contact_mask.sum()

        if n_contacts == 0:
            continue

        all_contacts.append(n_contacts)

        # Calculate d0 variants
        total_length = len(residues1) + len(residues2)
        d0_chn = calc_d0(total_length)

        # d0_dom: based on residues with any confident contact
        residues_with_contact = (
            contact_mask.any(axis=1).sum() + contact_mask.any(axis=0).sum()
        )
        d0_dom = calc_d0(max(residues_with_contact, 27))

        # Compute ipSAE scores
        pae_contacts = pae_interface[contact_mask]

        # ipSAE with d0_chn
        ptm_scores_chn = ptm_func(pae_contacts, d0_chn)
        ipsae_chn = -np.mean(ptm_scores_chn) if len(ptm_scores_chn) > 0 else 0.0
        all_ipsae_chn.append(ipsae_chn)

        # ipSAE with d0_dom
        ptm_scores_dom = ptm_func(pae_contacts, d0_dom)
        ipsae_dom = -np.mean(ptm_scores_dom) if len(ptm_scores_dom) > 0 else 0.0
        all_ipsae_dom.append(ipsae_dom)

        # ipTM: average PTM score for interface
        iptm = np.mean(ptm_scores_chn) if len(ptm_scores_chn) > 0 else 0.0
        all_iptm.append(iptm)

        # LIS (Local Interaction Score) - Kim et al.
        valid_pae = pae_contacts[pae_contacts <= 12.0]
        if len(valid_pae) > 0:
            lis_scores = (12.0 - valid_pae) / 12.0
            lis = float(np.mean(lis_scores))
        else:
            lis = 0.0
        all_lis.append(lis)

        # Collect interface pLDDT values for pDockQ
        if plddts is not None:
            res1_with_contact = idx1[contact_mask.any(axis=1)]
            res2_with_contact = idx2[contact_mask.any(axis=0)]
            interface_residues = np.concatenate([res1_with_contact, res2_with_contact])
            valid_residues = interface_residues[interface_residues < len(plddts)]
            if len(valid_residues) > 0:
                all_interface_plddts.extend(plddts[valid_residues].tolist())

    if not all_contacts:
        return _empty_scores()

    # Aggregate scores
    total_contacts = sum(all_contacts)
    ipsae = float(np.mean(all_ipsae_chn))
    ipsae_d0dom = float(np.mean(all_ipsae_dom))
    iptm = float(np.mean(all_iptm))
    lis = float(np.mean(all_lis))

    # pDockQ calculation (Bryant et al.)
    if all_interface_plddts:
        mean_plddt = np.mean(all_interface_plddts)
        x_pdockq = mean_plddt * log10(max(total_contacts, 1))
        pdockq = 0.724 / (1.0 + exp(-0.052 * (x_pdockq - 152.611))) + 0.018
        pdockq = float(max(0.0, min(1.0, pdockq)))

        # pDockQ2 calculation (Zhu et al.)
        mean_ptm = iptm  # Use ipTM as proxy
        x_pdockq2 = mean_plddt * mean_ptm
        pdockq2 = 1.31 / (1.0 + exp(-0.075 * (x_pdockq2 - 84.733))) + 0.005
        pdockq2 = float(max(0.0, min(1.0, pdockq2)))
    else:
        pdockq = 0.0
        pdockq2 = 0.0

    return {
        "ipsae": round(ipsae, 4),
        "ipsae_d0dom": round(ipsae_d0dom, 4),
        "iptm": round(iptm, 4),
        "pdockq": round(pdockq, 4),
        "pdockq2": round(pdockq2, 4),
        "lis": round(lis, 4),
        "n_interface_contacts": int(total_contacts),
    }


def _empty_scores() -> dict[str, Any]:
    """Return empty scores when no interface can be analyzed."""
    return {
        "ipsae": 0.0,
        "ipsae_d0dom": 0.0,
        "iptm": 0.0,
        "pdockq": 0.0,
        "pdockq2": 0.0,
        "lis": 0.0,
        "n_interface_contacts": 0,
    }


def read_boltz_pae(out_dir: Path, input_name: str) -> np.ndarray | None:
    """
    Read PAE matrix from Boltz-2 NPZ output.

    Boltz-2 outputs PAE in separate NPZ files named pae_<record_id>_model_*.npz

    Args:
        out_dir: Boltz output directory
        input_name: Input file name (without extension)

    Returns:
        PAE matrix as numpy array of shape (n_tokens, n_tokens), or None
    """
    predictions_dir = out_dir / "predictions"
    if not predictions_dir.exists():
        return None

    # Check manifest for record IDs
    manifest_path = out_dir / "processed" / "manifest.json"
    record_ids: list[str] = []
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text())
            record_ids = [
                record["id"]
                for record in manifest.get("records", [])
                if isinstance(record, dict) and record.get("id")
            ]
        except json.JSONDecodeError:
            pass

    # Search for PAE files
    for record_id in record_ids or [input_name]:
        pred_dir = predictions_dir / record_id
        if not pred_dir.exists():
            continue

        # Look for PAE NPZ files
        pae_files = sorted(pred_dir.glob(f"pae_{record_id}_model_*.npz"))
        if not pae_files:
            pae_files = sorted(pred_dir.glob("pae_*_model_*.npz"))

        if pae_files:
            # Prefer model 0 if available
            preferred = next(
                (f for f in pae_files if "_model_0" in f.name), pae_files[0]
            )
            try:
                data = np.load(preferred)
                if "pae" in data:
                    return data["pae"]
            except Exception:
                continue

    # Fallback: search all prediction subdirectories
    for pred_dir in predictions_dir.iterdir():
        if not pred_dir.is_dir():
            continue
        for pae_file in pred_dir.glob("pae_*.npz"):
            try:
                data = np.load(pae_file)
                if "pae" in data:
                    return data["pae"]
            except Exception:
                continue

    return None


def compute_interface_scores_from_boltz(
    out_dir: Path,
    structure_path: Path,
    input_name: str,
    target_chains: list[str],
    binder_chain: str,
) -> dict[str, Any]:
    """
    Compute PAE-based interface scores from Boltz-2 output.

    This is the main entry point for scoring after a Boltz-2 prediction.

    Args:
        out_dir: Boltz output directory
        structure_path: Path to predicted structure (PDB/CIF)
        input_name: Input name used for Boltz run
        target_chains: List of target chain IDs
        binder_chain: Binder chain ID

    Returns:
        Dict with ipSAE, ipTM, pDockQ, pDockQ2, LIS scores
    """
    pae_matrix = read_boltz_pae(out_dir, input_name)

    if pae_matrix is None:
        # Fallback to empty scores if PAE not available
        return _empty_scores()

    # Create chain pairs: binder vs each target chain
    chain_pairs = [(binder_chain, target) for target in target_chains]

    return compute_ipsae_from_pae(
        pae_matrix=pae_matrix,
        structure_path=structure_path,
        chain_pairs=chain_pairs,
    )
