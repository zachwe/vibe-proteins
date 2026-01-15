"""
BoltzGen binder design pipeline.
"""

from __future__ import annotations

import csv
import json
import os
import shutil
import signal
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import List

import modal

from core.config import (
    app,
    boltzgen_image,
    r2_secret,
    BOLTZGEN_CACHE_DIR,
    BOLTZGEN_MODEL_VOLUME,
    BOLTZGEN_WORK_DIR,
    BOLTZGEN_WORK_VOLUME,
    RESULTS_PREFIX,
)
from core.job_status import send_progress, send_completion, send_usage_update
from pipelines.proteinmpnn import resolve_structure_source
from utils.boltz_helpers import _extract_chain_sequences
from utils.pdb import ordered_chain_ids_from_pdb, cif_to_pdb, tail_file, mmcif_auth_label_mapping
from utils.storage import download_to_path, object_url, upload_bytes, upload_file


def write_boltzgen_yaml(
    target_path: Path,
    target_chain_ids: list[str],
    binder_length: str | int,
    binding_types: list[dict] | None,
    output_path: Path,
    scaffold_paths: list[Path] | None = None,
) -> None:
    """
    Write a BoltzGen design specification YAML file.

    Args:
        target_path: Path to target structure file (CIF or PDB)
        target_chain_ids: Chain IDs from the target to include
        binder_length: Binder length specification (e.g., "80..140" or 100)
        binding_types: Optional binding_types entries for target chains
        output_path: Path to write the YAML file
        scaffold_paths: Optional list of scaffold YAML paths for antibody/nanobody design
    """
    import yaml

    entities = []

    # Add target from file with specified chains
    include_chains = [{"chain": {"id": chain_id}} for chain_id in target_chain_ids]
    file_entity: dict = {"path": str(target_path), "include": include_chains}
    if binding_types:
        file_entity["binding_types"] = binding_types
    entities.append({"file": file_entity})

    # Add designable binder or scaffold library
    if scaffold_paths:
        entities.append({"file": {"path": [str(path) for path in scaffold_paths]}})
    else:
        if isinstance(binder_length, int):
            binder_len_str = str(binder_length)
        else:
            binder_len_str = str(binder_length).replace("-", "..").strip()
        entities.append({"protein": {"id": "B", "sequence": binder_len_str}})

    spec: dict = {"entities": entities}

    output_path.write_text(yaml.dump(spec, default_flow_style=False))


def resolve_scaffold_paths(scaffold_set: str | None, scaffold_paths: list[str] | None) -> list[Path] | None:
    """Resolve scaffold YAML paths from a named set or explicit path list."""
    if scaffold_paths:
        return [Path(path) for path in scaffold_paths]
    if not scaffold_set:
        return None
    base_dir = Path("/assets/boltzgen")
    if scaffold_set == "nanobody":
        paths = sorted((base_dir / "nanobody_scaffolds").glob("*.yaml"))
    elif scaffold_set in {"fab", "antibody"}:
        paths = sorted((base_dir / "fab_scaffolds").glob("*.yaml"))
    else:
        raise ValueError(f"Unknown scaffold set: {scaffold_set}")
    if not paths:
        raise ValueError(f"No scaffold YAMLs found for scaffold set: {scaffold_set}")
    return paths


