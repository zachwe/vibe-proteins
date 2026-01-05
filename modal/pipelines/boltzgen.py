"""
BoltzGen binder design pipeline.
"""

from __future__ import annotations

import csv
import json
import os
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import List

from core.config import (
    app,
    boltzgen_image,
    r2_secret,
    BOLTZGEN_CACHE_DIR,
    BOLTZGEN_MODEL_VOLUME,
    RESULTS_PREFIX,
)
from pipelines.proteinmpnn import resolve_structure_source
from utils.boltz_helpers import _extract_chain_sequences
from utils.pdb import ordered_chain_ids_from_pdb, cif_to_pdb, tail_file
from utils.storage import download_to_path, object_url, upload_bytes, upload_file


def write_boltzgen_yaml(
    target_path: Path,
    target_chain_ids: list[str],
    binder_length: str | int,
    binding_residues: list[str] | None,
    output_path: Path,
) -> None:
    """
    Write a BoltzGen design specification YAML file.

    Args:
        target_path: Path to target structure file (CIF or PDB)
        target_chain_ids: Chain IDs from the target to include
        binder_length: Binder length specification (e.g., "80..140" or 100)
        binding_residues: Optional list of binding site residues (e.g., ["5..7", "13"])
        output_path: Path to write the YAML file
    """
    import yaml

    # Format binder length
    if isinstance(binder_length, int):
        binder_len_str = str(binder_length)
    else:
        binder_len_str = str(binder_length).replace("-", "..").strip()

    # Build entities section
    entities = []

    # Add designable binder (chain B by default)
    entities.append({"protein": {"id": "B", "sequence": binder_len_str}})

    # Add target from file with specified chains
    include_chains = [{"chain": {"id": chain_id}} for chain_id in target_chain_ids]
    entities.append({"file": {"path": str(target_path), "include": include_chains}})

    spec: dict = {"entities": entities}

    # Add binding_types if binding residues specified
    if binding_residues:
        binding_str = ",".join(binding_residues)
        # Assume binding to first target chain
        target_chain = target_chain_ids[0] if target_chain_ids else "A"
        spec["binding_types"] = [{"chain": {"id": target_chain, "binding": binding_str}}]

    output_path.write_text(yaml.dump(spec, default_flow_style=False))


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


@app.function(
    image=boltzgen_image,
    gpu="A100",  # BoltzGen benefits from A100 for larger batches
    timeout=14400,  # 4 hours for full pipeline
    secrets=[r2_secret],
    volumes={BOLTZGEN_CACHE_DIR: BOLTZGEN_MODEL_VOLUME},
)
def run_boltzgen(
    # Target specification
    target_pdb: str | None = None,
    target_structure_url: str | None = None,
    target_chain_ids: list[str] | None = None,
    # Design specification
    binder_length: str | int = "80..120",
    binding_residues: list[str] | None = None,
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
    """
    start_time = time.time()
    gpu_type = "A100"

    job_id = job_id or str(uuid.uuid4())
    target_source = resolve_structure_source(target_pdb, target_structure_url)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Download target structure
        target_ext = ".cif" if target_structure_url and ".cif" in target_structure_url.lower() else ".pdb"
        target_path = download_to_path(target_source, tmpdir_path / f"target{target_ext}")

        # Determine target chains if not specified
        if not target_chain_ids:
            target_chain_ids = ordered_chain_ids_from_pdb(target_path)
        if not target_chain_ids:
            raise ValueError("No protein chains found in target structure.")

        # Write design specification YAML
        design_spec_path = tmpdir_path / "design_spec.yaml"
        write_boltzgen_yaml(
            target_path=target_path,
            target_chain_ids=target_chain_ids,
            binder_length=binder_length,
            binding_residues=binding_residues,
            output_path=design_spec_path,
        )

        # Build BoltzGen command
        output_dir = tmpdir_path / "boltzgen_output"
        cmd = [
            "boltzgen", "run",
            str(design_spec_path),
            "--output", str(output_dir),
            "--protocol", protocol,
            "--num_designs", str(num_designs),
            "--budget", str(budget),
            "--alpha", str(alpha),
            "--cache", BOLTZGEN_CACHE_DIR,
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
        if reuse:
            cmd.append("--reuse")

        # Run BoltzGen
        log_path = tmpdir_path / "boltzgen_run.log"
        env = os.environ.copy()
        env["BOLTZGEN_CACHE"] = BOLTZGEN_CACHE_DIR

        print(f"Running BoltzGen: {' '.join(cmd)}")

        with log_path.open("w", encoding="utf-8") as log_handle:
            try:
                subprocess.run(cmd, check=True, env=env, stdout=log_handle, stderr=log_handle)
            except subprocess.CalledProcessError as exc:
                tail = tail_file(log_path, max_bytes=8000)
                raise RuntimeError(f"BoltzGen failed. Log snippet:\n{tail}") from exc

        # Parse results
        metrics_data = parse_boltzgen_metrics(output_dir, budget)
        structure_paths = find_boltzgen_structures(output_dir, budget)

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
                pdb_path = tmpdir_path / f"design_{idx}.pdb"
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

    return {
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
            "num_designs": num_designs,
            "budget": budget,
            "alpha": alpha,
        },
        "usage": {
            "gpu_type": gpu_type,
            "execution_seconds": execution_seconds,
        },
    }
