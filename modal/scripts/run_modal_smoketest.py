"""
Manual smoke tests for Modal functions.

This script is intentionally excluded from CI – GPU-backed jobs can be expensive.
Run it locally once you have authenticated with Modal (`modal token new`) and
have deployed the vibeproteins app.

Usage examples:
  # Run all tests with mini sample data (default)
  uv run python scripts/run_modal_smoketest.py --mode local

  # Run spike-rbd test with ACE2 hotspots
  uv run python scripts/run_modal_smoketest.py --jobs rfdiffusion3 --target spike-rbd --mode local

  # Run against deployed app
  uv run python scripts/run_modal_smoketest.py --jobs rfdiffusion3 --target spike-rbd --mode deployed
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, List

SCRIPT_DIR = Path(__file__).resolve().parent
MODAL_DIR = SCRIPT_DIR.parent
REPO_ROOT = MODAL_DIR.parent

if str(MODAL_DIR) not in sys.path:
    sys.path.append(str(MODAL_DIR))

import modal  # noqa: E402

from app import app, run_boltz2, run_proteinmpnn, run_rfdiffusion3, compute_scores  # noqa: E402

SAMPLE_DIR = REPO_ROOT / "sample_data"
SAMPLE_DIR = REPO_ROOT / "sample_data"
PDB_DIR = SAMPLE_DIR / "pdb"
SEQ_DIR = SAMPLE_DIR / "sequences"

TARGET_PDB_PATH = PDB_DIR / "mini_target.pdb"
BINDER_PDB_PATH = PDB_DIR / "mini_binder.pdb"
COMPLEX_PDB_PATH = PDB_DIR / "mini_complex.pdb"
BINDER_SEQ_PATH = SEQ_DIR / "mini_binder.fasta"

TARGET_SEQUENCE = "GSA"  # Derived from mini_target.pdb

# ---- Real challenge targets for more realistic testing ----
CHALLENGE_TARGETS = {
    "spike-rbd": {
        "pdb_url": "https://files.rcsb.org/download/6M0J.pdb",
        "target_chain": "E",
        "target_sequence": "NITNLCPFGEVFNATRFASVYAWNRKRISNCVADYSVLYNSASFSTFKCYGVSPTKLNDLCFTNVYADSFVIRGDEVRQIAPGQTGKIADYNYKLPDDFTGCVIAWNSNNLDSKVGGNYNYLYRLFRKSNLKPFERDISTEIYQAGSTPCNGVEGFNCYFPLQSYGFQPTNGVGYQPYRVVVLSFELLHAPATVCGPKKSTNLVKNKCVNF",
        "hotspot_residues": ["E:417", "E:453", "E:455", "E:486", "E:505"],
        "description": "SARS-CoV-2 Spike RBD with ACE2 binding site hotspots",
    },
    "gfp": {
        "pdb_url": "https://files.rcsb.org/download/1EMA.pdb",
        "target_chain": "A",
        "target_sequence": "SKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTFSYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITHGMDELYK",
        "hotspot_residues": ["A:145", "A:148", "A:165", "A:167", "A:203"],
        "description": "Green Fluorescent Protein with top-of-barrel hotspots",
    },
    "lysozyme": {
        "pdb_url": "https://files.rcsb.org/download/1LYZ.pdb",
        "target_chain": "A",
        "target_sequence": "KVFGRCELAAAMKRHGLDNYRGYSLGNWVCAAKFESNFNTQATNRNTDGSTDYGILQINSRWWCNDGRTPGSRNLCNIPCSALLSSDITASVNCAKKIVSDGNGMNAWVAWRNRCKGTDVQAWIRGCRL",
        "hotspot_residues": ["A:18", "A:19", "A:21", "A:62", "A:63"],
        "description": "Hen egg-white lysozyme with active site cleft hotspots",
    },
}


def fetch_pdb(url: str) -> str:
    """Fetch PDB content from a URL."""
    print(f"  Fetching PDB from {url}...")
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read().decode("utf-8")

GPU_JOBS = {"rfdiffusion3", "proteinmpnn", "boltz2"}
JOB_ORDER = ["rfdiffusion3", "proteinmpnn", "boltz2", "score"]
EXTRA_JOBS: List[str] = []
JOB_CHOICES = JOB_ORDER + EXTRA_JOBS + ["all"]

FUNCTION_NAMES = {
    "rfdiffusion3": "run_rfdiffusion3",
    "proteinmpnn": "run_proteinmpnn",
    "boltz2": "run_boltz2",
    "score": "compute_scores",
}


def read_text(path: Path) -> str:
    return path.read_text().strip()


def read_sequence(path: Path) -> str:
    lines = [line.strip() for line in path.read_text().splitlines() if line.strip()]
    return "".join(line for line in lines if not line.startswith(">"))


LOCAL_FUNCTIONS = {
    "rfdiffusion3": run_rfdiffusion3,
    "proteinmpnn": run_proteinmpnn,
    "boltz2": run_boltz2,
    "score": compute_scores,
}


def build_payload(job: str, args: argparse.Namespace) -> Dict[str, object]:
    # Check if using a challenge target
    if args.target and args.target in CHALLENGE_TARGETS:
        challenge = CHALLENGE_TARGETS[args.target]
        print(f"  Using challenge target: {challenge['description']}")
        target_pdb = fetch_pdb(challenge["pdb_url"])
        target_sequence = challenge["target_sequence"]
        target_chain = challenge.get("target_chain")
        hotspot_residues = challenge.get("hotspot_residues", [])
    else:
        target_pdb = read_text(TARGET_PDB_PATH)
        target_sequence = TARGET_SEQUENCE
        target_chain = None
        hotspot_residues = []

    binder_pdb = read_text(BINDER_PDB_PATH)
    binder_seq = read_sequence(BINDER_SEQ_PATH)

    if job == "rfdiffusion3":
        payload = {
            "target_pdb": target_pdb,
            "target_sequence": target_sequence,
            "num_designs": args.designs,
            "sequences_per_backbone": args.sequences_per_backbone,
            "diffusion_steps": args.diffusion_steps,
            "boltz_samples": args.boltz_samples,
        }
        # Add target chain IDs to extract only the relevant chain
        if target_chain:
            payload["target_chain_ids"] = [target_chain]
            print(f"  Extracting only chain: {target_chain}")
        # Add hotspots if available and not disabled
        if hotspot_residues and not args.no_hotspots:
            payload["hotspot_residues"] = hotspot_residues
            print(f"  Using hotspots: {hotspot_residues}")
        return payload

    if job == "proteinmpnn":
        return {
            "backbone_pdb": binder_pdb,
            "num_sequences": args.mpnn_sequences,
        }

    if job == "boltz2":
        return {
            "target_pdb": target_pdb,
            "binder_pdb": binder_pdb,
            "binder_sequence": binder_seq,
            "num_samples": args.boltz_samples,
        }

    if job == "score":
        return {
            "design_pdb": read_text(COMPLEX_PDB_PATH),
            "target_pdb": target_pdb,
        }

    raise ValueError(f"Unsupported job: {job}")


def parse_jobs(selected: Iterable[str]) -> List[str]:
    chosen = list(selected)
    if "all" in chosen:
        return JOB_ORDER
    return chosen


def load_function_handles(mode: str, app_name: str, environment: str | None) -> Dict[str, object]:
    if mode == "local":
        return LOCAL_FUNCTIONS

    handles: Dict[str, object] = {}
    for job, fn_name in FUNCTION_NAMES.items():
        handles[job] = modal.Function.from_name(
            app_name,
            fn_name,
            environment_name=environment,
        )
    return handles


def main() -> None:
    target_choices = list(CHALLENGE_TARGETS.keys())
    parser = argparse.ArgumentParser(
        description="Manual Modal smoke tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run all tests with mini sample data (default)
  uv run python scripts/run_modal_smoketest.py --mode local

  # Run spike-rbd test with ACE2 hotspots
  uv run python scripts/run_modal_smoketest.py --jobs rfdiffusion3 --target spike-rbd --mode local

  # Run spike-rbd without hotspots (to compare)
  uv run python scripts/run_modal_smoketest.py --jobs rfdiffusion3 --target spike-rbd --no-hotspots --mode local

  # Run against deployed app
  uv run python scripts/run_modal_smoketest.py --jobs rfdiffusion3 --target spike-rbd --mode deployed
""",
    )
    parser.add_argument(
        "--jobs",
        nargs="+",
        choices=JOB_CHOICES,
        default=["all"],
        help="Which jobs to run (default: all)",
    )
    parser.add_argument(
        "--target",
        choices=target_choices,
        default=None,
        help=f"Use a real challenge target instead of mini sample data. Choices: {target_choices}",
    )
    parser.add_argument(
        "--no-hotspots",
        action="store_true",
        help="Disable hotspot residues even if the target has them defined",
    )
    parser.add_argument("--designs", type=int, default=1, help="RFDiffusion3 designs to request")
    parser.add_argument(
        "--sequences-per-backbone",
        type=int,
        default=2,
        help="ProteinMPNN sequences per RFDiffusion3 backbone",
    )
    parser.add_argument("--diffusion-steps", type=int, default=20, help="RFDiffusion3 steps")
    parser.add_argument("--boltz-samples", type=int, default=1, help="Boltz-2 samples")
    parser.add_argument("--mpnn-sequences", type=int, default=4, help="ProteinMPNN sequences")
    parser.add_argument(
        "--mode",
        choices=["local", "deployed"],
        default="local",
        help="Run against a local ephemeral app (`local`) or a deployed app (`deployed`).",
    )
    parser.add_argument(
        "--app-name",
        default="vibeproteins",
        help="Deployed Modal app name (only used when --mode=deployed).",
    )
    parser.add_argument(
        "--environment",
        default=None,
        help="Modal environment to target for deployed lookups.",
    )
    args = parser.parse_args()

    jobs_to_run = parse_jobs(args.jobs)
    if not jobs_to_run:
        print("No jobs selected. Nothing to do.")
        return

    if any(job in GPU_JOBS for job in jobs_to_run):
        print("⚠️  GPU-backed Modal calls may incur cost. This script should not run in CI.")

    handles = load_function_handles(args.mode, args.app_name, args.environment)

    def execute_jobs():
        for job in jobs_to_run:
            payload = build_payload(job, args)
            fn = handles[job]
            print(f"\n➡️  Running {job} …")
            result = fn.remote(**payload)
            print(json.dumps(result, indent=2))

    with modal.enable_output():
        if args.mode == "local":
            with app.run():
                execute_jobs()
        else:
            execute_jobs()

    print("\n✅ Completed Modal smoke test.")


if __name__ == "__main__":
    main()
