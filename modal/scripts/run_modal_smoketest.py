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

  # Run BoltzGen smoketest with a challenge target
  uv run python scripts/run_modal_smoketest.py --jobs boltzgen --target spike-rbd --mode local

  # Run BoltzGen with custom parameters
  uv run python scripts/run_modal_smoketest.py --jobs boltzgen --target lysozyme \
      --boltzgen-binder-length "60..80" --boltzgen-budget 5 --mode local

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

GPU_JOBS = {"rfdiffusion3", "proteinmpnn", "boltz2", "boltzgen", "mber_vhh", "mosaic_boltz2"}
JOB_ORDER = [
    "rfdiffusion3",
    "proteinmpnn",
    "boltz2",
    "boltzgen",
    "mosaic_trigram",
    "mosaic_boltz2",
    "mber_vhh",
    "score",
]
EXTRA_JOBS: List[str] = []
JOB_CHOICES = JOB_ORDER + EXTRA_JOBS + ["all"]

FUNCTION_NAMES = {
    "rfdiffusion3": "run_rfdiffusion3",
    "proteinmpnn": "run_proteinmpnn",
    "boltz2": "run_boltz2",
    "boltzgen": "run_boltzgen",
    "mosaic_trigram": "run_mosaic_trigram",
    "mosaic_boltz2": "run_mosaic_boltz2",
    "mber_vhh": "run_mber_vhh",
    "score": "compute_scores",
}


def read_text(path: Path) -> str:
    return path.read_text().strip()


def read_sequence(path: Path) -> str:
    lines = [line.strip() for line in path.read_text().splitlines() if line.strip()]
    return "".join(line for line in lines if not line.startswith(">"))


LOCAL_FUNCTIONS: Dict[str, object] = {}


def build_payload(job: str, args: argparse.Namespace) -> Dict[str, object]:
    selected_target = args.target
    if job in {"mber_vhh", "mosaic_boltz2"} and not selected_target:
        selected_target = "lysozyme"

    # Check if using a challenge target
    if selected_target and selected_target in CHALLENGE_TARGETS:
        challenge = CHALLENGE_TARGETS[selected_target]
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

    if job == "boltzgen":
        payload = {
            "target_pdb": target_pdb,
            "binder_length": args.boltzgen_binder_length,
            "protocol": args.boltzgen_protocol,
            "num_designs": args.boltzgen_num_designs,
            "budget": args.boltzgen_budget,
            "alpha": args.boltzgen_alpha,
        }
        # Add target chain IDs if specified
        if target_chain:
            payload["target_chain_ids"] = [target_chain]
            print(f"  Extracting only chain: {target_chain}")
        # Add binding residues from hotspots if available
        if hotspot_residues and not args.no_hotspots:
            # Convert hotspot format (e.g., "E:417") to binding residue format (e.g., "417")
            binding_residues = [hr.split(":")[-1] for hr in hotspot_residues]
            payload["binding_residues"] = binding_residues
            print(f"  Using binding residues: {binding_residues}")
        return payload

    if job == "mosaic_trigram":
        return {
            "sequence_length": args.mosaic_sequence_length,
            "n_steps": args.mosaic_steps,
            "stepsize": args.mosaic_stepsize,
            "momentum": args.mosaic_momentum,
        }

    if job == "mosaic_boltz2":
        return {
            "target_sequence": target_sequence,
            "target_chain_ids": [target_chain] if target_chain else None,
            "binder_length": args.mosaic_binder_length,
            "n_steps": args.mosaic_steps,
            "stepsize": args.mosaic_stepsize,
            "momentum": args.mosaic_momentum,
            "sharpen_steps": args.mosaic_sharpen_steps,
            "sharpen_stepsize": args.mosaic_sharpen_stepsize,
            "sharpen_scale": args.mosaic_sharpen_scale,
            "chunk_size": args.mosaic_chunk_size,
            "use_sequence_recovery": not args.mosaic_skip_sequence_recovery,
        }

    if job == "mber_vhh":
        return {
            "target_pdb": target_pdb,
            "target_chain_ids": [target_chain] if target_chain else None,
            "hotspot_residues": hotspot_residues if hotspot_residues else None,
            "num_accepted": args.mber_num_accepted,
            "max_trajectories": args.mber_max_trajectories,
            "min_iptm": args.mber_min_iptm,
            "min_plddt": args.mber_min_plddt,
            "skip_relax": args.mber_skip_relax,
        }

    raise ValueError(f"Unsupported job: {job}")


def parse_jobs(selected: Iterable[str]) -> List[str]:
    chosen = list(selected)
    if "all" in chosen:
        return JOB_ORDER
    return chosen