def build_binding_types(
    binding_residues: list[str] | None,
    target_chain_ids: list[str],
    residue_map: dict[tuple[str, str], tuple[str, str]] | None = None,
    chain_map: dict[str, str] | None = None,
) -> list[dict] | None:
    """Convert auth-style binding residues into BoltzGen binding_types entries."""
    if not binding_residues:
        return None

    import re

    default_chain = target_chain_ids[0] if target_chain_ids else None
    if not default_chain:
        return None

    residue_map = residue_map or {}
    chain_map = chain_map or {}

    binding_by_chain: dict[str, list[str]] = {}
    for residue in binding_residues:
        if not residue:
            continue
        match = re.search(r"([A-Za-z])\s*[:\-_/]?\s*(\d+)", residue)
        if match:
            auth_chain, res_id = match.groups()
        elif residue.isdigit():
            auth_chain, res_id = default_chain, residue
        else:
            continue
        if target_chain_ids and auth_chain not in target_chain_ids:
            continue
        label_chain = chain_map.get(auth_chain, auth_chain)
        label_res = residue_map.get((auth_chain, str(res_id)), (label_chain, str(res_id)))[1]
        residues = binding_by_chain.setdefault(label_chain, [])
        residues.append(str(label_res))

    if not binding_by_chain:
        return None

    binding_types = []
    for chain_id, residues in binding_by_chain.items():
        deduped = list(dict.fromkeys(residues))
        binding_types.append({"chain": {"id": chain_id, "binding": ",".join(deduped)}})
    return binding_types


def parse_boltzgen_metrics(output_dir: Path, budget: int) -> list[dict]:
    """Parse BoltzGen output metrics from CSV files."""
    results = []

    # Look for final ranked designs metrics
    final_metrics_path = output_dir / f"final_ranked_designs/final_designs_metrics_{budget}.csv"
    if not final_metrics_path.exists():
        # Try alternative paths
        for path in output_dir.glob("**/final_designs_metrics*.csv"):
            final_metrics_path = path
            break

    if not final_metrics_path.exists():
        # Fall back to all_designs_metrics.csv
        for path in output_dir.glob("**/all_designs_metrics.csv"):
            final_metrics_path = path
            break

    if final_metrics_path.exists():
        with final_metrics_path.open() as f:
            reader = csv.DictReader(f)
            for row in reader:
                results.append(dict(row))

    return results


def find_boltzgen_structures(output_dir: Path, budget: int) -> list[Path]:
    """Find the final designed structure files from BoltzGen output."""
    structures = []

    # Look in final_ranked_designs/final_{budget}_designs/
    final_dir = output_dir / f"final_ranked_designs/final_{budget}_designs"
    if final_dir.exists():
        structures = list(final_dir.glob("*.cif")) + list(final_dir.glob("*.pdb"))

    # Fallback to intermediate_designs_inverse_folded/refold_cif/
    if not structures:
        refold_dir = output_dir / "intermediate_designs_inverse_folded/refold_cif"
        if refold_dir.exists():
            structures = list(refold_dir.glob("*.cif"))[:budget]

    # Fallback to intermediate_designs/
    if not structures:
        intermediate_dir = output_dir / "intermediate_designs"
        if intermediate_dir.exists():
            structures = list(intermediate_dir.glob("*.cif"))[:budget]

    return sorted(structures)[:budget]


