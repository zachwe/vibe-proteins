"""
VibeProteins Modal Functions

This module wires up GPU inference pipelines (RFdiffusion3, ProteinMPNN, Boltz-2),
shared Cloudflare R2 utilities, and ipSAE-style interface scoring.

The heavy ML models are wired through Modal images. Some pipelines still return
stub outputs until their model hooks are implemented, but mocking should live
outside the Modal runtime when possible.
"""

from __future__ import annotations

import json
import math
import os
import random
import re
import shlex
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import List

import modal

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
  sys.path.append(str(CURRENT_DIR))

from utils.boltz_helpers import (
  _clean_sequence,
  _extract_chain_sequences,
  _read_boltz_confidence,
  _select_boltz_prediction,
  _select_chain_id,
  _write_boltz_yaml,
)
from utils.metrics import chain_ids_from_structure, compute_interface_metrics
from utils.rfd3_shim import RMSNORM_SHIM, ensure_rmsnorm
from utils.storage import download_to_path, object_url, upload_bytes, upload_file

app = modal.App("vibeproteins")

TORCH_INDEX = "https://download.pytorch.org/whl/cu121"
BOLTZ_TORCH_VERSION = "2.9.1"
BOLTZ_TORCHVISION_VERSION = "0.24.1"
BOLTZ_TORCHAUDIO_VERSION = "2.9.1"
RFD3_TORCH_INDEX = "https://download.pytorch.org/whl/cu121"
RFD3_TORCH_VERSION = "2.3.1"
COMMON_PY_PKGS = [
  "boto3",
  "biopython",
  "numpy<2.0",
  "packaging",
  "scipy",
  "requests",
  "pyyaml",
  "wheel",
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
  .add_local_python_source("utils")
)

cpu_image = modal.Image.debian_slim(python_version="3.11").pip_install(*COMMON_PY_PKGS) .add_local_python_source("utils")

boltz_image = (
  modal.Image.debian_slim(python_version="3.11")
  .apt_install("git", "libxrender1", "libxext6", "libsm6")
  .pip_install(*COMMON_PY_PKGS)
  .pip_install(
    f"torch=={BOLTZ_TORCH_VERSION}",
    f"torchvision=={BOLTZ_TORCHVISION_VERSION}",
    f"torchaudio=={BOLTZ_TORCHAUDIO_VERSION}",
    "boltz[cuda]==2.2.1",
  )
  .add_local_python_source("utils")
)

proteinmpnn_image = (
  modal.Image.debian_slim(python_version="3.11")
  .apt_install("git")
  .pip_install(*COMMON_PY_PKGS)
  .pip_install(
    "torch==2.1.2",
    "torchvision==0.16.2",
    "torchaudio==2.1.2",
    extra_index_url=TORCH_INDEX,
  )
  .run_commands("git clone https://github.com/dauparas/ProteinMPNN.git /proteinmpnn")
  .add_local_python_source("utils")
)

rfdiffusion3_image = (
  modal.Image.debian_slim(python_version="3.12")
  .apt_install("git", "libgomp1", "libglib2.0-0", "libgl1", "libsm6", "libxext6", "libxrender1")
  .pip_install(*COMMON_PY_PKGS)
  .pip_install("rc-foundry[rfd3]")
  .pip_install(
    f"torch=={RFD3_TORCH_VERSION}",
    extra_index_url=RFD3_TORCH_INDEX,
  )
  .env({"FOUNDRY_CHECKPOINT_DIRS": "/rfd3-models"})
  .add_local_python_source("utils")
)

