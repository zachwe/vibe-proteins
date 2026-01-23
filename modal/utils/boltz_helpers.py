from __future__ import annotations

import json
import string
from pathlib import Path
import shutil
import urllib.request
from typing import List


def _clean_sequence(sequence: str) -> str:
  lines = [line.strip() for line in sequence.splitlines() if line.strip()]
  return "".join(line for line in lines if not line.startswith(">"))


def _extract_chain_sequences(path: Path) -> List[tuple[str, str]]:
  from Bio.PDB import PDBParser, MMCIFParser
  from Bio.PDB.Polypeptide import PPBuilder

  if path.suffix.lower() == ".cif":
    parser = MMCIFParser(QUIET=True)
  else:
    parser = PDBParser(QUIET=True)
  structure = parser.get_structure("structure", str(path))
  builder = PPBuilder()
  sequences: List[tuple[str, str]] = []
  for chain in structure.get_chains():
    fragments = [str(pp.get_sequence()) for pp in builder.build_peptides(chain)]
    if fragments:
      sequences.append((chain.id, "".join(fragments)))
  return sequences


def _select_chain_id(used: set[str]) -> str:
  for letter in string.ascii_uppercase + string.ascii_lowercase:
    if letter not in used:
      return letter
  raise ValueError("Unable to select an unused chain id for the binder.")


def ensure_boltz2_cache(cache_dir: Path) -> None:
  """Ensure Boltz-2 model weights and CCD data are downloaded."""
  cache_dir.mkdir(parents=True, exist_ok=True)
  mols_dir = cache_dir / "mols"
  model_path = cache_dir / "boltz2_conf.ckpt"
  ala_path = mols_dir / "ALA.pkl"
  if mols_dir.exists() and model_path.exists() and ala_path.exists():
    return

  if mols_dir.exists() and not ala_path.exists():
    shutil.rmtree(mols_dir, ignore_errors=True)
  mols_tar = cache_dir / "mols.tar"
  if mols_tar.exists() and not ala_path.exists():
    mols_tar.unlink()

  from boltz.main import download_boltz2

  download_boltz2(cache_dir)

  ccd_path = cache_dir / "ccd.pkl"
  if not ccd_path.exists():
    from boltz.main import CCD_URL

    urllib.request.urlretrieve(CCD_URL, str(ccd_path))  # noqa: S310


def _write_boltz_yaml(
  target_sequences: List[tuple[str, str]],
  binder_sequence: str | None = None,
  binder_chain_id: str | None = None,
  output_path: Path = None,
  use_msa_server: bool = True,
  msa_paths: dict[str, str] | None = None,
  binder_sequences: List[tuple[str, str]] | None = None,
) -> Path:
  """
  Write a Boltz input YAML file.

  Args:
    target_sequences: List of (chain_id, sequence) tuples for target chains
    binder_sequence: Single binder sequence (for single-chain binders like nanobodies)
    binder_chain_id: Chain ID to assign to single binder
    output_path: Path to write YAML file
    use_msa_server: If True, let Boltz use its MSA server
    msa_paths: Optional dict mapping chain_id -> A3M file path for pre-computed MSAs
    binder_sequences: List of (chain_id, sequence) tuples for multi-chain binders (e.g., antibody H+L)
  """
  import yaml

  msa_paths = msa_paths or {}

  sequences_payload: List[dict] = []
  for chain_id, sequence in target_sequences:
    entry = {"protein": {"id": chain_id, "sequence": sequence}}
    if chain_id in msa_paths:
      # Use pre-computed MSA
      entry["protein"]["msa"] = msa_paths[chain_id]
    elif not use_msa_server:
      entry["protein"]["msa"] = "empty"
    sequences_payload.append(entry)

  # Handle multi-chain binders (e.g., antibody H+L chains)
  if binder_sequences:
    for chain_id, sequence in binder_sequences:
      binder_entry = {"protein": {"id": chain_id, "sequence": sequence}}
      if chain_id in msa_paths:
        binder_entry["protein"]["msa"] = msa_paths[chain_id]
      elif not use_msa_server:
        binder_entry["protein"]["msa"] = "empty"
      sequences_payload.append(binder_entry)
  elif binder_sequence and binder_chain_id:
    # Single-chain binder (nanobody, designed binder, etc.)
    binder_entry = {"protein": {"id": binder_chain_id, "sequence": binder_sequence}}
    if binder_chain_id in msa_paths:
      binder_entry["protein"]["msa"] = msa_paths[binder_chain_id]
    elif not use_msa_server:
      binder_entry["protein"]["msa"] = "empty"
    sequences_payload.append(binder_entry)

  payload = {"version": 1, "sequences": sequences_payload}
  output_path.write_text(yaml.safe_dump(payload, sort_keys=False))
  return output_path


def _boltz_prediction_dirs(out_dir: Path, input_name: str) -> list[Path]:
  predictions_dir = out_dir / "predictions"
  if not predictions_dir.exists():
    return []

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
      record_ids = []

  candidate_dirs: list[Path] = []
  for record_id in record_ids or [input_name]:
    candidate_dir = predictions_dir / record_id
    if candidate_dir.exists():
      candidate_dirs.append(candidate_dir)

  if not candidate_dirs:
    candidate_dirs = [path for path in predictions_dir.iterdir() if path.is_dir()]

  return candidate_dirs


def _select_boltz_prediction(out_dir: Path, input_name: str) -> Path:
  pred_dirs = _boltz_prediction_dirs(out_dir, input_name)
  candidates: list[Path] = []
  for pred_dir in pred_dirs:
    record_id = pred_dir.name
    candidates.extend(sorted(pred_dir.glob(f"{record_id}_model_*.pdb")))
    candidates.extend(sorted(pred_dir.glob(f"{record_id}_model_*.cif")))
    candidates.extend(sorted(pred_dir.glob("*.pdb")))
    candidates.extend(sorted(pred_dir.glob("*.cif")))

  if not candidates:
    raise FileNotFoundError(f"No Boltz predictions found under {out_dir / 'predictions'}")
  return candidates[0]


def _read_boltz_confidence(out_dir: Path, input_name: str) -> dict:
  pred_dirs = _boltz_prediction_dirs(out_dir, input_name)
  candidates: list[Path] = []
  for pred_dir in pred_dirs:
    record_id = pred_dir.name
    candidates.extend(sorted(pred_dir.glob(f"confidence_{record_id}_model_*.json")))
    candidates.extend(sorted(pred_dir.glob("confidence_*_model_*.json")))

  if not candidates:
    return {}
  preferred = next((path for path in candidates if "_model_0" in path.name), candidates[0])
  return json.loads(preferred.read_text())