def run_boltzgen_with_progress(
    cmd: list[str],
    env: dict,
    log_path: Path,
    job_id: str | None,
    num_designs: int,
    budget: int,
    start_time: float,
    gpu_type: str = "A100",
) -> None:
    """
    Run BoltzGen subprocess with real-time progress streaming.

    Parses BoltzGen output to detect pipeline stages and sends progress updates.
    Also monitors output directories to report design-level progress.
    """
    import re
    import select
    import sys
    import threading

    # Extract output directory from command
    output_dir = None
    for i, arg in enumerate(cmd):
        if arg == "--output" and i + 1 < len(cmd):
            output_dir = Path(cmd[i + 1])
            break

    # Stage detection patterns for BoltzGen output
    stage_patterns = [
        (r"Running diffusion", "design", "Running diffusion backbone generation"),
        (r"Diffusion complete|Generated \d+ designs", "design", f"Backbone diffusion complete ({num_designs} designs)"),
        (r"Running inverse folding|ProteinMPNN", "inverse_folding", "Running inverse folding (ProteinMPNN)"),
        (r"Inverse folding complete", "inverse_folding", "Inverse folding complete"),
        (r"Running folding|Boltz|boltz", "folding", "Running structure prediction (Boltz-2)"),
        (r"Folding complete|Predicted \d+ structures", "folding", "Structure prediction complete"),
        (r"Computing metrics|Analyzing", "analysis", "Computing design metrics"),
        (r"Filtering|Ranking|Selecting", "filtering", f"Filtering and ranking (selecting top {budget})"),
        (r"Final designs selected|Writing final", "filtering", f"Selected {budget} final designs"),
    ]

    # Track which stages we've reported
    reported_stages = set()
    last_progress_time = time.time()
    last_design_counts: dict[str, int] = {}
    stop_progress_monitor = threading.Event()

    def count_designs_in_stage() -> tuple[str, int, int] | None:
        """Count completed designs in each stage directory."""
        if not output_dir or not output_dir.exists():
            return None

        # Check stages in order of pipeline progression
        stages = [
            ("design", "intermediate_designs", "*.cif", num_designs),
            ("inverse_folding", "intermediate_designs_inverse_folded", "*.cif", num_designs),
            ("folding", "intermediate_designs_inverse_folded/refold_cif", "*.cif", num_designs),
            ("filtering", f"final_ranked_designs/final_{budget}_designs", "*.cif", budget),
        ]

        # Find the most recent active stage
        for stage_name, subdir, pattern, total in reversed(stages):
            stage_dir = output_dir / subdir
            if stage_dir.exists():
                count = len(list(stage_dir.glob(pattern)))
                if count > 0:
                    return (stage_name, count, total)

        return None

    def progress_monitor():
        """Background thread to monitor design progress and send usage updates."""
        while not stop_progress_monitor.wait(timeout=30):  # Check every 30 seconds
            try:
                # Send usage update for billing
                elapsed = time.time() - start_time
                send_usage_update(job_id, gpu_type, elapsed)

                # Check design progress
                result = count_designs_in_stage()
                if result:
                    stage_name, count, total = result
                    # Only report if count changed
                    if last_design_counts.get(stage_name) != count:
                        last_design_counts[stage_name] = count
                        stage_labels = {
                            "design": "Diffusion",
                            "inverse_folding": "Inverse folding",
                            "folding": "Structure prediction",
                            "filtering": "Final designs",
                        }
                        label = stage_labels.get(stage_name, stage_name)
                        send_progress(job_id, stage_name, f"{label}: {count}/{total} complete")
            except Exception as e:
                print(f"[progress_monitor] Error: {e}")

    def check_line_for_progress(line: str) -> None:
        """Check a log line for progress indicators and send updates."""
        nonlocal last_progress_time

        for pattern, stage, message in stage_patterns:
            if re.search(pattern, line, re.IGNORECASE):
                # Only report each stage once (or if message differs)
                stage_key = f"{stage}:{message}"
                if stage_key not in reported_stages:
                    reported_stages.add(stage_key)
                    send_progress(job_id, stage, message)
                    last_progress_time = time.time()
                break

        # Send periodic heartbeat if no progress for a while (every 60s)
        if time.time() - last_progress_time > 60:
            send_progress(job_id, "processing", "Pipeline running...")
            last_progress_time = time.time()

    # Start background progress monitor
    monitor_thread = threading.Thread(target=progress_monitor, daemon=True)
    monitor_thread.start()

    # Run subprocess with real-time output streaming
    process = subprocess.Popen(
        cmd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,  # Line buffered
    )

    with log_path.open("w", encoding="utf-8") as log_handle:
        try:
            for line in process.stdout:
                # Write to log file
                log_handle.write(line)
                log_handle.flush()

                # Print to Modal logs
                print(line, end="", file=sys.stdout)

                # Check for progress indicators
                check_line_for_progress(line)

            # Wait for process to complete
            return_code = process.wait()

            if return_code != 0:
                tail = tail_file(log_path, max_bytes=8000)
                raise RuntimeError(f"BoltzGen failed with exit code {return_code}. Log snippet:\n{tail}")

        except Exception as e:
            process.kill()
            raise e
        finally:
            # Stop the progress monitor thread
            stop_progress_monitor.set()
            monitor_thread.join(timeout=2)