r2_secret = modal.Secret.from_name("r2-credentials")
RESULTS_PREFIX = os.environ.get("DESIGN_RESULTS_PREFIX", "designs").strip("/")
BOLTZ_CACHE_DIR = "/boltz-cache"
BOLTZ_VOLUME_NAME = os.environ.get("BOLTZ_VOLUME_NAME", "boltz-models")
BOLTZ_MODEL_VOLUME = modal.Volume.from_name(BOLTZ_VOLUME_NAME, create_if_missing=True)
BOLTZ_USE_MSA_SERVER = os.environ.get("BOLTZ_USE_MSA_SERVER", "0").lower() in {"1", "true", "yes", "on"}
BOLTZ_EXTRA_ARGS = os.environ.get("BOLTZ_EXTRA_ARGS", "")
PROTEINMPNN_DIR = Path("/proteinmpnn")
RFD3_MODELS_DIR = Path("/rfd3-models")
RFD3_VOLUME_NAME = os.environ.get("RFD3_VOLUME_NAME", "rfd3-models")
RFD3_MODEL_VOLUME = modal.Volume.from_name(RFD3_VOLUME_NAME, create_if_missing=True)
RFD3_CHECKPOINT_FILENAME = os.environ.get("RFD3_CHECKPOINT_FILENAME", "rfd3_latest.ckpt")
RFD3_HOTSPOT_ATOMS = os.environ.get("RFD3_HOTSPOT_ATOMS", "ALL")
RFD3_LOW_MEMORY_MODE = os.environ.get("RFD3_LOW_MEMORY_MODE", "0").lower() in {"1", "true", "yes", "on"}
RFD3_EXTRA_ARGS = os.environ.get("RFD3_EXTRA_ARGS", "")
RFD3_MAX_BATCH_SIZE = int(os.environ.get("RFD3_MAX_BATCH_SIZE", "8"))
PROTEINMPNN_MODEL_NAME = os.environ.get("PROTEINMPNN_MODEL_NAME", "v_48_020")
PROTEINMPNN_SAMPLING_TEMP = os.environ.get("PROTEINMPNN_SAMPLING_TEMP", "0.1")
PROTEINMPNN_BATCH_SIZE = int(os.environ.get("PROTEINMPNN_BATCH_SIZE", "1"))


def _rng_from_job(job_id: str | None) -> random.Random:
  if not job_id:
    return random.Random()
  try:
    job_uuid = uuid.UUID(job_id)
    seed = job_uuid.int % (2**32 - 1)
  except ValueError:
    seed = sum(ord(c) for c in job_id)
  return random.Random(seed)


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


def _chain_lengths_from_pdb(path: Path) -> dict[str, int]:
  lengths: dict[str, int] = {}
  for line in path.read_text().splitlines():
    if line.startswith("ATOM") and line[12:16].strip() == "CA":
      chain_id = line[21].strip() or "_"
      lengths[chain_id] = lengths.get(chain_id, 0) + 1
  return lengths


def _chain_residue_segments_from_pdb(path: Path) -> dict[str, list[tuple[int, int]]]:
  residues_by_chain: dict[str, list[int]] = {}
  for line in path.read_text().splitlines():
    if not line.startswith("ATOM"):
      continue
    if line[12:16].strip() != "CA":
      continue
    chain_id = line[21].strip() or "_"
    residue_field = line[22:26].strip()
    if not residue_field:
      continue
    try:
      residue_id = int(residue_field)
    except ValueError:
      continue
    residues = residues_by_chain.setdefault(chain_id, [])
    if not residues or residues[-1] != residue_id:
      residues.append(residue_id)

  segments_by_chain: dict[str, list[tuple[int, int]]] = {}
  for chain_id, residues in residues_by_chain.items():
    if not residues:
      continue
    segments: list[tuple[int, int]] = []
    start = residues[0]
    prev = residues[0]
    for residue_id in residues[1:]:
      if residue_id == prev + 1:
        prev = residue_id
        continue
      segments.append((start, prev))
      start = residue_id
      prev = residue_id
    segments.append((start, prev))
    segments_by_chain[chain_id] = segments

  return segments_by_chain


def _ordered_chain_ids_from_pdb(path: Path) -> List[str]:
  seen: List[str] = []
  for line in path.read_text().splitlines():
    if line.startswith("ATOM"):
      chain_id = line[21].strip() or "_"
      if chain_id not in seen:
        seen.append(chain_id)
  return seen


def _write_pdb_chains(source_path: Path, chain_ids: set[str], output_path: Path) -> Path:
  keep_lines: List[str] = []
  last_chain = None
  for line in source_path.read_text().splitlines():
    if line.startswith(("ATOM", "HETATM")):
      chain_id = line[21].strip() or "_"
      if chain_id in chain_ids:
        keep_lines.append(line)
        last_chain = chain_id
    elif line.startswith("TER") and last_chain in chain_ids:
      keep_lines.append(line)
    elif line.startswith("END"):
      continue
  keep_lines.append("END")
  output_path.write_text("\n".join(keep_lines) + "\n")
  return output_path


def _rfd3_cif_to_pdb(cif_path: Path, pdb_path: Path) -> Path:
  from Bio.PDB import MMCIFParser, PDBIO
  import gzip

  parser = MMCIFParser(QUIET=True)
  if cif_path.suffix == ".gz":
    decompressed = pdb_path.with_suffix(".cif")
    with gzip.open(cif_path, "rb") as handle:
      decompressed.write_bytes(handle.read())
    structure = parser.get_structure("rfd3", str(decompressed))
  else:
    structure = parser.get_structure("rfd3", str(cif_path))

  io = PDBIO()
  io.set_structure(structure)
  io.save(str(pdb_path))
  return pdb_path


