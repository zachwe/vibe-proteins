"""
Score reference binders using PDB structures.

Usage:
    cd modal && uv run modal run scripts/score_reference_binder.py --pdb-id 3K1K --binder-chains B --target-chains A
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import modal

from core.config import app, cpu_image, r2_secret
from utils.metrics import compute_interface_metrics, chain_ids_from_structure
from utils.pdb import write_pdb_chains
from pipelines.boltz2 import run_boltz2


def download_pdb(pdb_id: str, output_path: Path) -> Path:
    """Download a PDB file from RCSB."""
    import urllib.request

    url = f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb"
    urllib.request.urlretrieve(url, output_path)
    return output_path


@app.function(image=cpu_image, secrets=[r2_secret], timeout=120)
def prepare_and_score_crystal(
    pdb_id: str,
    binder_chain_ids: list[str],
    target_chain_ids: list[str] | None = None,
) -> dict:
    """
    Download PDB, extract chains, compute crystal structure metrics.
    Returns data needed for Boltz-2 prediction.
    """
    from utils.boltz_helpers import _extract_chain_sequences

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Download PDB structure
        print(f"Downloading PDB {pdb_id}...")
        complex_path = tmpdir_path / f"{pdb_id}.pdb"
        download_pdb(pdb_id, complex_path)

        # Get all chains in structure
        all_chains = list(chain_ids_from_structure(complex_path))
        print(f"Chains in structure: {all_chains}")

        # Determine target chains (everything not binder)
        if target_chain_ids is None:
            target_chain_ids = [c for c in all_chains if c not in binder_chain_ids]
        print(f"Binder chains: {binder_chain_ids}")
        print(f"Target chains: {target_chain_ids}")

        # Extract target-only structure
        target_path = tmpdir_path / "target.pdb"
        write_pdb_chains(complex_path, set(target_chain_ids), target_path)
        target_pdb_content = target_path.read_text()

        # Extract binder sequence
        all_sequences = _extract_chain_sequences(complex_path)
        binder_sequences = [
            seq for chain_id, seq in all_sequences
            if chain_id in binder_chain_ids
        ]
        binder_sequence = "".join(binder_sequences)
        print(f"Binder sequence length: {len(binder_sequence)}")

        # Compute distance-based interface metrics from crystal structure
        print("Computing interface metrics from crystal structure...")
        crystal_metrics = compute_interface_metrics(complex_path, target_chain_ids)
        print(f"Crystal structure metrics:")
        print(f"  interface_area: {crystal_metrics.get('interface_area', 0):.1f} Å²")
        print(f"  shape_complementarity: {crystal_metrics.get('shape_complementarity', 0):.3f}")
        print(f"  contact_count: {crystal_metrics.get('contact_count', 0)}")

        return {
            "pdb_id": pdb_id,
            "binder_chains": binder_chain_ids,
            "target_chains": target_chain_ids,
            "binder_sequence": binder_sequence,
            "target_pdb_content": target_pdb_content,
            "crystal_metrics": crystal_metrics,
        }


@app.local_entrypoint()
def main(
    pdb_id: str = "3K1K",
    binder_chains: str = "B",
    target_chains: str | None = None,
    skip_boltz: bool = False,
):
    """Score a reference binder from PDB."""
    binder_chain_ids = [c.strip() for c in binder_chains.split(",")]
    target_chain_ids = [c.strip() for c in target_chains.split(",")] if target_chains else None

    print(f"\nScoring PDB {pdb_id}")
    print(f"  Binder chains: {binder_chain_ids}")
    print(f"  Target chains: {target_chain_ids or 'auto-detect'}")
    print()

    # Step 1: Download and compute crystal metrics
    prep_result = prepare_and_score_crystal.remote(pdb_id, binder_chain_ids, target_chain_ids)
    crystal_metrics = prep_result["crystal_metrics"]

    print("\n" + "=" * 60)
    print("CRYSTAL STRUCTURE METRICS")
    print("=" * 60)
    print(f"Interface area: {crystal_metrics.get('interface_area', 0):.1f} Å²")
    print(f"Shape complementarity: {crystal_metrics.get('shape_complementarity', 0):.3f}")
    print(f"Contact count: {crystal_metrics.get('contact_count', 0)}")

    if skip_boltz:
        print("\nSkipping Boltz-2 prediction (--skip-boltz)")
        return prep_result

    # Step 2: Run Boltz-2 for PAE-based scores
    print("\n" + "=" * 60)
    print("RUNNING BOLTZ-2 PREDICTION")
    print("=" * 60)

    boltz_result = run_boltz2.remote(
        target_pdb=prep_result["target_pdb_content"],
        binder_sequence=prep_result["binder_sequence"],
        boltz_mode="complex",
        num_samples=1,
        job_id=f"ref_{pdb_id}",
        skip_msa_server=True,
    )

    print(f"\nBoltz-2 status: {boltz_result.get('status')}")

    if boltz_result.get("status") != "completed":
        print(f"FAILED: {boltz_result.get('error')}")
        return {
            "status": "failed",
            "pdb_id": pdb_id,
            "error": boltz_result.get("error"),
            "crystal_metrics": crystal_metrics,
        }

    # Combine results
    boltz_scores = boltz_result.get("scores", {})
    ipsae_scores = boltz_result.get("ipsae_scores", {})

    print("\n" + "=" * 60)
    print("FINAL SCORES")
    print("=" * 60)
    print(f"PDB: {pdb_id}")
    print(f"Binder chains: {prep_result['binder_chains']}")
    print(f"Target chains: {prep_result['target_chains']}")
    print()
    print("From Boltz-2 prediction:")
    print(f"  pLDDT: {boltz_scores.get('plddt', 'N/A')}")
    print(f"  pTM: {boltz_scores.get('ptm', 'N/A')}")
    print(f"  ipTM: {ipsae_scores.get('iptm', 'N/A')}")
    print(f"  ipSAE: {ipsae_scores.get('ipsae', 'N/A')}")
    print(f"  pDockQ: {ipsae_scores.get('pdockq', 'N/A')}")
    print(f"  pDockQ2: {ipsae_scores.get('pdockq2', 'N/A')}")
    print(f"  LIS: {ipsae_scores.get('lis', 'N/A')}")
    print(f"  Interface contacts: {ipsae_scores.get('n_interface_contacts', 'N/A')}")
    print()
    print("From crystal structure:")
    print(f"  Interface area: {crystal_metrics.get('interface_area', 0):.1f} Å²")
    print(f"  Shape complementarity: {crystal_metrics.get('shape_complementarity', 0):.3f}")

    return {
        "status": "completed",
        "pdb_id": pdb_id,
        "binder_chains": prep_result["binder_chains"],
        "target_chains": prep_result["target_chains"],
        "scores": {
            "plddt": boltz_scores.get("plddt"),
            "ptm": boltz_scores.get("ptm"),
            "iptm": ipsae_scores.get("iptm"),
            "ip_sae": ipsae_scores.get("ipsae"),
            "pdockq": ipsae_scores.get("pdockq"),
            "pdockq2": ipsae_scores.get("pdockq2"),
            "lis": ipsae_scores.get("lis"),
            "n_interface_contacts": ipsae_scores.get("n_interface_contacts"),
            "interface_area": crystal_metrics.get("interface_area"),
            "shape_complementarity": crystal_metrics.get("shape_complementarity"),
        },
        "crystal_metrics": crystal_metrics,
        "boltz_result": boltz_result,
    }
