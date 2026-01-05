"""
Boltz-2 structure prediction pipeline.
"""

from __future__ import annotations

import json
import shlex
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

from core.config import (
    app,
    boltz_image,
    r2_secret,
    BOLTZ_CACHE_DIR,
    BOLTZ_MODEL_VOLUME,
    BOLTZ_USE_MSA_SERVER,
    BOLTZ_MSA_TIMEOUT_SECONDS,
    BOLTZ_EXTRA_ARGS,
    RESULTS_PREFIX,
)
from core.job_status import send_progress, send_completion
from utils.boltz_helpers import (
    _clean_sequence,
    _extract_chain_sequences,
    _read_boltz_confidence,
    _select_boltz_prediction,
    _select_chain_id,
    _write_boltz_yaml,
)
from utils.ipsae import compute_interface_scores_from_boltz
from utils.metrics import compute_interface_metrics
from utils.storage import download_to_path, object_url, upload_bytes, upload_file


def ensure_boltz2_cache(cache_dir: Path) -> None:
    """Ensure Boltz-2 model weights are downloaded."""
    from boltz.main import download_boltz2

    cache_dir.mkdir(parents=True, exist_ok=True)
    if not (cache_dir / "boltz2_conf.ckpt").exists():
        download_boltz2(cache_dir)


def run_boltz_prediction(
    input_path: Path,
    out_dir: Path,
    num_samples: int,
    use_msa_server: bool,
    timeout_seconds: int | None = None,
) -> subprocess.CompletedProcess:
    """
    Run Boltz-2 prediction with optional timeout.
    """
    cmd = [
        "boltz",
        "predict",
        str(input_path),
        "--out_dir",
        str(out_dir),
        "--cache",
        BOLTZ_CACHE_DIR,
        "--output_format",
        "pdb",
        "--diffusion_samples",
        str(num_samples),
        "--override",
        "--write_full_pae",
    ]
    if use_msa_server:
        cmd.append("--use_msa_server")
    if BOLTZ_EXTRA_ARGS:
        cmd.extend(shlex.split(BOLTZ_EXTRA_ARGS))

    return subprocess.run(cmd, check=True, timeout=timeout_seconds)


