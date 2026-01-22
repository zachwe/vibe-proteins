"""mBER integration helpers."""

from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Any

from integrations.external import ExternalRepo

MBER_REPO = ExternalRepo(
    name="mber",
    repo_url="https://github.com/manifoldbio/mber-open.git",
    ref="031d54fbb3533b06df27805061b2d05587a0dc06",
)

MBER_PROTOCOLS_REPO = ExternalRepo(
    name="mber-protocols",
    repo_url="https://github.com/manifoldbio/mber-open.git",
    ref="031d54fbb3533b06df27805061b2d05587a0dc06",
    subdir="protocols",
)

MBER_DEFAULT_MASKED_VHH = (
    "EVQLVESGGGLVQPGGSLRLSCAASG*********WFRQAPGKEREF***********"
    "NADSVKGRFTISRDNAKNTLYLQMNSLRAEDTAVYYC************WGQGTLVTVSS"
)


def pip_specs_for_mber() -> list[str]:
    return [
        MBER_REPO.pip_spec("mber"),
        MBER_PROTOCOLS_REPO.pip_spec("mber-protocols"),
    ]


def normalize_mber_hotspots(
    hotspots: list[str] | None,
    default_chain: str | None = None,
) -> str | None:
    if not hotspots:
        return None
    normalized: list[str] = []
    for residue in hotspots:
        if not residue:
            continue
        match = re.search(r"([A-Za-z])\s*[:\-_/]?\s*(\d+)", residue)
        if match:
            chain_id, res_id = match.groups()
        elif residue.isdigit() and default_chain:
            chain_id, res_id = default_chain, residue
        else:
            continue
        normalized.append(f"{chain_id.upper()}{int(res_id)}")
    return ",".join(normalized) if normalized else None


def build_vhh_settings(
    output_dir: Path,
    target_path: Path,
    target_chains: list[str],
    hotspots: list[str] | None,
    target_name: str | None,
    masked_sequence: str | None,
    num_accepted: int,
    max_trajectories: int,
    min_iptm: float,
    min_plddt: float,
    skip_animations: bool,
    skip_pickle: bool,
    skip_png: bool,
) -> dict[str, Any]:
    chains_str = ",".join([chain.strip().upper() for chain in target_chains if chain.strip()])
    hotspots_str = normalize_mber_hotspots(hotspots, target_chains[0] if target_chains else None)

    return {
        "output": {
            "dir": str(output_dir),
            "skip_animations": skip_animations,
            "skip_pickle": skip_pickle,
            "skip_png": skip_png,
        },
        "target": {
            "pdb": str(target_path),
            "name": target_name,
            "chains": chains_str or "A",
            "hotspots": hotspots_str,
        },
        "binder": {
            "masked_sequence": masked_sequence or MBER_DEFAULT_MASKED_VHH,
        },
        "stopping": {
            "num_accepted": num_accepted,
            "max_trajectories": max_trajectories,
        },
        "filters": {
            "min_iptm": min_iptm,
            "min_plddt": min_plddt,
        },
    }


def parse_accepted_csv(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    results: list[dict[str, Any]] = []
    with path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if not row.get("binder_seq"):
                continue
            results.append({
                "trajectory_name": row.get("trajectory_name"),
                "binder_index": int(row.get("binder_index") or 0),
                "binder_seq": row.get("binder_seq"),
                "i_ptm": float(row.get("i_ptm") or 0.0),
                "plddt": float(row.get("plddt") or 0.0),
                "ptm": float(row.get("ptm") or 0.0),
                "complex_pdb_path": row.get("complex_pdb_path"),
                "relaxed_pdb_path": row.get("relaxed_pdb_path"),
            })
    return results


def check_mber_weights(weights_dir: Path) -> list[str]:
    missing: list[str] = []
    af_check = weights_dir / "af_params" / "params_model_5_ptm.npz"
    if not af_check.exists():
        missing.append(str(af_check))
    nbb_dir = weights_dir / "nbb2_weights"
    for model_id in (
        "nanobody_model_1",
        "nanobody_model_2",
        "nanobody_model_3",
        "nanobody_model_4",
    ):
        if not (nbb_dir / model_id).exists():
            missing.append(str(nbb_dir / model_id))
    esm_dir = weights_dir / "huggingface" / "hub" / "models--facebook--esm2_t33_650M_UR50D"
    if not esm_dir.exists():
        missing.append(str(esm_dir))
    return missing
