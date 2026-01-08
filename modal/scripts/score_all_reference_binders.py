"""
Batch score all reference binders from their PDB structures.

Usage:
    cd modal && uv run modal run scripts/score_all_reference_binders.py
    cd modal && uv run modal run scripts/score_all_reference_binders.py --dry-run
    cd modal && uv run modal run scripts/score_all_reference_binders.py --limit 3
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import modal

from core.config import app, cpu_image, r2_secret
from utils.metrics import compute_interface_metrics, chain_ids_from_structure
from utils.pdb import write_pdb_chains
from pipelines.boltz2 import run_boltz2


# Path to reference binders JSON (relative to modal/ directory when running locally)
REFERENCE_BINDERS_PATH = Path(__file__).parent.parent.parent / "api/src/db/reference-binders.json"


def download_pdb(pdb_id: str, output_path: Path) -> Path:
    """Download a PDB file from RCSB."""
    import urllib.request
    url = f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb"
    urllib.request.urlretrieve(url, output_path)
    return output_path


def get_target_chains(binder: dict, all_chains: list[str]) -> list[str]:
    """Determine target chains (everything not in binder chains)."""
    binder_chains = binder.get("binderChainId", "").split(",")
    binder_chains = [c.strip() for c in binder_chains if c.strip()]
    return [c for c in all_chains if c not in binder_chains]


def _deduplicate_chains_by_sequence(
    chain_sequences: list[tuple[str, str]],
    wanted_chain_ids: list[str]
) -> list[str]:
    """
    For multi-copy PDBs, select only one chain per unique sequence.
    Returns the first chain ID for each unique sequence among wanted chains.
    """
    seen_sequences: dict[str, str] = {}  # sequence -> first chain_id
    for chain_id, seq in chain_sequences:
        if chain_id in wanted_chain_ids:
            if seq not in seen_sequences:
                seen_sequences[seq] = chain_id
    return list(seen_sequences.values())


@app.function(image=cpu_image, secrets=[r2_secret], timeout=120)
def prepare_binder(binder: dict) -> dict:
    """
    Download PDB and prepare data for Boltz-2 scoring.
    Handles multi-chain antibodies and multi-copy PDBs.
    """
    from utils.boltz_helpers import _extract_chain_sequences

    pdb_id = binder.get("pdbId")
    if not pdb_id:
        return {"status": "skipped", "reason": "No PDB ID", "binder": binder}

    binder_chain_str = binder.get("binderChainId", "")
    binder_chain_ids = [c.strip() for c in binder_chain_str.split(",") if c.strip()]

    if not binder_chain_ids:
        return {"status": "skipped", "reason": "No binder chain IDs", "binder": binder}

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        try:
            # Download PDB
            complex_path = tmpdir_path / f"{pdb_id}.pdb"
            download_pdb(pdb_id, complex_path)
        except Exception as e:
            return {"status": "failed", "reason": f"Download failed: {e}", "binder": binder}

        # Get all chains and sequences
        all_chains = list(chain_ids_from_structure(complex_path))
        all_sequences = _extract_chain_sequences(complex_path)

        # Determine target chains (everything not in binder chains)
        raw_target_chain_ids = get_target_chains(binder, all_chains)

        if not raw_target_chain_ids:
            return {"status": "failed", "reason": "No target chains found", "binder": binder}

        # Handle multi-copy PDBs by deduplicating target chains
        target_chain_ids = _deduplicate_chains_by_sequence(all_sequences, raw_target_chain_ids)
        print(f"  Target chains: {raw_target_chain_ids} -> deduplicated: {target_chain_ids}")

        # Extract target structure (only deduplicated chains)
        target_path = tmpdir_path / "target.pdb"
        write_pdb_chains(complex_path, set(target_chain_ids), target_path)
        target_pdb_content = target_path.read_text()

        # Handle multi-copy PDBs: deduplicate binder chains too
        binder_chain_ids_dedup = _deduplicate_chains_by_sequence(all_sequences, binder_chain_ids)
        print(f"  Binder chains: {binder_chain_ids} -> deduplicated: {binder_chain_ids_dedup}")

        # Extract binder sequences - keep as list of (chain_id, seq) for multi-chain binders
        binder_seq_tuples = [
            (chain_id, seq)
            for chain_id, seq in all_sequences
            if chain_id in binder_chain_ids_dedup
        ]

        if not binder_seq_tuples:
            return {"status": "failed", "reason": "Could not extract binder sequence", "binder": binder}

        # Determine if this is a multi-chain binder (e.g., antibody H+L)
        is_multi_chain = len(binder_seq_tuples) > 1
        total_binder_length = sum(len(seq) for _, seq in binder_seq_tuples)

        # Compute crystal structure metrics
        crystal_metrics = compute_interface_metrics(complex_path, target_chain_ids)

        result = {
            "status": "prepared",
            "binder": binder,
            "pdb_id": pdb_id,
            "binder_chains": binder_chain_ids_dedup,
            "target_chains": target_chain_ids,
            "binder_sequence_length": total_binder_length,
            "target_pdb_content": target_pdb_content,
            "crystal_metrics": crystal_metrics,
            "is_multi_chain": is_multi_chain,
        }

        if is_multi_chain:
            # Multi-chain binder (antibody): pass sequences separately
            result["binder_sequences"] = binder_seq_tuples
            print(f"  Multi-chain binder: {len(binder_seq_tuples)} chains, {[len(s) for _, s in binder_seq_tuples]} aa each")
        else:
            # Single-chain binder (nanobody): pass concatenated sequence
            result["binder_sequence"] = binder_seq_tuples[0][1]

        return result


@app.local_entrypoint()
def main(
    dry_run: bool = False,
    limit: int = 0,
    output_file: str = "reference_binder_scores.json",
):
    """Score all reference binders."""

    # Load reference binders
    with open(REFERENCE_BINDERS_PATH) as f:
        binders = json.load(f)

    print(f"Loaded {len(binders)} reference binders")

    if limit > 0:
        binders = binders[:limit]
        print(f"Limited to first {limit} binders")

    # Filter to those with PDB IDs
    binders_with_pdb = [b for b in binders if b.get("pdbId")]
    print(f"Found {len(binders_with_pdb)} binders with PDB IDs")

    if dry_run:
        print("\n=== DRY RUN - Would score these binders ===")
        for b in binders_with_pdb:
            print(f"  {b['name']} (PDB: {b['pdbId']}, chains: {b.get('binderChainId', '?')})")
        return

    results = []

    # Step 1: Prepare all binders (download PDBs, extract sequences)
    print("\n=== Step 1: Preparing binders ===")
    prepared = []
    for i, binder in enumerate(binders_with_pdb):
        print(f"[{i+1}/{len(binders_with_pdb)}] Preparing {binder['name']}...")
        prep_result = prepare_binder.remote(binder)

        if prep_result["status"] == "prepared":
            prepared.append(prep_result)
            print(f"  ✓ Ready (binder: {prep_result['binder_sequence_length']} aa)")
        else:
            print(f"  ✗ {prep_result['status']}: {prep_result.get('reason', 'Unknown')}")
            results.append({
                "id": binder["id"],
                "name": binder["name"],
                "status": prep_result["status"],
                "reason": prep_result.get("reason"),
            })

    print(f"\n{len(prepared)} binders ready for scoring")

    # Step 2: Run Boltz-2 on each prepared binder
    print("\n=== Step 2: Running Boltz-2 predictions ===")
    for i, prep in enumerate(prepared):
        binder = prep["binder"]
        is_multi = prep.get("is_multi_chain", False)
        chain_info = f"{len(prep.get('binder_sequences', []))} chains" if is_multi else "1 chain"
        print(f"[{i+1}/{len(prepared)}] Scoring {binder['name']} ({chain_info})...")

        try:
            # Build Boltz-2 arguments based on binder type
            boltz_args = {
                "target_pdb": prep["target_pdb_content"],
                "boltz_mode": "complex",
                "num_samples": 1,
                "job_id": f"ref_{prep['pdb_id']}",
                "skip_msa_server": True,
            }

            if is_multi:
                # Multi-chain binder (antibody): pass sequences as list of tuples
                boltz_args["binder_sequences"] = prep["binder_sequences"]
            else:
                # Single-chain binder (nanobody): pass single sequence
                boltz_args["binder_sequence"] = prep["binder_sequence"]

            boltz_result = run_boltz2.remote(**boltz_args)

            if boltz_result.get("status") == "completed":
                boltz_scores = boltz_result.get("scores", {})
                ipsae_scores = boltz_result.get("ipsae_scores", {})

                result = {
                    "id": binder["id"],
                    "name": binder["name"],
                    "pdb_id": prep["pdb_id"],
                    "status": "completed",
                    "scores": {
                        "plddt": boltz_scores.get("plddt"),
                        "ptm": boltz_scores.get("ptm"),
                        "iptm": ipsae_scores.get("iptm"),
                        "ipSaeScore": ipsae_scores.get("ipsae"),
                        "pdockq": ipsae_scores.get("pdockq"),
                        "pdockq2": ipsae_scores.get("pdockq2"),
                        "lis": ipsae_scores.get("lis"),
                        "n_interface_contacts": ipsae_scores.get("n_interface_contacts"),
                        "interfaceArea": prep["crystal_metrics"].get("interface_area"),
                        "shapeComplementarity": prep["crystal_metrics"].get("shape_complementarity"),
                    },
                }
                print(f"  ✓ pLDDT={boltz_scores.get('plddt', 'N/A'):.1f}, pDockQ={ipsae_scores.get('pdockq', 'N/A'):.3f}")
            else:
                result = {
                    "id": binder["id"],
                    "name": binder["name"],
                    "pdb_id": prep["pdb_id"],
                    "status": "failed",
                    "reason": boltz_result.get("error", "Boltz-2 failed"),
                }
                print(f"  ✗ {result['reason']}")

        except Exception as e:
            result = {
                "id": binder["id"],
                "name": binder["name"],
                "pdb_id": prep["pdb_id"],
                "status": "error",
                "reason": str(e),
            }
            print(f"  ✗ Error: {e}")

        results.append(result)

    # Save results
    print(f"\n=== Saving results to {output_file} ===")
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)

    # Summary
    completed = [r for r in results if r.get("status") == "completed"]
    failed = [r for r in results if r.get("status") in ("failed", "error")]
    skipped = [r for r in results if r.get("status") == "skipped"]

    print(f"\n=== Summary ===")
    print(f"Completed: {len(completed)}")
    print(f"Failed: {len(failed)}")
    print(f"Skipped: {len(skipped)}")

    if completed:
        print(f"\nCompleted binders:")
        for r in completed:
            scores = r.get("scores", {})
            print(f"  {r['name']}: pLDDT={scores.get('plddt', 'N/A')}, pDockQ={scores.get('pdockq', 'N/A')}")

    return results