def load_function_handles(
    mode: str,
    app_name: str,
    environment: str | None,
) -> Dict[str, object]:
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

  # Run BoltzGen smoketest
  uv run python scripts/run_modal_smoketest.py --jobs boltzgen --target spike-rbd --mode local

  # Run BoltzGen with custom parameters
  uv run python scripts/run_modal_smoketest.py --jobs boltzgen --target lysozyme \\
      --boltzgen-binder-length "60..80" --boltzgen-budget 5 --mode local

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
    # BoltzGen arguments
    parser.add_argument(
        "--boltzgen-binder-length",
        type=str,
        default="80..100",
        help="BoltzGen binder length (e.g., '80..100' or '90')",
    )
    parser.add_argument(
        "--boltzgen-protocol",
        type=str,
        default="protein-anything",
        choices=["protein-anything", "peptide-anything", "nanobody-anything", "antibody-anything"],
        help="BoltzGen design protocol",
    )
    parser.add_argument("--boltzgen-num-designs", type=int, default=10, help="BoltzGen number of initial designs")
    parser.add_argument("--boltzgen-budget", type=int, default=3, help="BoltzGen budget (final designs to keep)")
    parser.add_argument("--boltzgen-alpha", type=float, default=0.01, help="BoltzGen alpha (quality vs diversity)")
    # Mosaic arguments
    parser.add_argument("--mosaic-sequence-length", type=int, default=80, help="Mosaic trigram sequence length")
    parser.add_argument("--mosaic-steps", type=int, default=25, help="Mosaic optimization steps")
    parser.add_argument("--mosaic-stepsize", type=float, default=0.1, help="Mosaic optimization step size")
    parser.add_argument("--mosaic-momentum", type=float, default=0.0, help="Mosaic optimization momentum")
    parser.add_argument("--mosaic-binder-length", type=int, default=45, help="Mosaic Boltz2 binder length")
    parser.add_argument("--mosaic-sharpen-steps", type=int, default=10, help="Mosaic Boltz2 sharpening steps")
    parser.add_argument("--mosaic-sharpen-stepsize", type=float, default=0.5, help="Mosaic Boltz2 sharpening step size")
    parser.add_argument("--mosaic-sharpen-scale", type=float, default=1.5, help="Mosaic Boltz2 sharpening scale")
    parser.add_argument("--mosaic-chunk-size", type=int, default=10, help="Mosaic checkpoint chunk size")
    parser.add_argument(
        "--mosaic-skip-sequence-recovery",
        action="store_true",
        help="Disable ProteinMPNN sequence recovery term in Mosaic Boltz2",
    )
    # mBER arguments
    parser.add_argument("--mber-num-accepted", type=int, default=1, help="mBER accepted designs to keep")
    parser.add_argument("--mber-max-trajectories", type=int, default=5, help="mBER max trajectories")
    parser.add_argument("--mber-min-iptm", type=float, default=0.5, help="mBER min iPTM filter")
    parser.add_argument("--mber-min-plddt", type=float, default=0.6, help="mBER min pLDDT filter")
    parser.add_argument("--mber-skip-relax", action="store_true", help="Skip Amber relaxation step")
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

    if args.mode == "local":
        from core.config import app  # noqa: E402

        def _register(job: str, func) -> None:
            if job in jobs_to_run:
                LOCAL_FUNCTIONS[job] = func

        if "rfdiffusion3" in jobs_to_run:
            from pipelines.rfdiffusion3 import run_rfdiffusion3  # noqa: E402

            _register("rfdiffusion3", run_rfdiffusion3)
        if "proteinmpnn" in jobs_to_run:
            from pipelines.proteinmpnn import run_proteinmpnn  # noqa: E402

            _register("proteinmpnn", run_proteinmpnn)
        if "boltz2" in jobs_to_run:
            from pipelines.boltz2 import run_boltz2  # noqa: E402

            _register("boltz2", run_boltz2)
        if "boltzgen" in jobs_to_run:
            from pipelines.boltzgen import run_boltzgen  # noqa: E402

            _register("boltzgen", run_boltzgen)
        if "mosaic_trigram" in jobs_to_run:
            from pipelines.mosaic import run_mosaic_trigram  # noqa: E402

            _register("mosaic_trigram", run_mosaic_trigram)
        if "mosaic_boltz2" in jobs_to_run:
            from pipelines.mosaic import run_mosaic_boltz2  # noqa: E402

            _register("mosaic_boltz2", run_mosaic_boltz2)
        if "mber_vhh" in jobs_to_run:
            from pipelines.mber import run_mber_vhh  # noqa: E402

            _register("mber_vhh", run_mber_vhh)
        if "score" in jobs_to_run:
            from pipelines.scoring import compute_scores  # noqa: E402

            _register("score", compute_scores)

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
