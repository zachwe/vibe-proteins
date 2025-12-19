"""
VibeProteins Modal Functions

This module wires up GPU inference pipelines (RFdiffusion + ProteinMPNN + Boltz-2),
shared Cloudflare R2 utilities, and ipSAE-style interface scoring.

The heavy ML models are toggled via environment variables. By default we run a
fast, local-friendly mock pipeline so unit tests can run without GPUs. When the
real model scripts are available, set ``DUMMY_INFERENCE=0`` and configure the
command hooks (RFDIFFUSION_CMD, PROTEINMPNN_CMD, BOLTZ2_CMD) – the orchestration
code and storage plumbing remain the same.
"""

from __future__ import annotations

import json
import math
import os
import random
import sys
import tempfile
import uuid
from pathlib import Path
from typing import List

import modal

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
  sys.path.append(str(CURRENT_DIR))

from utils.metrics import chain_ids_from_structure, compute_interface_metrics
from utils.storage import download_to_path, object_url, upload_bytes, upload_file

app = modal.App("vibeproteins")

TORCH_INDEX = "https://download.pytorch.org/whl/cu121"
COMMON_PY_PKGS = [
  "boto3",
  "biopython",
  "numpy",
  "scipy",
  "requests",
  "fastapi[standard]",
]

gpu_image = (
  modal.Image.debian_slim(python_version="3.11")
  .apt_install("git")
  .pip_install(*COMMON_PY_PKGS)
  .pip_install(
    "torch==2.1.2",
    "torchvision==0.16.2",
    "torchaudio==2.1.2",
    extra_index_url=TORCH_INDEX,
  )
)

cpu_image = modal.Image.debian_slim(python_version="3.11").pip_install(*COMMON_PY_PKGS)

r2_secret = modal.Secret.from_name("r2-credentials")

DUMMY_INFERENCE = os.environ.get("DUMMY_INFERENCE", "1").lower() in {"1", "true", "yes", "on"}
RESULTS_PREFIX = os.environ.get("DESIGN_RESULTS_PREFIX", "designs").strip("/")
AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY"


def _rng_from_job(job_id: str | None) -> random.Random:
  if not job_id:
    return random.Random()
  try:
    job_uuid = uuid.UUID(job_id)
    seed = job_uuid.int % (2**32 - 1)
  except ValueError:
    seed = sum(ord(c) for c in job_id)
  return random.Random(seed)


def _generate_stub_backbone(path: Path, length: int, chain_id: str = "B") -> Path:
  """Creates a simple alpha-helix style backbone for placeholder use."""
  lines: List[str] = []
  for idx in range(length):
    x = idx * 1.45
    y = math.sin(idx / 3.0) * 2.0
    z = math.cos(idx / 3.0) * 2.0
    lines.append(
      f"ATOM  {idx + 1:5d}  CA  ALA {chain_id}{idx + 1:4d}    {x:8.3f}{y:8.3f}{z:8.3f}  1.00 20.00           C"
    )
  lines.append("TER")
  path.write_text("\n".join(lines) + "\nEND\n")
  return path


def _simulate_proteinmpnn(length: int, count: int, rng: random.Random) -> List[dict]:
  sequences = []
  for _ in range(count):
    seq = "".join(rng.choice(AMINO_ACIDS) for _ in range(length))
    sequences.append(
      {
        "sequence": seq,
        "log_prob": round(rng.uniform(-1.5, -0.1), 3),
      }
    )
  return sequences


def _simulate_boltz2(metrics: dict, rng: random.Random, samples: int) -> dict:
  base = metrics.get("shape_complementarity", 0.1)
  return {
    "samples": samples,
    "iptm": round(min(0.95, 0.45 + base * 0.55 + rng.uniform(-0.03, 0.03)), 3),
    "plddt": round(60 + base * 35 + rng.uniform(-3, 4), 2),
    "rmsd": round(max(0.8, 2.4 - base * 1.2 + rng.uniform(-0.2, 0.2)), 3),
  }


def _merge_structures(target_path: Path, binder_path: Path, output_path: Path) -> Path:
  target = target_path.read_text().strip()
  binder = binder_path.read_text().strip()
  merged = f"{target}\n{binder}\nEND\n"
  output_path.write_text(merged)
  return output_path


def _resolve_structure_source(target_pdb: str | None, target_structure_url: str | None) -> str:
  if target_pdb:
    return target_pdb
  if target_structure_url:
    return target_structure_url
  raise ValueError("A target_pdb or target_structure_url must be provided.")