def _format_hotspot_residues(hotspots: list[str] | None, default_chain: str) -> str | None:
  if not hotspots:
    return None
  formatted: List[str] = []
  for residue in hotspots:
    if not residue:
      continue
    match = re.search(r"([A-Za-z])\\s*[:\\-_/]?\\s*(\\d+)", residue)
    if match:
      chain_id, res_id = match.groups()
    elif residue.isdigit():
      chain_id, res_id = default_chain, residue
    else:
      continue
    formatted.append(f"{chain_id.upper()}{int(res_id)}")
  if not formatted:
    return None
  return ",".join(formatted)


def _rfd3_hotspot_selection(
  hotspots: list[str] | None,
  default_chain: str,
  atoms: str,
) -> dict[str, str] | None:
  if not hotspots:
    return None
  atoms = atoms.strip() or "ALL"
  selection: dict[str, str] = {}
  for residue in hotspots:
    if not residue:
      continue
    match = re.search(r"([A-Za-z])\\s*[:\\-_/]?\\s*(\\d+)", residue)
    if match:
      chain_id, res_id = match.groups()
    elif residue.isdigit():
      chain_id, res_id = default_chain, residue
    else:
      continue
    selection[f"{chain_id.upper()}{int(res_id)}"] = atoms
  return selection or None


def _rfd3_contig_string(
  ordered_chain_ids: List[str],
  chain_segments: dict[str, list[tuple[int, int]]],
  binder_length: int | str,
) -> str:
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


def _ensure_rfd3_models(models_dir: Path) -> None:
  models_dir.mkdir(parents=True, exist_ok=True)
  checkpoint_path = models_dir / RFD3_CHECKPOINT_FILENAME
  if checkpoint_path.exists():
    return
  subprocess.run(
    ["foundry", "install", "rfd3", "--checkpoint-dir", str(models_dir)],
    check=True,
  )


def _parse_mpnn_fasta(path: Path) -> List[dict]:
  sequences: List[dict] = []
  header = None
  buffer: List[str] = []
  for line in path.read_text().splitlines():
    line = line.strip()
    if not line:
      continue
    if line.startswith(">"):
      if header and buffer:
        sequences.append(_mpnn_entry_from_record(header, "".join(buffer)))
      header = line[1:]
      buffer = []
    else:
      buffer.append(line)
  if header and buffer:
    sequences.append(_mpnn_entry_from_record(header, "".join(buffer)))
  return [entry for entry in sequences if entry]


def _mpnn_entry_from_record(header: str, sequence: str) -> dict | None:
  score_match = re.search(r"score=([0-9.]+)", header)
  score = float(score_match.group(1)) if score_match else None
  entry = {"sequence": sequence}
  if score is not None:
    entry["score"] = score
    entry["log_prob"] = -score
  return entry


def _tail_file(path: Path, max_bytes: int = 20000) -> str:
  if not path.exists():
    return ""
  data = path.read_bytes()
  if len(data) > max_bytes:
    data = data[-max_bytes:]
  return data.decode("utf-8", errors="replace")