@app.function(
    image=boltz_image,
    gpu="A10G",
    timeout=3600,
    secrets=[r2_secret],
    volumes={BOLTZ_CACHE_DIR: BOLTZ_MODEL_VOLUME},
)
def run_boltz2(
    target_pdb: str,
    binder_pdb: str | None = None,
    binder_sequence: str | None = None,
    boltz_mode: str = "complex",
    num_samples: int = 1,
    job_id: str | None = None,
    use_self_hosted_msa: bool = False,
    msa_paths: dict[str, str] | None = None,
    skip_msa_server: bool = False,
) -> dict:
    """
    Boltz-2 structure prediction with optional PAE-based scoring.
    """
    start_time = time.time()
    gpu_type = "A10G"

    job_id = job_id or str(uuid.uuid4())
    num_samples = max(int(num_samples), 1)

    send_progress(job_id, "boltz2", "Starting Boltz-2 prediction")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        target_path = download_to_path(target_pdb, tmpdir_path / "target.pdb")

        target_sequences = _extract_chain_sequences(target_path)
        if not target_sequences:
            raise ValueError("No protein chains found in target PDB.")
        target_chain_ids = {chain_id for chain_id, _ in target_sequences}

        binder_seq = _clean_sequence(binder_sequence) if binder_sequence else ""
        if not binder_seq and binder_pdb:
            binder_path = download_to_path(binder_pdb, tmpdir_path / "binder.pdb")
            binder_sequences = _extract_chain_sequences(binder_path)
            if binder_sequences:
                binder_seq = binder_sequences[0][1]

        if not binder_seq:
            raise ValueError("A binder_sequence or binder_pdb with a protein chain is required.")

        binder_chain_id = _select_chain_id(target_chain_ids)
        input_name = "boltz_input"
        input_path = tmpdir_path / f"{input_name}.yaml"
        out_dir = tmpdir_path / "boltz_out"

        ensure_boltz2_cache(Path(BOLTZ_CACHE_DIR))

        # Determine MSA strategy
        use_msa_server = BOLTZ_USE_MSA_SERVER and not use_self_hosted_msa and not skip_msa_server
        msa_mode_used = "none"

        if use_msa_server:
            send_progress(job_id, "boltz2", "Running with MSA server")

            _write_boltz_yaml(
                target_sequences=target_sequences,
                binder_sequence=binder_seq,
                binder_chain_id=binder_chain_id,
                output_path=input_path,
                use_msa_server=True,
                msa_paths=msa_paths,
            )

            try:
                run_boltz_prediction(
                    input_path=input_path,
                    out_dir=out_dir,
                    num_samples=num_samples,
                    use_msa_server=True,
                    timeout_seconds=BOLTZ_MSA_TIMEOUT_SECONDS,
                )
                msa_mode_used = "public_server"

            except subprocess.TimeoutExpired:
                print(f"MSA server timed out after {BOLTZ_MSA_TIMEOUT_SECONDS}s. Falling back to no MSA...")
                use_msa_server = False

            except subprocess.CalledProcessError as e:
                print(f"Boltz-2 with MSA server failed: {e}. Falling back to no MSA...")
                use_msa_server = False

        if not use_msa_server or msa_mode_used == "none":
            if msa_mode_used == "none":
                send_progress(job_id, "boltz2", "Running without MSA server")

            _write_boltz_yaml(
                target_sequences=target_sequences,
                binder_sequence=binder_seq,
                binder_chain_id=binder_chain_id,
                output_path=input_path,
                use_msa_server=False,
                msa_paths=msa_paths,
            )

            if out_dir.exists():
                shutil.rmtree(out_dir, ignore_errors=True)

            run_boltz_prediction(
                input_path=input_path,
                out_dir=out_dir,
                num_samples=num_samples,
                use_msa_server=False,
                timeout_seconds=None,
            )
            msa_mode_used = "none"

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
        )

        # Upload results
        complex_ext = prediction_path.suffix.lower() or ".pdb"
        complex_key = f"{RESULTS_PREFIX}/{job_id}/boltz2_complex{complex_ext}"
        content_type = "chemical/x-mmcif" if complex_ext == ".cif" else "chemical/x-pdb"
        upload_file(prediction_path, complex_key, content_type=content_type)

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
    iptm_confidence = confidence.get("iptm") if confidence else None
    ptm = confidence.get("ptm") if confidence else None

    boltz_summary = {
        "samples": num_samples,
        "iptm": iptm_confidence,
        "ptm": ptm,
        "plddt": plddt,
        "confidence_score": confidence.get("confidence_score") if confidence else None,
        "msa_mode": msa_mode_used,
    }

    scores = {
        "plddt": plddt,
        "ptm": ptm,
        "iptm": iptm_confidence,
        "ipsae": ipsae_scores.get("ipsae"),
        "ipsae_iptm": ipsae_scores.get("iptm"),
        "pdockq": ipsae_scores.get("pdockq"),
        "pdockq2": ipsae_scores.get("pdockq2"),
        "lis": ipsae_scores.get("lis"),
        "n_interface_contacts": ipsae_scores.get("n_interface_contacts"),
        "shapeComplementarity": distance_metrics.get("shape_complementarity"),
        "buriedSurfaceArea": distance_metrics.get("interface_area"),
    }

    execution_seconds = round(time.time() - start_time, 2)

    result = {
        "status": "completed",
        "job_id": job_id,
        "mode": boltz_mode,
        "scores": {key: value for key, value in scores.items() if value is not None},
        "ipsae_scores": ipsae_scores,
        "interface_metrics": distance_metrics,
        "boltz2": {key: value for key, value in boltz_summary.items() if value is not None},
        "complex": {"key": complex_key, "url": object_url(complex_key)},
        "structureUrl": object_url(complex_key),
        "confidence": {"key": confidence_key, "url": object_url(confidence_key)} if confidence_key else None,
        "designName": "Boltz-2 prediction",
        "msa_mode": msa_mode_used,
        "usage": {
            "gpu_type": gpu_type,
            "execution_seconds": execution_seconds,
        },
    }

    send_completion(job_id, status="completed", output=result, usage=result.get("usage"))

    return result
