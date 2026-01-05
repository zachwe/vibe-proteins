"""
ProteinMPNN pipeline for sequence design from backbones.
"""

from __future__ import annotations

import math
import re
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import List
import random

from core.config import (
    app,
    proteinmpnn_image,
    r2_secret,
    PROTEINMPNN_DIR,
    PROTEINMPNN_MODEL_NAME,
    PROTEINMPNN_SAMPLING_TEMP,
    PROTEINMPNN_BATCH_SIZE,
)
from utils.storage import download_to_path
from utils.pdb import estimate_backbone_length


def rng_from_job(job_id: str | None) -> random.Random:
    """Create a seeded random generator from a job ID."""
    if not job_id:
        return random.Random()
    try:
        job_uuid = uuid.UUID(job_id)
        seed = job_uuid.int % (2**32 - 1)
    except ValueError:
        seed = sum(ord(c) for c in job_id)
    return random.Random(seed)


def parse_mpnn_fasta(path: Path) -> List[dict]:
    """Parse ProteinMPNN output FASTA file."""
    sequences: List[dict] = []
    header = None
    buffer: List[str] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(">"):
            if header and buffer:
                entry = mpnn_entry_from_record(header, "".join(buffer))
                if entry:
                    sequences.append(entry)
            header = line[1:]
            buffer = []
        else:
            buffer.append(line)
    if header and buffer:
        entry = mpnn_entry_from_record(header, "".join(buffer))
        if entry:
            sequences.append(entry)
    return sequences


def mpnn_entry_from_record(header: str, sequence: str) -> dict | None:
    """Parse a single ProteinMPNN FASTA record."""
    score_match = re.search(r"score=([0-9.]+)", header)
    score = float(score_match.group(1)) if score_match else None
    entry = {"sequence": sequence}
    if score is not None:
        entry["score"] = score
        entry["log_prob"] = -score
    return entry


def run_proteinmpnn_local(
    backbone_path: Path,
    output_dir: Path,
    num_sequences: int,
    design_chains: List[str] | None = None,
    seed: int | None = None,
) -> List[dict]:
    """Run ProteinMPNN locally on a backbone structure."""
    output_dir.mkdir(parents=True, exist_ok=True)
    num_sequences = max(int(num_sequences), 1)
    batch_size = max(1, min(PROTEINMPNN_BATCH_SIZE, num_sequences))
    adjusted_num = batch_size * math.ceil(num_sequences / batch_size)

    args = [
        "python",
        str(PROTEINMPNN_DIR / "protein_mpnn_run.py"),
        "--pdb_path",
        str(backbone_path),
        "--out_folder",
        str(output_dir),
        "--num_seq_per_target",
        str(adjusted_num),
        "--batch_size",
        str(batch_size),
        "--sampling_temp",
        PROTEINMPNN_SAMPLING_TEMP,
        "--model_name",
        PROTEINMPNN_MODEL_NAME,
        "--path_to_model_weights",
        str(PROTEINMPNN_DIR / "vanilla_model_weights"),
        "--suppress_print",
        "1",
    ]
    if seed is not None:
        args.extend(["--seed", str(seed)])
    if design_chains:
        args.extend(["--pdb_path_chains", " ".join(design_chains)])

    subprocess.run(args, check=True, cwd=str(PROTEINMPNN_DIR))

    fasta_files = list((output_dir / "seqs").glob("*.fa"))
    if not fasta_files:
        return []
    sequences = parse_mpnn_fasta(fasta_files[0])
    return sequences[:num_sequences]


def resolve_structure_source(target_pdb: str | None, target_structure_url: str | None) -> str:
    """Resolve structure source from PDB content or URL."""
    if target_pdb:
        return target_pdb
    if target_structure_url:
        return target_structure_url
    raise ValueError("A target_pdb or target_structure_url must be provided.")


@app.function(image=proteinmpnn_image, gpu="A10G", timeout=1800, secrets=[r2_secret])
def run_proteinmpnn(
    backbone_pdb: str | None = None,
    target_pdb: str | None = None,
    num_sequences: int = 4,
    job_id: str | None = None,
) -> dict:
    """Direct ProteinMPNN call for a provided backbone."""
    start_time = time.time()
    gpu_type = "A10G"

    job_id = job_id or str(uuid.uuid4())
    backbone_source = resolve_structure_source(backbone_pdb, target_pdb)

    with tempfile.TemporaryDirectory() as tmpdir:
        backbone_path = download_to_path(backbone_source, Path(tmpdir) / "backbone.pdb")
        estimated_length = estimate_backbone_length(backbone_path)
        sequences = run_proteinmpnn_local(
            backbone_path=backbone_path,
            output_dir=Path(tmpdir) / "mpnn",
            num_sequences=num_sequences,
            seed=rng_from_job(job_id).randint(1, 10_000_000),
        )

    execution_seconds = round(time.time() - start_time, 2)

    return {
        "status": "completed",
        "job_id": job_id,
        "sequences": sequences,
        "backbone_length": estimated_length,
        "mode": "inference",
        "usage": {
            "gpu_type": gpu_type,
            "execution_seconds": execution_seconds,
        },
    }
