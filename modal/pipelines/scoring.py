"""
Scoring and structure prediction pipelines.
"""

from __future__ import annotations

import tempfile
import time
import uuid
from pathlib import Path

from core.config import (
    app,
    gpu_image,
    cpu_image,
    r2_secret,
)
from core.job_status import send_progress, send_completion
from pipelines.proteinmpnn import rng_from_job
from pipelines.boltz2 import run_boltz2
from utils.boltz_helpers import _clean_sequence, _extract_chain_sequences
from utils.metrics import chain_ids_from_structure, compute_interface_metrics
from utils.pdb import write_pdb_chains
from utils.storage import download_to_path


@app.function(image=gpu_image, gpu="A10G", timeout=1200, secrets=[r2_secret])
def run_structure_prediction(
    sequence: str,
    target_sequence: str | None = None,
    job_id: str | None = None,
) -> dict:
    """
    Placeholder structure prediction hook - returns a stub response for now.
    """
    start_time = time.time()
    gpu_type = "A10G"

    job_id = job_id or str(uuid.uuid4())
    rng = rng_from_job(job_id)
    mock_scores = {
        "plddt": round(65 + rng.random() * 15, 2),
        "ptm": round(0.5 + rng.random() * 0.3, 3),
    }

    execution_seconds = round(time.time() - start_time, 2)

    return {
        "status": "completed",
        "job_id": job_id,
        "sequence": sequence,
        "target_sequence": target_sequence,
        "scores": mock_scores,
        "usage": {
            "gpu_type": gpu_type,
            "execution_seconds": execution_seconds,
        },
    }


@app.function(image=cpu_image, secrets=[r2_secret])
def compute_scores(
    design_pdb: str,
    target_pdb: str,
    job_id: str | None = None,
    binder_sequence: str | None = None,
    target_chain_ids: list[str] | None = None,
    use_msa_server: bool | None = None,
) -> dict:
    """
    Score a protein design using Boltz-2 PAE-based ipSAE metrics.

    Runs Boltz-2 structure prediction to get PAE matrix for accurate ipSAE scoring.
    Returns failed status if Boltz-2 scoring fails.

    Args:
        design_pdb: URL/path to design structure (binder + target complex)
        target_pdb: URL/path to target structure
        job_id: Optional job ID for tracking
        binder_sequence: Optional binder sequence
        target_chain_ids: Optional list of target chain IDs
        use_msa_server: Whether to use MSA server
    """
    start_time = time.time()
    job_id = job_id or str(uuid.uuid4())

    send_progress(job_id, "init", "Preparing structures for scoring")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        design_path = download_to_path(design_pdb, tmpdir_path / "design.pdb")
        target_path = download_to_path(target_pdb, tmpdir_path / "target.pdb")

        if target_chain_ids:
            filtered_target_path = tmpdir_path / "target_filtered.pdb"
            write_pdb_chains(target_path, set(target_chain_ids), filtered_target_path)
            target_path = filtered_target_path

        # Get target chain IDs for interface analysis
        target_chain_ids = list(chain_ids_from_structure(target_path))
        if not target_chain_ids:
            return {
                "status": "failed",
                "job_id": job_id,
                "error": "Target structure contains no chains after filtering",
            }

        binder_sequence = _clean_sequence(binder_sequence) if binder_sequence else ""
        if not binder_sequence:
            # Extract binder sequence from design
            design_sequences = _extract_chain_sequences(design_path)
            binder_sequences = [
                (chain_id, seq) for chain_id, seq in design_sequences
                if chain_id not in target_chain_ids
            ]

            if not binder_sequences:
                # All chains are in target - can't determine binder
                return {
                    "status": "failed",
                    "job_id": job_id,
                    "error": "Could not identify binder chain in design structure",
                }

            binder_sequence = binder_sequences[0][1]

        # Compute distance-based metrics (always available as fallback)
        distance_metrics = compute_interface_metrics(design_path, target_chain_ids)

        # Run Boltz-2 PAE-based scoring
        ipsae_scores = None
        boltz_result = None
        boltz_error = None

        send_progress(job_id, "boltz", "Running Boltz-2 structure prediction for scoring")

        try:
            # Read target PDB content for Boltz
            target_pdb_content = target_path.read_text()

            # Run Boltz-2 to get PAE-based scores
            boltz_result = run_boltz2.remote(
                target_pdb=target_pdb_content,
                binder_sequence=binder_sequence,
                boltz_mode="complex",
                num_samples=1,
                job_id=f"{job_id}_boltz",
                skip_msa_server=not (True if use_msa_server is None else use_msa_server),
            )

            if boltz_result.get("status") == "completed":
                ipsae_scores = boltz_result.get("ipsae_scores", {})
            else:
                boltz_error = boltz_result.get("error", "Boltz-2 prediction failed")

        except Exception as e:
            boltz_error = str(e)
            print(f"Boltz-2 scoring failed: {e}")

    execution_seconds = round(time.time() - start_time, 2)

    # Fail if Boltz-2 didn't produce valid scores
    if not ipsae_scores or ipsae_scores.get("n_interface_contacts", 0) == 0:
        result = {
            "status": "failed",
            "job_id": job_id,
            "error": boltz_error or "Boltz-2 scoring produced no interface contacts",
            "distance_metrics": distance_metrics,  # Include for debugging
            "usage": {
                "gpu_type": "A10G",
                "execution_seconds": execution_seconds,
            },
        }
        send_completion(job_id, status="failed", output=result, error=result["error"])
        return result

    # Build scores from PAE-based metrics
    scores = {
        "ip_sae": ipsae_scores.get("ipsae", 0.0),
        "iptm": ipsae_scores.get("iptm", 0.0),
        "pdockq": ipsae_scores.get("pdockq", 0.0),
        "pdockq2": ipsae_scores.get("pdockq2", 0.0),
        "lis": ipsae_scores.get("lis", 0.0),
        "interface_area": distance_metrics.get("interface_area", 0.0),
        "shape_complementarity": distance_metrics.get("shape_complementarity", 0.0),
        "n_interface_contacts": ipsae_scores.get("n_interface_contacts", 0),
    }

    # Include pLDDT/pTM from Boltz
    if boltz_result:
        boltz_scores = boltz_result.get("scores", {})
        if boltz_scores.get("plddt"):
            scores["plddt"] = boltz_scores["plddt"]
        if boltz_scores.get("ptm"):
            scores["ptm"] = boltz_scores["ptm"]

    result = {
        "status": "completed",
        "job_id": job_id,
        "scores": scores,
        "distance_metrics": distance_metrics,
        "ipsae_scores": ipsae_scores,
        "usage": {
            "gpu_type": "A10G",
            "execution_seconds": execution_seconds,
        },
    }
    send_completion(job_id, status="completed", output=result, usage=result["usage"])
    return result