@app.function(
    image=boltzgen_image,
    gpu="A100",  # BoltzGen benefits from A100 for larger batches
    timeout=14400,  # 4 hours for full pipeline
    secrets=[r2_secret],
    volumes={
        BOLTZGEN_CACHE_DIR: BOLTZGEN_MODEL_VOLUME,
        BOLTZGEN_WORK_DIR: BOLTZGEN_WORK_VOLUME,  # Persistent work dir for preemption recovery
    },
    retries=modal.Retries(
        max_retries=3,
        backoff_coefficient=1.0,
        initial_delay=1.0,
    ),
)
def run_boltzgen(
    # Target specification
    target_pdb: str | None = None,
    target_structure_url: str | None = None,
    target_chain_ids: list[str] | None = None,
    # Design specification
    binder_length: str | int = "80..120",
    binding_residues: list[str] | None = None,
    scaffold_set: str | None = None,
    scaffold_paths: list[str] | None = None,
    # Protocol selection
    protocol: str = "protein-anything",
    # Design parameters
    num_designs: int = 100,
    diffusion_batch_size: int | None = None,
    step_scale: float | None = None,
    noise_scale: float | None = None,
    # Inverse folding parameters
    inverse_fold_num_sequences: int = 1,
    inverse_fold_avoid: str | None = None,
    skip_inverse_folding: bool = False,
    # Filtering parameters
    budget: int = 10,
    alpha: float = 0.01,
    filter_biased: bool = True,
    refolding_rmsd_threshold: float | None = None,
    additional_filters: list[str] | None = None,
    metrics_override: str | None = None,
    # Execution parameters
    devices: int | None = None,
    steps: list[str] | None = None,
    reuse: bool = False,
    # Job metadata
    job_id: str | None = None,
    challenge_id: str | None = None,
) -> dict:
    """
    Run BoltzGen protein design pipeline.

    BoltzGen is a comprehensive pipeline for designing protein binders using:
    1. Diffusion-based backbone design
    2. Inverse folding for sequence generation
    3. Boltz-2 structure validation
    4. Metric-based filtering and ranking

    Handles preemption by:
    - Using a persistent volume for intermediate results
    - Enabling --reuse flag to resume from checkpoints
    - Automatic retries on preemption (up to 3 attempts)
    """
    start_time = time.time()
    gpu_type = "A100"

    job_id = job_id or str(uuid.uuid4())
    target_source = resolve_structure_source(target_pdb, target_structure_url)

    # Use persistent work directory for preemption recovery
    # Each job gets its own subdirectory in the volume
    work_dir = Path(BOLTZGEN_WORK_DIR) / job_id
    work_dir.mkdir(parents=True, exist_ok=True)

    # Track if we're resuming from a previous run
    is_resuming = (work_dir / "boltzgen_output").exists()

    # Set up SIGTERM handler for graceful shutdown on preemption
    preempted = False
    def handle_sigterm(signum, frame):
        nonlocal preempted
        preempted = True
        send_progress(job_id, "processing", "Preemption detected, saving state...")
        # Commit the volume to ensure intermediate results are saved
        BOLTZGEN_WORK_VOLUME.commit()
        print(f"[preemption] Volume committed for job {job_id}")

    signal.signal(signal.SIGTERM, handle_sigterm)

    send_progress(job_id, "init", "Resuming BoltzGen pipeline..." if is_resuming else "Initializing BoltzGen pipeline")

    # Download target structure (to work dir for persistence)
    target_ext = ".cif" if target_structure_url and ".cif" in target_structure_url.lower() else ".pdb"
    target_path = work_dir / f"target{target_ext}"

    if not target_path.exists():
        send_progress(job_id, "init", "Downloading target structure")
        download_to_path(target_source, target_path)
    else:
        send_progress(job_id, "init", "Using cached target structure")

    # Determine target chains if not specified
    if not target_chain_ids:
        if target_path.suffix.lower() == ".cif":
            _, chain_map = mmcif_auth_label_mapping(target_path)
            target_chain_ids = list(dict.fromkeys(chain_map.keys()))
        else:
            target_chain_ids = ordered_chain_ids_from_pdb(target_path)
    if not target_chain_ids:
        raise ValueError("No protein chains found in target structure.")

    residue_map: dict[tuple[str, str], tuple[str, str]] = {}
    chain_map: dict[str, str] = {}
    if target_path.suffix.lower() == ".cif":
        residue_map, chain_map = mmcif_auth_label_mapping(target_path)

    mapped_chain_ids = [chain_map.get(chain_id, chain_id) for chain_id in target_chain_ids]
    binding_types = build_binding_types(binding_residues, target_chain_ids, residue_map, chain_map)
    scaffold_paths_resolved = resolve_scaffold_paths(scaffold_set, scaffold_paths)

    # Write design specification YAML
    design_spec_path = work_dir / "design_spec.yaml"
    if not design_spec_path.exists():
        write_boltzgen_yaml(
            target_path=target_path,
            target_chain_ids=mapped_chain_ids,
            binder_length=binder_length,
            binding_types=binding_types,
            output_path=design_spec_path,
            scaffold_paths=scaffold_paths_resolved,
        )

    # Build BoltzGen command
    output_dir = work_dir / "boltzgen_output"
    cmd = [
        "boltzgen", "run",
        str(design_spec_path),
        "--output", str(output_dir),
        "--protocol", protocol,
        "--num_designs", str(num_designs),
        "--budget", str(budget),
        "--alpha", str(alpha),
        "--cache", BOLTZGEN_CACHE_DIR,
        "--reuse",  # Always enable for preemption recovery
    ]

    # Add optional parameters
    if diffusion_batch_size:
        cmd.extend(["--diffusion_batch_size", str(diffusion_batch_size)])
    if step_scale is not None:
        cmd.extend(["--step_scale", str(step_scale)])
    if noise_scale is not None:
        cmd.extend(["--noise_scale", str(noise_scale)])
    if inverse_fold_num_sequences != 1:
        cmd.extend(["--inverse_fold_num_sequences", str(inverse_fold_num_sequences)])
    if inverse_fold_avoid:
        cmd.extend(["--inverse_fold_avoid", inverse_fold_avoid])
    if skip_inverse_folding:
        cmd.append("--skip_inverse_folding")
    if not filter_biased:
        cmd.extend(["--filter_biased", "false"])
    if refolding_rmsd_threshold is not None:
        cmd.extend(["--refolding_rmsd_threshold", str(refolding_rmsd_threshold)])
    if metrics_override:
        cmd.extend(["--metrics_override", metrics_override])
    if additional_filters:
        for filt in additional_filters:
            cmd.extend(["--additional_filters", filt])
    if devices:
        cmd.extend(["--devices", str(devices)])
    if steps:
        cmd.extend(["--steps", ",".join(steps)])

    # Run BoltzGen with progress streaming
    log_path = work_dir / "boltzgen_run.log"
    env = os.environ.copy()
    env["BOLTZGEN_CACHE"] = BOLTZGEN_CACHE_DIR

    resume_msg = " (resuming)" if is_resuming else ""
    print(f"Running BoltzGen{resume_msg}: {' '.join(cmd)}")
    send_progress(job_id, "design", f"{'Resuming' if is_resuming else 'Starting'} BoltzGen ({num_designs} designs, budget {budget})")

    try:
        run_boltzgen_with_progress(
            cmd=cmd,
            env=env,
            log_path=log_path,
            job_id=job_id,
            num_designs=num_designs,
            budget=budget,
            start_time=start_time,
            gpu_type=gpu_type,
        )
    except RuntimeError as exc:
        # Commit volume before failing to save partial progress
        BOLTZGEN_WORK_VOLUME.commit()
        send_completion(job_id, "failed", error=str(exc))
        raise

    # Parse results
    send_progress(job_id, "processing", "Parsing design results")
    metrics_data = parse_boltzgen_metrics(output_dir, budget)
    structure_paths = find_boltzgen_structures(output_dir, budget)

    send_progress(job_id, "upload", f"Uploading {len(structure_paths)} designs to storage")

    # Upload results and build manifest
    designs: List[dict] = []
    for idx, struct_path in enumerate(structure_paths):
        # Upload structure
        struct_ext = struct_path.suffix.lower() or ".cif"
        struct_key = f"{RESULTS_PREFIX}/{job_id}/design_{idx}{struct_ext}"
        content_type = "chemical/x-mmcif" if struct_ext == ".cif" else "chemical/x-pdb"
        upload_file(struct_path, struct_key, content_type=content_type)

        # Extract sequence from structure
        if struct_ext == ".cif":
            # Convert CIF to PDB for sequence extraction
            pdb_path = work_dir / f"design_{idx}.pdb"
            cif_to_pdb(struct_path, pdb_path)
            sequences = _extract_chain_sequences(pdb_path)
        else:
            sequences = _extract_chain_sequences(struct_path)

        # Get metrics for this design if available
        design_metrics = {}
        if idx < len(metrics_data):
            design_metrics = metrics_data[idx]

        designs.append({
            "design_id": f"{job_id}-d{idx}",
            "structure": {"key": struct_key, "url": object_url(struct_key)},
            "sequences": [
                {"chain_id": chain_id, "sequence": seq}
                for chain_id, seq in sequences
            ],
            "metrics": design_metrics,
        })

    # Upload full metrics CSV if available
    metrics_key = None
    final_metrics_path = output_dir / "final_ranked_designs/all_designs_metrics.csv"
    if final_metrics_path.exists():
        metrics_key = f"{RESULTS_PREFIX}/{job_id}/all_designs_metrics.csv"
        upload_file(final_metrics_path, metrics_key, content_type="text/csv")

    # Upload overview PDF if available
    overview_key = None
    overview_path = output_dir / "final_ranked_designs/results_overview.pdf"
    if overview_path.exists():
        overview_key = f"{RESULTS_PREFIX}/{job_id}/results_overview.pdf"
        upload_file(overview_path, overview_key, content_type="application/pdf")

    manifest = {
        "job_id": job_id,
        "challenge_id": challenge_id,
        "status": "completed",
        "pipeline": "boltzgen",
        "protocol": protocol,
        "target_chains": target_chain_ids,
        "parameters": {
            "binder_length": binder_length,
            "scaffold_set": scaffold_set,
            "scaffold_paths": scaffold_paths,
            "num_designs": num_designs,
            "budget": budget,
            "alpha": alpha,
            "protocol": protocol,
        },
        "designs": designs,
    }
    manifest_key = f"{RESULTS_PREFIX}/{job_id}/manifest.json"
    upload_bytes(json.dumps(manifest, indent=2).encode("utf-8"), manifest_key, "application/json")

    execution_seconds = round(time.time() - start_time, 2)

    send_progress(job_id, "complete", f"Pipeline complete! Generated {len(designs)} designs in {execution_seconds:.0f}s")

    output = {
        "status": "completed",
        "job_id": job_id,
        "challenge_id": challenge_id,
        "manifest": {"key": manifest_key, "url": object_url(manifest_key)},
        "designs": designs,
        "metrics_csv": {"key": metrics_key, "url": object_url(metrics_key)} if metrics_key else None,
        "overview_pdf": {"key": overview_key, "url": object_url(overview_key)} if overview_key else None,
        "pipeline": "boltzgen",
        "protocol": protocol,
        "parameters": {
            "binder_length": binder_length,
            "scaffold_set": scaffold_set,
            "scaffold_paths": scaffold_paths,
            "num_designs": num_designs,
            "budget": budget,
            "alpha": alpha,
        },
        "usage": {
            "gpu_type": gpu_type,
            "execution_seconds": execution_seconds,
        },
    }

    send_completion(
        job_id,
        status="completed",
        output=output,
        usage=output["usage"],
    )

    # Clean up work directory after successful completion
    try:
        shutil.rmtree(work_dir)
        BOLTZGEN_WORK_VOLUME.commit()
    except Exception as e:
        print(f"[cleanup] Warning: Failed to clean up work directory: {e}")

    return output