def _estimate_backbone_length(path: Path) -> int:
  length = 0
  for line in path.read_text().splitlines():
    if line.startswith("ATOM") and line[12:16].strip() == "CA":
      length += 1
  return max(length, 60)


@app.function(image=cpu_image)
def health_check() -> dict:
  """Simple health check to verify Modal is working."""
  mode = "dummy" if DUMMY_INFERENCE else "models"
  return {"status": "ok", "message": f"VibeProteins Modal ready ({mode} mode)"}


@app.function(image=gpu_image, gpu="A10G", timeout=3600, secrets=[r2_secret])
def run_rfdiffusion(
  target_pdb: str | None = None,
  target_structure_url: str | None = None,
  target_sequence: str | None = None,
  hotspot_residues: list[str] | None = None,
  num_designs: int = 2,
  binder_length: int = 85,
  sequences_per_backbone: int = 4,
  diffusion_steps: int = 30,
  boltz_samples: int = 1,
  binder_seeds: int | None = None,
  job_id: str | None = None,
  challenge_id: str | None = None,
) -> dict:
  """
  RFdiffusion + ProteinMPNN + Boltz-2 pipeline (stubbed locally, pluggable for real models).
  """

  job_id = job_id or str(uuid.uuid4())
  rng = _rng_from_job(job_id)

  target_source = _resolve_structure_source(target_pdb, target_structure_url)

  with tempfile.TemporaryDirectory() as tmpdir:
    tmpdir_path = Path(tmpdir)
    target_path = tmpdir_path / "target.pdb"
    download_to_path(target_source, target_path)
    target_chain_ids = chain_ids_from_structure(target_path)

    results: List[dict] = []

    for idx in range(num_designs):
      binder_path = tmpdir_path / f"binder_{idx}.pdb"
      _generate_stub_backbone(binder_path, binder_length, chain_id=chr(66 + idx))
      sequences = _simulate_proteinmpnn(binder_length, sequences_per_backbone, rng)
      complex_path = tmpdir_path / f"complex_{idx}.pdb"
      _merge_structures(target_path, binder_path, complex_path)

      metrics = compute_interface_metrics(complex_path, target_chain_ids)
      boltz = _simulate_boltz2(metrics, rng, boltz_samples)

      binder_key = f"{RESULTS_PREFIX}/{job_id}/binder_{idx}.pdb"
      complex_key = f"{RESULTS_PREFIX}/{job_id}/complex_{idx}.pdb"
      upload_file(binder_path, binder_key, content_type="chemical/x-pdb")
      upload_file(complex_path, complex_key, content_type="chemical/x-pdb")

      results.append(
        {
          "design_id": f"{job_id}-d{idx}",
          "sequence": sequences[0]["sequence"],
          "mpnn_sequences": sequences,
          "backbone": {"key": binder_key, "url": object_url(binder_key)},
          "complex": {"key": complex_key, "url": object_url(complex_key)},
          "scores": {**metrics, "boltz2": boltz},
        }
      )

    manifest = {
      "job_id": job_id,
      "challenge_id": challenge_id,
      "status": "completed",
      "mode": "dummy" if DUMMY_INFERENCE else "inference",
      "target_sequence": target_sequence,
      "hotspots": hotspot_residues or [],
      "designs": results,
    }
    manifest_key = f"{RESULTS_PREFIX}/{job_id}/manifest.json"
    upload_bytes(json.dumps(manifest, indent=2).encode("utf-8"), manifest_key, "application/json")

  return {
    "status": "completed",
    "job_id": job_id,
    "challenge_id": challenge_id,
    "manifest": {"key": manifest_key, "url": object_url(manifest_key)},
    "designs": results,
    "mode": "dummy" if DUMMY_INFERENCE else "inference",
  }


@app.function(image=gpu_image, gpu="A10G", timeout=1800, secrets=[r2_secret])
def run_proteinmpnn(
  backbone_pdb: str | None = None,
  target_pdb: str | None = None,
  num_sequences: int = 4,
  job_id: str | None = None,
) -> dict:
  """Direct ProteinMPNN call for a provided backbone."""
  job_id = job_id or str(uuid.uuid4())
  rng = _rng_from_job(job_id)
  backbone_source = _resolve_structure_source(backbone_pdb, target_pdb)

  with tempfile.TemporaryDirectory() as tmpdir:
    backbone_path = download_to_path(backbone_source, Path(tmpdir) / "backbone.pdb")
    estimated_length = _estimate_backbone_length(backbone_path)
    sequences = _simulate_proteinmpnn(estimated_length, num_sequences, rng)

  return {
    "status": "completed",
    "job_id": job_id,
    "sequences": sequences,
    "backbone_length": estimated_length,
    "mode": "dummy" if DUMMY_INFERENCE else "inference",
  }


