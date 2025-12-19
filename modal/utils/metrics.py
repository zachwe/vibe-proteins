"""
Lightweight structural scoring utilities (ipSAE approximation, interface metrics).
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Set

import numpy as np
from Bio.PDB import PDBParser


def _load_structure(path: Path):
  parser = PDBParser(QUIET=True)
  return parser.get_structure("structure", str(path))


def chain_ids_from_structure(path: Path) -> Set[str]:
  structure = _load_structure(path)
  return {chain.id for chain in structure.get_chains()}


def _format_residue(atom) -> str:
  residue = atom.get_parent()
  chain = residue.get_parent()
  resseq = residue.get_id()[1]
  return f"{chain.id}:{resseq}:{residue.get_resname().strip()}"


def compute_interface_metrics(
  complex_path: Path,
  target_chain_ids: Iterable[str] | None = None,
) -> dict:
  structure = _load_structure(complex_path)
  binder_atoms: List = []
  target_atoms: List = []

  target_chain_set = set(target_chain_ids or [])

  for chain in structure.get_chains():
    atoms = list(chain.get_atoms())
    if target_chain_set:
      if chain.id in target_chain_set:
        target_atoms.extend(atoms)
      else:
        binder_atoms.extend(atoms)
    else:
      # Split by first chain as target if not provided
      (target_atoms if not target_atoms else binder_atoms).extend(atoms)

  if not binder_atoms or not target_atoms:
    return {
      "ip_sae": 0.0,
      "interface_area": 0.0,
      "shape_complementarity": 0.0,
      "contact_pairs": [],
      "contact_count": 0,
    }

  binder_coords = np.array([atom.coord for atom in binder_atoms])
  target_coords = np.array([atom.coord for atom in target_atoms])
  diff = binder_coords[:, None, :] - target_coords[None, :, :]
  distances = np.linalg.norm(diff, axis=2)

  contact_mask = distances < 8.5
  binder_idx, target_idx = np.where(contact_mask)
  contact_distances = distances[contact_mask]

  if contact_distances.size == 0:
    return {
      "ip_sae": 0.0,
      "interface_area": 0.0,
      "shape_complementarity": 0.0,
      "contact_pairs": [],
      "contact_count": 0,
    }

  energies = -np.exp(-contact_distances / 1.8)
  ip_sae = float(np.sum(energies))
  interface_area = float(np.sum(np.clip(6.0 - contact_distances, 0, None)) * 18.0)
  shape_complementarity = float(
    min(
      1.0,
      contact_distances.size / max(np.sqrt(len(binder_atoms) * len(target_atoms)), 1),
    )
  )

  # Summarise a subset of contacts for debugging/visualisation
  pairs = []
  for idx in range(min(len(binder_idx), 25)):
    pairs.append(
      {
        "binder_residue": _format_residue(binder_atoms[binder_idx[idx]]),
        "target_residue": _format_residue(target_atoms[target_idx[idx]]),
        "distance": float(contact_distances[idx]),
      }
    )

  return {
    "ip_sae": ip_sae,
    "interface_area": interface_area,
    "shape_complementarity": shape_complementarity,
    "contact_pairs": pairs,
    "contact_count": int(contact_distances.size),
  }
