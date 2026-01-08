"""
Re-score failed reference binders with fixes:
- Fixed chain mappings for cAbHuL5, GFP Enhancer, Ranibizumab
- Larger GPU (A100) for OOM cases

Usage:
    cd modal && uv run modal run scripts/rescore_failed_binders.py
    cd modal && uv run modal run scripts/rescore_failed_binders.py --dry-run
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import modal

from core.config import app, cpu_image, r2_secret, boltz_image, BOLTZ_CACHE_DIR, BOLTZ_MODEL_VOLUME
from utils.metrics import compute_interface_metrics, chain_ids_from_structure
from utils.pdb import write_pdb_chains
from utils.boltz_helpers import _extract_chain_sequences, _clean_sequence, _select_chain_id, _write_boltz_yaml
from utils.ipsae import compute_interface_scores_from_boltz

# Binders to re-score (subset with issues)
BINDERS_TO_RESCORE = [
    # Pertuzumab: Use only ONE HER2 copy (B has more resolved residues: 568 vs 555)
    # Previous attempt with both A+B failed (no interface contacts)
    {"id": "pertuzumab-her2", "pdbId": "1S78", "binderChainId": "C,D", "targetChainId": "B", "name": "Pertuzumab"},
]


def download_pdb(pdb_id: str, output_path: Path) -> Path:
    """Download a PDB or mmCIF file from RCSB."""
    import urllib.request
    import urllib.error

    # Try PDB format first
    pdb_url = f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb"
    try:
        urllib.request.urlretrieve(pdb_url, output_path)
        return output_path
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise

    # Fall back to mmCIF format
    cif_url = f"https://files.rcsb.org/download/{pdb_id.upper()}.cif"
    cif_path = output_path.with_suffix(".cif")
    urllib.request.urlretrieve(cif_url, cif_path)
    return cif_path


def _deduplicate_chains_by_sequence(
    chain_sequences: list[tuple[str, str]],
    wanted_chain_ids: list[str]
) -> list[str]:
    """Select only one chain per unique sequence among wanted chains."""
    seen_sequences: dict[str, str] = {}
    for chain_id, seq in chain_sequences:
        if chain_id in wanted_chain_ids:
            if seq not in seen_sequences:
                seen_sequences[seq] = chain_id
    return list(seen_sequences.values())


@app.function(image=cpu_image, secrets=[r2_secret], timeout=120)
def prepare_binder(binder: dict) -> dict:
    """Download PDB and prepare data for Boltz-2 scoring."""
    pdb_id = binder["pdbId"]
    binder_chain_str = binder["binderChainId"]
    binder_chain_ids = [c.strip() for c in binder_chain_str.split(",") if c.strip()]

    # Optional explicit target chain(s)
    explicit_target = binder.get("targetChainId")
    explicit_target_ids = [c.strip() for c in explicit_target.split(",")] if explicit_target else None

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        try:
            pdb_path = tmpdir_path / f"{pdb_id}.pdb"
            complex_path = download_pdb(pdb_id, pdb_path)  # May return .cif path
        except Exception as e:
            return {"status": "failed", "reason": f"Download failed: {e}", "binder": binder}

        all_chains = list(chain_ids_from_structure(complex_path))
        all_sequences = _extract_chain_sequences(complex_path)

        # Target chains: explicit if provided, otherwise infer from structure
        if explicit_target_ids:
            raw_target_chain_ids = explicit_target_ids
        else:
            raw_target_chain_ids = [c for c in all_chains if c not in binder_chain_ids]

        if not raw_target_chain_ids:
            return {"status": "failed", "reason": "No target chains found", "binder": binder}

        # Deduplicate for multi-copy PDBs (skip if explicit target)
        if explicit_target_ids:
            target_chain_ids = explicit_target_ids
        else:
            target_chain_ids = _deduplicate_chains_by_sequence(all_sequences, raw_target_chain_ids)
        binder_chain_ids_dedup = _deduplicate_chains_by_sequence(all_sequences, binder_chain_ids)

        print(f"  Target chains: {raw_target_chain_ids} -> deduplicated: {target_chain_ids}")
        print(f"  Binder chains: {binder_chain_ids} -> deduplicated: {binder_chain_ids_dedup}")

        # Extract target structure
        target_path = tmpdir_path / "target.pdb"
        write_pdb_chains(complex_path, set(target_chain_ids), target_path)
        target_pdb_content = target_path.read_text()

        # Extract binder sequences
        binder_seq_tuples = [
            (chain_id, seq)
            for chain_id, seq in all_sequences
            if chain_id in binder_chain_ids_dedup
        ]

        if not binder_seq_tuples:
            return {"status": "failed", "reason": "Could not extract binder sequence", "binder": binder}

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
            result["binder_sequences"] = binder_seq_tuples
            print(f"  Multi-chain binder: {len(binder_seq_tuples)} chains")
        else:
            result["binder_sequence"] = binder_seq_tuples[0][1]

        return result


# Two versions of run_boltz2 - one for A10G, one for A100
@app.function(
    image=boltz_image,
    gpu="A10G",
    timeout=3600,
    secrets=[r2_secret],
    volumes={BOLTZ_CACHE_DIR: BOLTZ_MODEL_VOLUME},
)
def run_boltz2_a10g(prep: dict) -> dict:
    return _run_boltz2_impl(prep, "A10G")


@app.function(
    image=boltz_image,
    gpu="A100",
    timeout=3600,
    secrets=[r2_secret],
    volumes={BOLTZ_CACHE_DIR: BOLTZ_MODEL_VOLUME},
)
def run_boltz2_a100(prep: dict) -> dict:
    return _run_boltz2_impl(prep, "A100")


@app.function(
    image=boltz_image,
    gpu="H100",
    timeout=3600,
    secrets=[r2_secret],
    volumes={BOLTZ_CACHE_DIR: BOLTZ_MODEL_VOLUME},
)
def run_boltz2_h100(prep: dict) -> dict:
    return _run_boltz2_impl(prep, "H100")


def _run_boltz2_impl(prep: dict, gpu_type: str) -> dict:
    """Core Boltz-2 prediction logic."""
    import shutil
    import subprocess
    import time
    from boltz.main import download_boltz2

    from utils.boltz_helpers import _read_boltz_confidence, _select_boltz_prediction
    from utils.storage import upload_file, upload_bytes, object_url
    from core.config import RESULTS_PREFIX

    start_time = time.time()
    binder = prep["binder"]
    pdb_id = prep["pdb_id"]
    job_id = f"rescore_{pdb_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Write target PDB
        target_path = tmpdir_path / "target.pdb"
        target_path.write_text(prep["target_pdb_content"])

        target_sequences = _extract_chain_sequences(target_path)
        target_chain_ids = set(prep["target_chains"])

        # Handle binder input
        binder_seqs_processed = None
        binder_chain_ids = []

        if prep.get("is_multi_chain"):
            used_ids = set(target_chain_ids)
            binder_seqs_processed = []
            for orig_chain_id, seq in prep["binder_sequences"]:
                new_chain_id = _select_chain_id(used_ids)
                used_ids.add(new_chain_id)
                binder_seqs_processed.append((new_chain_id, _clean_sequence(seq)))
                binder_chain_ids.append(new_chain_id)
            print(f"[Boltz2] Multi-chain binder: {len(binder_seqs_processed)} chains with IDs {binder_chain_ids}")
            binder_seq = None
            binder_chain_id = None
        else:
            binder_seq = _clean_sequence(prep["binder_sequence"])
            binder_chain_id = _select_chain_id(target_chain_ids)
            binder_chain_ids = [binder_chain_id]

        input_name = "boltz_input"
        input_path = tmpdir_path / f"{input_name}.yaml"
        out_dir = tmpdir_path / "boltz_out"

        # Ensure cache
        cache_dir = Path(BOLTZ_CACHE_DIR)
        cache_dir.mkdir(parents=True, exist_ok=True)
        if not (cache_dir / "boltz2_conf.ckpt").exists():
            download_boltz2(cache_dir)

        # Write YAML (no MSA)
        _write_boltz_yaml(
            target_sequences=target_sequences,
            binder_sequence=binder_seq,
            binder_chain_id=binder_chain_id,
            output_path=input_path,
            use_msa_server=False,
            binder_sequences=binder_seqs_processed,
        )

        # Run Boltz-2
        cmd = [
            "boltz", "predict", str(input_path),
            "--out_dir", str(out_dir),
            "--cache", BOLTZ_CACHE_DIR,
            "--output_format", "pdb",
            "--diffusion_samples", "1",
            "--override",
            "--write_full_pae",
        ]
        subprocess.run(cmd, check=True)

        results_dir = out_dir / f"boltz_results_{input_name}"
        boltz_out_dir = results_dir if results_dir.exists() else out_dir

        prediction_path = _select_boltz_prediction(boltz_out_dir, input_name)
        confidence = _read_boltz_confidence(boltz_out_dir, input_name)

        # Compute metrics
        distance_metrics = compute_interface_metrics(prediction_path, target_chain_ids)
        ipsae_scores = compute_interface_scores_from_boltz(
            out_dir=boltz_out_dir,
            structure_path=prediction_path,
            input_name=input_name,
            target_chains=list(target_chain_ids),
            binder_chain=binder_chain_id,
            binder_chains=binder_chain_ids if len(binder_chain_ids) > 1 else None,
        )

        # Upload results
        complex_key = f"{RESULTS_PREFIX}/{job_id}/boltz2_complex.pdb"
        upload_file(prediction_path, complex_key, content_type="chemical/x-pdb")

        confidence_key = None
        if confidence:
            confidence_key = f"{RESULTS_PREFIX}/{job_id}/boltz2_confidence.json"
            upload_bytes(
                json.dumps(confidence, indent=2).encode("utf-8"),
                confidence_key,
                "application/json",
            )

    complex_plddt = confidence.get("complex_plddt") if confidence else None
    plddt = round(complex_plddt * 100, 2) if isinstance(complex_plddt, (float, int)) else None
    ptm = confidence.get("ptm") if confidence else None

    execution_seconds = round(time.time() - start_time, 2)

    return {
        "status": "completed",
        "id": binder["id"],
        "name": binder["name"],
        "pdb_id": pdb_id,
        "gpu_type": gpu_type,
        "execution_seconds": execution_seconds,
        "scores": {
            "plddt": plddt,
            "ptm": ptm,
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


@app.local_entrypoint()
def main(dry_run: bool = False):
    """Re-score failed binders."""
    print(f"Re-scoring {len(BINDERS_TO_RESCORE)} binders")

    if dry_run:
        print("\n=== DRY RUN ===")
        for b in BINDERS_TO_RESCORE:
            if b.get("needs_h100"):
                gpu = "H100"
            elif b.get("needs_a100"):
                gpu = "A100"
            else:
                gpu = "A10G"
            print(f"  {b['name']} (PDB: {b['pdbId']}, chains: {b['binderChainId']}, GPU: {gpu})")
        return

    results = []

    # Step 1: Prepare all binders
    print("\n=== Step 1: Preparing binders ===")
    prepared = []
    for i, binder in enumerate(BINDERS_TO_RESCORE):
        print(f"[{i+1}/{len(BINDERS_TO_RESCORE)}] Preparing {binder['name']}...")
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

    # Step 2: Run Boltz-2 predictions
    print("\n=== Step 2: Running Boltz-2 predictions ===")
    for i, prep in enumerate(prepared):
        binder = prep["binder"]
        needs_h100 = binder.get("needs_h100", False)
        needs_a100 = binder.get("needs_a100", False)

        if needs_h100:
            gpu = "H100"
        elif needs_a100:
            gpu = "A100"
        else:
            gpu = "A10G"

        print(f"[{i+1}/{len(prepared)}] Scoring {binder['name']} (GPU: {gpu})...")

        try:
            if needs_h100:
                boltz_result = run_boltz2_h100.remote(prep)
            elif needs_a100:
                boltz_result = run_boltz2_a100.remote(prep)
            else:
                boltz_result = run_boltz2_a10g.remote(prep)

            if boltz_result.get("status") == "completed":
                scores = boltz_result.get("scores", {})
                print(f"  ✓ pLDDT={scores.get('plddt', 'N/A')}, pDockQ={scores.get('pdockq', 'N/A'):.3f}")
                results.append(boltz_result)
            else:
                print(f"  ✗ {boltz_result.get('status')}")
                results.append(boltz_result)

        except Exception as e:
            print(f"  ✗ Error: {e}")
            results.append({
                "id": binder["id"],
                "name": binder["name"],
                "pdb_id": binder["pdbId"],
                "status": "error",
                "reason": str(e),
            })

    # Save results
    output_file = "rescore_results.json"
    print(f"\n=== Saving results to {output_file} ===")
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)

    # Summary
    completed = [r for r in results if r.get("status") == "completed"]
    failed = [r for r in results if r.get("status") in ("failed", "error")]

    print(f"\n=== Summary ===")
    print(f"Completed: {len(completed)}")
    print(f"Failed: {len(failed)}")

    if completed:
        print(f"\nCompleted binders:")
        for r in completed:
            scores = r.get("scores", {})
            pdockq = scores.get("pdockq", 0)
            status = "✓" if pdockq > 0.5 else "⚠" if pdockq > 0 else "✗"
            print(f"  {status} {r['name']}: pLDDT={scores.get('plddt', 'N/A')}, pDockQ={pdockq:.3f}")

    return results
