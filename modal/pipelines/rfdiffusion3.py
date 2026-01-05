"""
RFdiffusion3 binder design pipeline.
"""

from __future__ import annotations

import json
import math
import os
import re
import shlex
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import List
import random

from core.config import (
    app,
    rfdiffusion3_image,
    r2_secret,
    RFD3_MODELS_DIR,
    RFD3_MODEL_VOLUME,
    RFD3_CHECKPOINT_FILENAME,
    RFD3_HOTSPOT_ATOMS,
    RFD3_LOW_MEMORY_MODE,
    RFD3_EXTRA_ARGS,
    RFD3_MAX_BATCH_SIZE,
    RESULTS_PREFIX,
)
from core.job_status import send_progress, send_completion
from pipelines.proteinmpnn import run_proteinmpnn, rng_from_job, resolve_structure_source
from pipelines.boltz2 import run_boltz2
from utils.boltz_helpers import _extract_chain_sequences
from utils.metrics import chain_ids_from_structure, compute_interface_metrics
from utils.rfd3_shim import RMSNORM_SHIM, ensure_rmsnorm
from utils.storage import download_to_path, object_url, upload_bytes, upload_file
from utils.pdb import (
    chain_residue_segments_from_pdb,
    ordered_chain_ids_from_pdb,
    write_pdb_chains,
    cif_to_pdb,
    match_output_target_chains,
    tail_file,
)


CURRENT_DIR = Path(__file__).resolve().parent.parent


def rfd3_hotspot_selection(
    hotspots: list[str] | None,
    default_chain: str,
    atoms: str,
) -> dict[str, str] | None:
    """Build hotspot selection dict for RFD3."""
    if not hotspots:
        return None
    atoms = atoms.strip() or "ALL"
    selection: dict[str, str] = {}
    for residue in hotspots:
        if not residue:
            continue
        match = re.search(r"([A-Za-z])\s*[:\-_/]?\s*(\d+)", residue)
        if match:
            chain_id, res_id = match.groups()
        elif residue.isdigit():
            chain_id, res_id = default_chain, residue
        else:
            continue
        selection[f"{chain_id.upper()}{int(res_id)}"] = atoms
    return selection or None


def rfd3_contig_string(
    ordered_chain_ids: List[str],
    chain_segments: dict[str, list[tuple[int, int]]],
    binder_length: int | str,
) -> str:
    """Build contig string for RFD3 input."""
    if isinstance(binder_length, str):
        cleaned = binder_length.strip()
        if "-" in cleaned:
            binder_range = cleaned.replace(" ", "")
        else:
            binder_range = f"{int(cleaned)}-{int(cleaned)}"
    else:
        binder_range = f"{int(binder_length)}-{int(binder_length)}"

    target_tokens: List[str] = []
    for chain_id in ordered_chain_ids:
        segments = chain_segments.get(chain_id) or []
        if not segments:
            continue
        if target_tokens:
            target_tokens.append("/0")
        for start, end in segments:
            if start == end:
                target_tokens.append(f"{chain_id}{start}")
            else:
                target_tokens.append(f"{chain_id}{start}-{end}")

    if not target_tokens:
        return binder_range
    return f"{binder_range},/0," + ",".join(target_tokens)


def ensure_rfd3_models(models_dir: Path) -> None:
    """Ensure RFD3 model weights are downloaded."""
    models_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = models_dir / RFD3_CHECKPOINT_FILENAME
    if checkpoint_path.exists():
        return
    subprocess.run(
        ["foundry", "install", "rfd3", "--checkpoint-dir", str(models_dir)],
        check=True,
    )


def extract_rfd3_error(log_path: Path) -> str:
    """Extract relevant error message from RFD3 log."""
    if not log_path.exists():
        return ""
    text = log_path.read_text(errors="replace")
    for token in (
        "OutOfMemoryError",
        "CUDA out of memory",
        "RuntimeError",
        "ModuleNotFoundError",
        "ImportError",
        "AttributeError",
        "InstantiationException",
        "Traceback",
    ):
        idx = text.rfind(token)
        if idx != -1:
            start = max(0, idx - 4000)
            return text[start:]
    return tail_file(log_path)