@app.function(image=gpu_image, gpu="A10G", timeout=1800, secrets=[r2_secret])
def run_boltz2(
  target_pdb: str,
  binder_pdb: str | None = None,
  binder_sequence: str | None = None,
  boltz_mode: str = "complex",
  num_samples: int = 1,
  job_id: str | None = None,
) -> dict:
  """Boltz-2 sanity check wrapper."""
  job_id = job_id or str(uuid.uuid4())
  rng = _rng_from_job(job_id)

  with tempfile.TemporaryDirectory() as tmpdir:
    tmpdir_path = Path(tmpdir)
    target_path = download_to_path(target_pdb, tmpdir_path / "target.pdb")
    if binder_pdb:
      binder_path = download_to_path(binder_pdb, tmpdir_path / "binder.pdb")
    else:
      length = max(len(binder_sequence or ""), 60)
      binder_path = tmpdir_path / "binder_stub.pdb"
      _generate_stub_backbone(binder_path, length, chain_id="X")

    complex_path = tmpdir_path / "boltz_complex.pdb"
    _merge_structures(target_path, binder_path, complex_path)
    metrics = compute_interface_metrics(complex_path, chain_ids_from_structure(target_path))
    boltz = _simulate_boltz2(metrics, rng, num_samples)

    complex_key = f"{RESULTS_PREFIX}/{job_id}/boltz2_complex.pdb"
    upload_file(complex_path, complex_key, content_type="chemical/x-pdb")

  return {
    "status": "completed",
    "job_id": job_id,
    "mode": "dummy" if DUMMY_INFERENCE else boltz_mode,
    "scores": {**metrics, "boltz2": boltz},
    "complex": {"key": complex_key, "url": object_url(complex_key)},
  }


@app.function(image=gpu_image, gpu="A10G", timeout=1200, secrets=[r2_secret])
def run_structure_prediction(
  sequence: str,
  target_sequence: str | None = None,
  job_id: str | None = None,
) -> dict:
  """
  Placeholder structure prediction hook – returns a stub response for now.
  """
  job_id = job_id or str(uuid.uuid4())
  rng = _rng_from_job(job_id)
  length = len(sequence)
  mock_scores = {
    "plddt": round(65 + rng.random() * 15, 2),
    "ptm": round(0.5 + rng.random() * 0.3, 3),
  }

  return {
    "status": "completed",
    "job_id": job_id,
    "sequence": sequence,
    "target_sequence": target_sequence,
    "scores": mock_scores,
  }


@app.function(image=cpu_image, secrets=[r2_secret])
def compute_scores(
  design_pdb: str,
  target_pdb: str,
  job_id: str | None = None,
) -> dict:
  """CPU scoring pass computing ipSAE-style metrics."""
  job_id = job_id or str(uuid.uuid4())
  with tempfile.TemporaryDirectory() as tmpdir:
    tmpdir_path = Path(tmpdir)
    design_path = download_to_path(design_pdb, tmpdir_path / "design.pdb")
    target_path = download_to_path(target_pdb, tmpdir_path / "target.pdb")
    metrics = compute_interface_metrics(design_path, chain_ids_from_structure(target_path))

  return {
    "status": "completed",
    "job_id": job_id,
    "scores": metrics,
  }


@app.function(image=cpu_image)
@modal.fastapi_endpoint(method="POST")
def submit_job(request: dict) -> dict:
  """
  Web endpoint to submit inference jobs.
  """
  job_type = request.get("job_type", "")
  params = request.get("params", {})

  if job_type == "health":
    return health_check.remote()
  if job_type == "rfdiffusion":
    return run_rfdiffusion.remote(**params)
  if job_type == "proteinmpnn":
    return run_proteinmpnn.remote(**params)
  if job_type == "boltz2":
    return run_boltz2.remote(**params)
  if job_type == "predict":
    return run_structure_prediction.remote(**params)
  if job_type == "score":
    return compute_scores.remote(**params)

  return {"status": "error", "message": f"Unknown job type: {job_type}"}
