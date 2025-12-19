"""
Manual smoke tests for Modal functions.

This script is intentionally excluded from CI – GPU-backed jobs can be expensive.
Run it locally once you have authenticated with Modal (`modal token new`) and
have deployed the vibeproteins app.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import modal

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_DIR = REPO_ROOT / "sample_data"
PDB_DIR = SAMPLE_DIR / "pdb"
SEQ_DIR = SAMPLE_DIR / "sequences"

TARGET_PDB_PATH = PDB_DIR / "mini_target.pdb"
BINDER_PDB_PATH = PDB_DIR / "mini_binder.pdb"
COMPLEX_PDB_PATH = PDB_DIR / "mini_complex.pdb"
BINDER_SEQ_PATH = SEQ_DIR / "mini_binder.fasta"

TARGET_SEQUENCE = "GSA"  # Derived from mini_target.pdb

GPU_JOBS = {"rfdiffusion", "proteinmpnn", "boltz2"}
JOB_ORDER = ["rfdiffusion", "proteinmpnn", "boltz2", "score"]


def read_text(path: Path) -> str:
    return path.read_text().strip()


def read_sequence(path: Path) -> str:
    lines = [line.strip() for line in path.read_text().splitlines() if line.strip()]
    return "".join(line for line in lines if not line.startswith(">"))


def lookup(fn_name: str, app_name: str) -> modal.Function:
    return modal.Function.lookup(app_name, fn_name)


def build_payload(job: str, args: argparse.Namespace) -> Tuple[str, Dict[str, object]]:
    target_pdb = read_text(TARGET_PDB_PATH)
    binder_pdb = read_text(BINDER_PDB_PATH)
    binder_seq = read_sequence(BINDER_SEQ_PATH)

    if job == "rfdiffusion":
        return (
            "run_rfdiffusion",
            {
                "target_pdb": target_pdb,
                "target_sequence": TARGET_SEQUENCE,
                "num_designs": args.designs,
                "sequences_per_backbone": args.sequences_per_backbone,
                "diffusion_steps": args.diffusion_steps,
                "boltz_samples": args.boltz_samples,
            },
        )

    if job == "proteinmpnn":
        return (
            "run_proteinmpnn",
            {
                "backbone_pdb": binder_pdb,
                "num_sequences": args.mpnn_sequences,
            },
        )

    if job == "boltz2":
        return (
            "run_boltz2",
            {
                "target_pdb": target_pdb,
                "binder_pdb": binder_pdb,
                "binder_sequence": binder_seq,
                "num_samples": args.boltz_samples,
            },
        )

    if job == "score":
        return (
            "compute_scores",
            {
                "design_pdb": read_text(COMPLEX_PDB_PATH),
                "target_pdb": target_pdb,
            },
        )

    raise ValueError(f"Unsupported job: {job}")


def parse_jobs(selected: Iterable[str]) -> List[str]:
    chosen = list(selected)
    if "all" in chosen:
        return JOB_ORDER
    return chosen


def main() -> None:
    parser = argparse.ArgumentParser(description="Manual Modal smoke tests")
    parser.add_argument(
        "--jobs",
        nargs="+",
        choices=JOB_ORDER + ["all"],
        default=["all"],
        help="Which jobs to run (default: all)",
    )
    parser.add_argument("--app", default="vibeproteins", help="Modal app name to target")
    parser.add_argument("--designs", type=int, default=1, help="RFdiffusion designs to request")
    parser.add_argument(
        "--sequences-per-backbone",
        type=int,
        default=2,
        help="ProteinMPNN sequences per RFdiffusion backbone",
    )
    parser.add_argument("--diffusion-steps", type=int, default=20, help="RFdiffusion steps")
    parser.add_argument("--boltz-samples", type=int, default=1, help="Boltz-2 samples")
    parser.add_argument("--mpnn-sequences", type=int, default=4, help="ProteinMPNN sequences")
    args = parser.parse_args()

    jobs_to_run = parse_jobs(args.jobs)
    if not jobs_to_run:
        print("No jobs selected. Nothing to do.")
        return

    if any(job in GPU_JOBS for job in jobs_to_run):
        print("⚠️  GPU-backed Modal calls may incur cost. This script should not run in CI.")

    summary = {}
    for job in jobs_to_run:
        fn_name, payload = build_payload(job, args)
        print(f"\n➡️  Running {job} via {fn_name} …")
        fn = lookup(fn_name, args.app)
        result = fn.call(**payload)
        summary[job] = result
        print(json.dumps(result, indent=2))

    print("\n✅ Completed Modal smoke test.")


if __name__ == "__main__":
    main()