@app.function(
    image=rfdiffusion3_image,
    gpu="A10G",
    timeout=7200,
    secrets=[r2_secret],
    volumes={RFD3_MODELS_DIR: RFD3_MODEL_VOLUME},
)
def run_rfdiffusion3(
    target_pdb: str | None = None,
    target_structure_url: str | None = None,
    target_sequence: str | None = None,
    target_chain_ids: list[str] | None = None,
    hotspot_residues: list[str] | None = None,
    num_designs: int = 2,
    binder_length: int = 85,
    sequences_per_backbone: int = 4,
    diffusion_steps: int = 200,
    boltz_samples: int = 1,
    binder_seeds: int | None = None,
    job_id: str | None = None,
    challenge_id: str | None = None,
) -> dict:
    """
    RFdiffusion3 (RFD3) + ProteinMPNN + Boltz-2 pipeline for binder design.
    """
    start_time = time.time()
    gpu_type = "A10G"

    job_id = job_id or str(uuid.uuid4())
    rng = rng_from_job(job_id)

    send_progress(job_id, "init", "Preparing target structure")

    target_source = resolve_structure_source(target_pdb, target_structure_url)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        raw_target_path = download_to_path(target_source, tmpdir_path / "target_raw.pdb")

        # If specific chains are requested, extract only those
        if target_chain_ids:
            target_path = tmpdir_path / "target.pdb"
            write_pdb_chains(raw_target_path, set(target_chain_ids), target_path)
        else:
            target_path = raw_target_path

        chain_segments = chain_residue_segments_from_pdb(target_path)
        if not chain_segments:
            raise ValueError("Target PDB does not contain any protein chains.")
        ordered_chains = ordered_chain_ids_from_pdb(target_path)
        pdb_chain_ids = set(chain_segments.keys())
        default_chain_id = next(
            (chain_id for chain_id in ordered_chains if chain_id in pdb_chain_ids),
            None,
        )
        if not default_chain_id:
            raise ValueError("Target PDB does not contain any protein chains.")

        target_sequences = _extract_chain_sequences(target_path)

        contig_str = rfd3_contig_string(ordered_chains, chain_segments, binder_length)
        hotspot_selection = rfd3_hotspot_selection(
            hotspot_residues,
            default_chain_id,
            RFD3_HOTSPOT_ATOMS,
        )

        spec: dict = {
            "dialect": 2,
            "infer_ori_strategy": "hotspots" if hotspot_selection else "com",
            "input": str(target_path),
            "contig": contig_str,
            "is_non_loopy": True,
        }
        if hotspot_selection:
            spec["select_hotspots"] = hotspot_selection

        input_payload = {"design": spec}
        input_path = tmpdir_path / "rfd3_inputs.json"
        input_path.write_text(json.dumps(input_payload, indent=2))

        ensure_rfd3_models(RFD3_MODELS_DIR)
        ensure_rmsnorm()

        try:
            from rfd3.model.RFD3 import RFD3  # noqa: F401
        except Exception as exc:
            raise RuntimeError(f"Failed to import RFD3 model: {exc}") from exc

        num_designs = max(int(num_designs), 1)
        batch_size = max(1, min(RFD3_MAX_BATCH_SIZE, num_designs))
        n_batches = math.ceil(num_designs / batch_size)
        seed = binder_seeds if binder_seeds is not None else rng.randint(1, 10_000_000)

        out_dir = tmpdir_path / "rfd3_out"
        out_dir.mkdir(parents=True, exist_ok=True)

        cmd = [
            "rfd3",
            "design",
            f"out_dir={out_dir}",
            f"inputs={input_path}",
            f"diffusion_batch_size={batch_size}",
            f"seed={int(seed)}",
            "prevalidate_inputs=True",
        ]
        if n_batches > 1:
            cmd.append(f"n_batches={n_batches}")
        if diffusion_steps and int(diffusion_steps) > 0:
            cmd.append(f"inference_sampler.num_timesteps={int(diffusion_steps)}")
        if RFD3_LOW_MEMORY_MODE:
            cmd.append("low_memory_mode=True")
        if RFD3_EXTRA_ARGS:
            cmd.extend(shlex.split(RFD3_EXTRA_ARGS))

        shim_path = tmpdir_path / "sitecustomize.py"
        shim_path.write_text(RMSNORM_SHIM)

        env = os.environ.copy()
        pythonpath = env.get("PYTHONPATH", "")
        entries = [str(tmpdir_path), str(CURRENT_DIR)]
        if pythonpath:
            entries.append(pythonpath)
        env["PYTHONPATH"] = ":".join(entries)
        env["HYDRA_FULL_ERROR"] = "1"

        send_progress(job_id, "rfdiffusion", f"Running RFdiffusion3 ({num_designs} designs, {diffusion_steps} steps)")

        log_path = tmpdir_path / "rfd3_run.log"
        with log_path.open("w", encoding="utf-8") as log_handle:
            try:
                subprocess.run(cmd, check=True, env=env, stdout=log_handle, stderr=log_handle)
            except subprocess.CalledProcessError as exc:
                tail = extract_rfd3_error(log_path)
                raise RuntimeError(f"RFD3 inference failed. Log snippet:\\n{tail}") from exc

        cif_paths = sorted(out_dir.glob("*.cif*"))
        if not cif_paths:
            raise FileNotFoundError("No RFD3 outputs found in the inference directory.")

        send_progress(job_id, "rfdiffusion", f"Backbone design complete, processing {len(cif_paths[:num_designs])} designs")

        results: List[dict] = []
        total_designs = len(cif_paths[:num_designs])
        for idx, cif_path in enumerate(cif_paths[:num_designs]):
            send_progress(job_id, "processing", f"Processing design {idx + 1}/{total_designs}")

            complex_path = tmpdir_path / f"complex_{idx}.pdb"
            cif_to_pdb(cif_path, complex_path)

            output_chain_ids = set(chain_ids_from_structure(complex_path))
            output_sequences = _extract_chain_sequences(complex_path)
            target_output_chain_ids = match_output_target_chains(output_sequences, target_sequences)
            binder_chain_ids = output_chain_ids - target_output_chain_ids
            if not binder_chain_ids:
                binder_chain_ids = output_chain_ids - pdb_chain_ids
            if not binder_chain_ids:
                output_ordered = ordered_chain_ids_from_pdb(complex_path)
                if output_ordered:
                    binder_chain_ids = {output_ordered[-1]}
            if not binder_chain_ids:
                raise ValueError("Unable to identify binder chain in RFD3 output.")

            binder_path = tmpdir_path / f"binder_{idx}.pdb"
            write_pdb_chains(complex_path, binder_chain_ids, binder_path)

            binder_sequences = _extract_chain_sequences(binder_path)
            backbone_sequence = binder_sequences[0][1] if binder_sequences else ""

            mpnn_sequences: List[dict] = []
            if sequences_per_backbone and sequences_per_backbone > 0:
                send_progress(job_id, "proteinmpnn", f"Running ProteinMPNN for design {idx + 1}/{total_designs}")
                mpnn_result = run_proteinmpnn.remote(
                    backbone_pdb=binder_path.read_text(),
                    num_sequences=sequences_per_backbone,
                    job_id=f"{job_id}-mpnn{idx}",
                )
                if isinstance(mpnn_result, dict):
                    mpnn_sequences = mpnn_result.get("sequences", []) or []

            target_chain_ids_for_metrics = target_output_chain_ids or (output_chain_ids - binder_chain_ids)
            if not target_chain_ids_for_metrics:
                target_chain_ids_for_metrics = pdb_chain_ids
            metrics = compute_interface_metrics(complex_path, target_chain_ids_for_metrics)

            boltz_result = None
            boltz_scores = {}
            ipsae_scores = {}
            if boltz_samples and boltz_samples > 0:
                send_progress(job_id, "boltz", f"Running Boltz-2 scoring for design {idx + 1}/{total_designs}")
                boltz_result = run_boltz2.remote(
                    target_pdb=target_path.read_text(),
                    binder_pdb=binder_path.read_text(),
                    num_samples=boltz_samples,
                    job_id=f"{job_id}-b{idx}",
                )
                if isinstance(boltz_result, dict):
                    boltz_scores = boltz_result.get("scores", {})
                    ipsae_scores = boltz_result.get("ipsae_scores", {})

            binder_key = f"{RESULTS_PREFIX}/{job_id}/binder_{idx}.pdb"
            complex_key = f"{RESULTS_PREFIX}/{job_id}/complex_{idx}.pdb"
            upload_file(binder_path, binder_key, content_type="chemical/x-pdb")
            upload_file(complex_path, complex_key, content_type="chemical/x-pdb")

            target_chain_list = sorted(target_chain_ids_for_metrics)
            binder_chain_list = sorted(binder_chain_ids)

            combined_scores = {**metrics, **boltz_scores}

            results.append(
                {
                    "design_id": f"{job_id}-d{idx}",
                    "sequence": backbone_sequence,
                    "mpnn_sequences": mpnn_sequences,
                    "backbone": {"key": binder_key, "url": object_url(binder_key)},
                    "complex": {"key": complex_key, "url": object_url(complex_key)},
                    "scores": combined_scores,
                    "ipsae_scores": ipsae_scores,
                    "target_chains": target_chain_list,
                    "binder_chains": binder_chain_list,
                    "binder_sequences": [
                        {"chain_id": chain_id, "sequence": sequence}
                        for chain_id, sequence in binder_sequences
                    ],
                }
            )

        send_progress(job_id, "upload", "Uploading results")

        manifest = {
            "job_id": job_id,
            "challenge_id": challenge_id,
            "status": "completed",
            "mode": "inference",
            "pipeline": "rfdiffusion3",
            "target_sequence": target_sequence,
            "hotspots": hotspot_residues or [],
            "target_chains": sorted(pdb_chain_ids),
            "designs": results,
        }
        manifest_key = f"{RESULTS_PREFIX}/{job_id}/manifest.json"
        upload_bytes(json.dumps(manifest, indent=2).encode("utf-8"), manifest_key, "application/json")

    execution_seconds = round(time.time() - start_time, 2)

    result = {
        "status": "completed",
        "job_id": job_id,
        "challenge_id": challenge_id,
        "manifest": {"key": manifest_key, "url": object_url(manifest_key)},
        "designs": results,
        "mode": "inference",
        "pipeline": "rfdiffusion3",
        "usage": {
            "gpu_type": gpu_type,
            "execution_seconds": execution_seconds,
        },
    }

    send_completion(
        job_id,
        status="completed",
        output=result,
        usage=result.get("usage"),
    )

    return result