def _extract_rfd3_error(log_path: Path) -> str:
  if not log_path.exists():
    return ""
  text = log_path.read_text(errors="replace")
  for token in (
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
  return _tail_file(log_path)




def _run_proteinmpnn_local(
  backbone_path: Path,
  output_dir: Path,
  num_sequences: int,
  design_chains: List[str] | None = None,
  seed: int | None = None,
) -> List[dict]:
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
  sequences = _parse_mpnn_fasta(fasta_files[0])
  return sequences[:num_sequences]


def _ensure_boltz2_cache(cache_dir: Path) -> None:
  from boltz.main import download_boltz2

  cache_dir.mkdir(parents=True, exist_ok=True)
  if not (cache_dir / "boltz2_conf.ckpt").exists():
    download_boltz2(cache_dir)


@app.function(image=cpu_image)
def health_check() -> dict:
  """Simple health check to verify Modal is working."""
  return {"status": "ok", "message": "VibeProteins Modal ready"}


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

  job_id = job_id or str(uuid.uuid4())
  rng = _rng_from_job(job_id)

  target_source = _resolve_structure_source(target_pdb, target_structure_url)

  with tempfile.TemporaryDirectory() as tmpdir:
    tmpdir_path = Path(tmpdir)
    target_path = download_to_path(target_source, tmpdir_path / "target.pdb")
    chain_segments = _chain_residue_segments_from_pdb(target_path)
    if not chain_segments:
      raise ValueError("Target PDB does not contain any protein chains.")
    ordered_chain_ids = _ordered_chain_ids_from_pdb(target_path)
    target_chain_ids = set(chain_segments.keys())
    default_chain_id = next(
      (chain_id for chain_id in ordered_chain_ids if chain_id in target_chain_ids),
      None,
    )
    if not default_chain_id:
      raise ValueError("Target PDB does not contain any protein chains.")

    contig_str = _rfd3_contig_string(ordered_chain_ids, chain_segments, binder_length)
    hotspot_selection = _rfd3_hotspot_selection(
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

    _ensure_rfd3_models(RFD3_MODELS_DIR)

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
    current_dir = str(CURRENT_DIR)
    entries = [str(tmpdir_path), current_dir]
    if pythonpath:
      entries.append(pythonpath)
    env["PYTHONPATH"] = ":".join(entries)
    env["HYDRA_FULL_ERROR"] = "1"

    log_path = tmpdir_path / "rfd3_run.log"
    with log_path.open("w", encoding="utf-8") as log_handle:
      try:
        subprocess.run(cmd, check=True, env=env, stdout=log_handle, stderr=log_handle)
      except subprocess.CalledProcessError as exc:
        tail = _extract_rfd3_error(log_path)
        raise RuntimeError(f"RFD3 inference failed. Log snippet:\\n{tail}") from exc

    cif_paths = sorted(out_dir.glob("*.cif*"))
    if not cif_paths:
      raise FileNotFoundError("No RFD3 outputs found in the inference directory.")

    results: List[dict] = []
    for idx, cif_path in enumerate(cif_paths[:num_designs]):
      complex_path = tmpdir_path / f"complex_{idx}.pdb"
      _rfd3_cif_to_pdb(cif_path, complex_path)

      output_chain_ids = set(chain_ids_from_structure(complex_path))
      binder_chain_ids = output_chain_ids - target_chain_ids
      if not binder_chain_ids:
        output_ordered = _ordered_chain_ids_from_pdb(complex_path)
        if output_ordered:
          binder_chain_ids = {output_ordered[-1]}
      if not binder_chain_ids:
        raise ValueError("Unable to identify binder chain in RFD3 output.")

      binder_path = tmpdir_path / f"binder_{idx}.pdb"
      _write_pdb_chains(complex_path, binder_chain_ids, binder_path)

      mpnn_sequences: List[dict] = []
      if sequences_per_backbone and sequences_per_backbone > 0:
        mpnn_result = run_proteinmpnn.remote(
          backbone_pdb=binder_path.read_text(),
          num_sequences=sequences_per_backbone,
          job_id=f"{job_id}-mpnn{idx}",
        )
        if isinstance(mpnn_result, dict):
          mpnn_sequences = mpnn_result.get("sequences", []) or []

      metrics = compute_interface_metrics(complex_path, target_chain_ids)
      boltz = None
      if boltz_samples and boltz_samples > 0:
        boltz_result = run_boltz2.remote(
          target_pdb=target_path.read_text(),
          binder_pdb=binder_path.read_text(),
          num_samples=boltz_samples,
          job_id=f"{job_id}-b{idx}",
        )
        boltz = boltz_result.get("boltz2") if isinstance(boltz_result, dict) else None

      binder_key = f"{RESULTS_PREFIX}/{job_id}/binder_{idx}.pdb"
      complex_key = f"{RESULTS_PREFIX}/{job_id}/complex_{idx}.pdb"
      upload_file(binder_path, binder_key, content_type="chemical/x-pdb")
      upload_file(complex_path, complex_key, content_type="chemical/x-pdb")

      sequence = mpnn_sequences[0]["sequence"] if mpnn_sequences else ""

      results.append(
        {
          "design_id": f"{job_id}-d{idx}",
          "sequence": sequence,
          "mpnn_sequences": mpnn_sequences,
          "backbone": {"key": binder_key, "url": object_url(binder_key)},
          "complex": {"key": complex_key, "url": object_url(complex_key)},
          "scores": {**metrics, "boltz2": boltz} if boltz else metrics,
        }
      )

    manifest = {
      "job_id": job_id,
      "challenge_id": challenge_id,
      "status": "completed",
      "mode": "inference",
      "pipeline": "rfdiffusion3",
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
    "mode": "inference",
    "pipeline": "rfdiffusion3",
  }


@app.function(image=proteinmpnn_image, gpu="A10G", timeout=1800, secrets=[r2_secret])
def run_proteinmpnn(
  backbone_pdb: str | None = None,
  target_pdb: str | None = None,
  num_sequences: int = 4,
  job_id: str | None = None,
) -> dict:
  """Direct ProteinMPNN call for a provided backbone."""
  job_id = job_id or str(uuid.uuid4())
  backbone_source = _resolve_structure_source(backbone_pdb, target_pdb)

  with tempfile.TemporaryDirectory() as tmpdir:
    backbone_path = download_to_path(backbone_source, Path(tmpdir) / "backbone.pdb")
    estimated_length = _estimate_backbone_length(backbone_path)
    sequences = _run_proteinmpnn_local(
      backbone_path=backbone_path,
      output_dir=Path(tmpdir) / "mpnn",
      num_sequences=num_sequences,
      seed=_rng_from_job(job_id).randint(1, 10_000_000),
    )

  return {
    "status": "completed",
    "job_id": job_id,
    "sequences": sequences,
    "backbone_length": estimated_length,
    "mode": "inference",
  }


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
) -> dict:
  """Boltz-2 sanity check wrapper."""
  job_id = job_id or str(uuid.uuid4())
  num_samples = max(int(num_samples), 1)

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
    _write_boltz_yaml(
      target_sequences=target_sequences,
      binder_sequence=binder_seq,
      binder_chain_id=binder_chain_id,
      output_path=input_path,
      use_msa_server=BOLTZ_USE_MSA_SERVER,
    )

    _ensure_boltz2_cache(Path(BOLTZ_CACHE_DIR))
    out_dir = tmpdir_path / "boltz_out"
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
    ]
    if BOLTZ_USE_MSA_SERVER:
      cmd.append("--use_msa_server")
    if BOLTZ_EXTRA_ARGS:
      cmd.extend(shlex.split(BOLTZ_EXTRA_ARGS))

    subprocess.run(cmd, check=True)

    results_dir = out_dir / f"boltz_results_{input_name}"
    boltz_out_dir = results_dir if results_dir.exists() else out_dir

    prediction_path = _select_boltz_prediction(boltz_out_dir, input_name)
    confidence = _read_boltz_confidence(boltz_out_dir, input_name)
    metrics = compute_interface_metrics(prediction_path, target_chain_ids)

    complex_ext = prediction_path.suffix.lower() or ".pdb"
    complex_key = f"{RESULTS_PREFIX}/{job_id}/boltz2_complex{complex_ext}"
    if complex_ext == ".cif":
      content_type = "chemical/x-mmcif"
    else:
      content_type = "chemical/x-pdb"
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
  iptm = confidence.get("iptm") if confidence else None
  ptm = confidence.get("ptm") if confidence else None

  boltz_summary = {
    "samples": num_samples,
    "iptm": iptm,
    "ptm": ptm,
    "plddt": plddt,
    "confidence_score": confidence.get("confidence_score") if confidence else None,
  }
  scores = {
    "plddt": plddt,
    "ptm": ptm,
    "iptm": iptm,
    "shapeComplementarity": metrics.get("shape_complementarity"),
    "buriedSurfaceArea": metrics.get("interface_area"),
  }

  return {
    "status": "completed",
    "job_id": job_id,
    "mode": boltz_mode,
    "scores": {key: value for key, value in scores.items() if value is not None},
    "interface_metrics": metrics,
    "boltz2": {key: value for key, value in boltz_summary.items() if value is not None},
    "complex": {"key": complex_key, "url": object_url(complex_key)},
    "structureUrl": object_url(complex_key),
    "confidence": {"key": confidence_key, "url": object_url(confidence_key)} if confidence_key else None,
    "designName": "Boltz-2 prediction",
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
  if job_type == "rfdiffusion3":
    return run_rfdiffusion3.remote(**params)
  if job_type == "proteinmpnn":
    return run_proteinmpnn.remote(**params)
  if job_type == "boltz2":
    return run_boltz2.remote(**params)
  if job_type == "predict":
    return run_structure_prediction.remote(**params)
  if job_type == "score":
    return compute_scores.remote(**params)

  return {"status": "error", "message": f"Unknown job type: {job_type}"}
