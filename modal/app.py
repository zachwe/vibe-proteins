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
import time
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
from utils.ipsae import compute_interface_scores_from_boltz, read_boltz_pae
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

# BoltzGen image - requires Python 3.11+, CUDA 12.1, and boltzgen package
BOLTZGEN_TORCH_VERSION = "2.5.1"
boltzgen_image = (
  modal.Image.debian_slim(python_version="3.11")
  .apt_install("git", "libgomp1", "libglib2.0-0", "libgl1", "libsm6", "libxext6", "libxrender1", "wget")
  .pip_install(*COMMON_PY_PKGS)
  .pip_install(
    f"torch=={BOLTZGEN_TORCH_VERSION}",
    extra_index_url=TORCH_INDEX,
  )
  .pip_install("boltzgen")
  .add_local_python_source("utils")
)

r2_secret = modal.Secret.from_name("r2-credentials")
RESULTS_PREFIX = os.environ.get("DESIGN_RESULTS_PREFIX", "designs").strip("/")
BOLTZ_CACHE_DIR = "/boltz-cache"
BOLTZ_VOLUME_NAME = os.environ.get("BOLTZ_VOLUME_NAME", "boltz-models")
BOLTZ_MODEL_VOLUME = modal.Volume.from_name(BOLTZ_VOLUME_NAME, create_if_missing=True)
# MSA server configuration
# By default, try the public MSA server with fallback to no MSA
BOLTZ_USE_MSA_SERVER = os.environ.get("BOLTZ_USE_MSA_SERVER", "1").lower() in {"1", "true", "yes", "on"}
BOLTZ_MSA_TIMEOUT_SECONDS = int(os.environ.get("BOLTZ_MSA_TIMEOUT_SECONDS", "600"))  # 10 min timeout for MSA

# ColabFold MSA server configuration
COLABFOLD_VOLUME_NAME = os.environ.get("COLABFOLD_VOLUME_NAME", "colabfold-dbs")
COLABFOLD_DB_DIR = Path("/colabfold-dbs")
colabfold_volume = modal.Volume.from_name(COLABFOLD_VOLUME_NAME, create_if_missing=True)

msa_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("mmseqs2", "wget")
    .pip_install(*COMMON_PY_PKGS)
    .add_local_python_source("utils")
)
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

# BoltzGen configuration
BOLTZGEN_CACHE_DIR = "/boltzgen-cache"
BOLTZGEN_VOLUME_NAME = os.environ.get("BOLTZGEN_VOLUME_NAME", "boltzgen-models")
BOLTZGEN_MODEL_VOLUME = modal.Volume.from_name(BOLTZGEN_VOLUME_NAME, create_if_missing=True)
BOLTZGEN_DEFAULT_PROTOCOL = os.environ.get("BOLTZGEN_DEFAULT_PROTOCOL", "protein-anything")
BOLTZGEN_DEFAULT_NUM_DESIGNS = int(os.environ.get("BOLTZGEN_DEFAULT_NUM_DESIGNS", "100"))
BOLTZGEN_DEFAULT_BUDGET = int(os.environ.get("BOLTZGEN_DEFAULT_BUDGET", "10"))


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
  image=msa_image,
  volumes={str(COLABFOLD_DB_DIR): colabfold_volume},
  memory=131072,  # 128GB RAM for MMseqs2 search
  timeout=1800,  # 30 min max per search
  cpu=8,
)
def run_msa_search(
  sequences: list[tuple[str, str]],
  job_id: str | None = None,
) -> dict:
  """
  Run MMseqs2 MSA search against ColabFold databases.

  Args:
    sequences: List of (chain_id, sequence) tuples
    job_id: Optional job ID for tracking

  Returns:
    dict with:
      - a3m_files: dict mapping chain_id to A3M file path
      - status: "completed" or "failed"
      - usage: timing info
  """
  start_time = time.time()
  job_id = job_id or str(uuid.uuid4())

  # Check if databases are available
  uniref_marker = COLABFOLD_DB_DIR / ".uniref30_complete"
  if not uniref_marker.exists():
    return {
      "status": "failed",
      "error": "ColabFold databases not set up. Run: modal run scripts/setup_colabfold_dbs.py",
      "job_id": job_id,
    }

  uniref_db = COLABFOLD_DB_DIR / "uniref30_2302" / "uniref30_2302_db"
  colabfold_db = COLABFOLD_DB_DIR / "colabfolddb_envdb_202108" / "colabfolddb_envdb_202108_db"

  with tempfile.TemporaryDirectory() as tmpdir:
    tmpdir_path = Path(tmpdir)
    a3m_files: dict[str, str] = {}

    for chain_id, sequence in sequences:
      # Write query FASTA
      query_fasta = tmpdir_path / f"{chain_id}_query.fasta"
      query_fasta.write_text(f">{chain_id}\n{sequence}\n")

      # Output paths
      result_dir = tmpdir_path / f"{chain_id}_result"
      result_dir.mkdir(exist_ok=True)
      a3m_path = tmpdir_path / f"{chain_id}.a3m"

      # Run MMseqs2 search against UniRef30
      print(f"Searching UniRef30 for chain {chain_id} ({len(sequence)} residues)...")
      search_cmd = [
        "mmseqs", "easy-search",
        str(query_fasta),
        str(uniref_db),
        str(result_dir / "uniref_hits.m8"),
        str(result_dir / "tmp"),
        "--format-output", "query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,tseq",
        "-e", "0.0001",
        "--max-seqs", "500",
        "-s", "7.5",
      ]

      try:
        subprocess.run(search_cmd, check=True, capture_output=True, text=True)
      except subprocess.CalledProcessError as e:
        print(f"MMseqs2 search failed for {chain_id}: {e.stderr}")
        continue

      # Convert results to A3M format
      hits_file = result_dir / "uniref_hits.m8"
      if hits_file.exists():
        a3m_content = _convert_mmseqs_to_a3m(query_fasta, hits_file)
        a3m_path.write_text(a3m_content)
        a3m_files[chain_id] = str(a3m_path)
        print(f"Generated MSA for chain {chain_id}: {a3m_path}")
      else:
        # No hits - create single-sequence A3M
        a3m_path.write_text(f">{chain_id}\n{sequence}\n")
        a3m_files[chain_id] = str(a3m_path)
        print(f"No MSA hits for chain {chain_id}, using single sequence")

    execution_seconds = round(time.time() - start_time, 2)

    return {
      "status": "completed",
      "job_id": job_id,
      "a3m_files": a3m_files,
      "usage": {
        "execution_seconds": execution_seconds,
      },
    }


def _convert_mmseqs_to_a3m(query_fasta: Path, hits_file: Path) -> str:
  """Convert MMseqs2 hits to A3M format."""
  # Read query sequence
  query_lines = query_fasta.read_text().strip().split("\n")
  query_id = query_lines[0][1:]  # Remove '>'
  query_seq = "".join(query_lines[1:])

  # Start with query as first sequence
  a3m_lines = [f">{query_id}", query_seq]

  # Parse hits and add aligned sequences
  if hits_file.exists():
    for line in hits_file.read_text().strip().split("\n"):
      if not line:
        continue
      parts = line.split("\t")
      if len(parts) >= 13:
        target_id = parts[1]
        target_seq = parts[12]  # tseq column
        # Add to A3M (MMseqs2 already provides aligned sequence)
        a3m_lines.append(f">{target_id}")
        a3m_lines.append(target_seq)

  return "\n".join(a3m_lines)


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
  start_time = time.time()
  gpu_type = "A10G"

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

      binder_sequences = _extract_chain_sequences(binder_path)
      backbone_sequence = binder_sequences[0][1] if binder_sequences else ""

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
      boltz_result = None
      boltz_scores = {}
      ipsae_scores = {}
      if boltz_samples and boltz_samples > 0:
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

      target_chain_list = sorted(target_chain_ids)
      binder_chain_list = sorted(binder_chain_ids)

      # Merge scores: RFD3 metrics + Boltz-2 scores (Boltz-2 takes precedence)
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

    manifest = {
      "job_id": job_id,
      "challenge_id": challenge_id,
      "status": "completed",
      "mode": "inference",
      "pipeline": "rfdiffusion3",
      "target_sequence": target_sequence,
      "hotspots": hotspot_residues or [],
      "target_chains": sorted(target_chain_ids),
      "designs": results,
    }
    manifest_key = f"{RESULTS_PREFIX}/{job_id}/manifest.json"
    upload_bytes(json.dumps(manifest, indent=2).encode("utf-8"), manifest_key, "application/json")

  execution_seconds = round(time.time() - start_time, 2)

  return {
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


def _run_boltz_prediction(
  input_path: Path,
  out_dir: Path,
  num_samples: int,
  use_msa_server: bool,
  timeout_seconds: int | None = None,
) -> subprocess.CompletedProcess:
  """
  Run Boltz-2 prediction with optional timeout.

  Args:
    input_path: Path to input YAML file
    out_dir: Output directory
    num_samples: Number of diffusion samples
    use_msa_server: Whether to use public MSA server
    timeout_seconds: Optional timeout in seconds

  Returns:
    CompletedProcess result

  Raises:
    subprocess.TimeoutExpired: If prediction times out
    subprocess.CalledProcessError: If prediction fails
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

  By default, attempts to use the public ColabFold MSA server for better predictions.
  If the MSA server times out or fails, automatically falls back to no MSA.

  Args:
    target_pdb: Target structure PDB content or URL
    binder_pdb: Binder structure PDB content or URL (optional)
    binder_sequence: Binder sequence (optional, extracted from binder_pdb if not provided)
    boltz_mode: Prediction mode (default "complex")
    num_samples: Number of diffusion samples
    job_id: Job ID for tracking
    use_self_hosted_msa: If True, use pre-computed MSAs from run_msa_search()
    msa_paths: Pre-computed MSA paths from run_msa_search() (dict of chain_id -> A3M path)
    skip_msa_server: If True, skip MSA server entirely (use empty MSA)
  """
  start_time = time.time()
  gpu_type = "A10G"

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
    out_dir = tmpdir_path / "boltz_out"

    _ensure_boltz2_cache(Path(BOLTZ_CACHE_DIR))

    # Determine MSA strategy
    use_msa_server = BOLTZ_USE_MSA_SERVER and not use_self_hosted_msa and not skip_msa_server
    msa_mode_used = "none"  # Track which MSA mode was actually used

    if use_msa_server:
      # Try with public MSA server first (with timeout)
      print(f"Attempting Boltz-2 prediction with public MSA server (timeout: {BOLTZ_MSA_TIMEOUT_SECONDS}s)...")

      _write_boltz_yaml(
        target_sequences=target_sequences,
        binder_sequence=binder_seq,
        binder_chain_id=binder_chain_id,
        output_path=input_path,
        use_msa_server=True,
        msa_paths=msa_paths,
      )

      try:
        _run_boltz_prediction(
          input_path=input_path,
          out_dir=out_dir,
          num_samples=num_samples,
          use_msa_server=True,
          timeout_seconds=BOLTZ_MSA_TIMEOUT_SECONDS,
        )
        msa_mode_used = "public_server"
        print("Boltz-2 prediction with MSA server completed successfully.")

      except subprocess.TimeoutExpired:
        print(f"MSA server timed out after {BOLTZ_MSA_TIMEOUT_SECONDS}s. Falling back to no MSA...")
        use_msa_server = False

      except subprocess.CalledProcessError as e:
        # Check if it's likely an MSA server issue (rate limit, network, etc.)
        print(f"Boltz-2 with MSA server failed: {e}. Falling back to no MSA...")
        use_msa_server = False

    if not use_msa_server or msa_mode_used == "none":
      # Run without MSA server (either as fallback or by choice)
      if msa_mode_used == "none":
        print("Running Boltz-2 prediction without MSA server...")

      # Rewrite YAML without MSA server
      _write_boltz_yaml(
        target_sequences=target_sequences,
        binder_sequence=binder_seq,
        binder_chain_id=binder_chain_id,
        output_path=input_path,
        use_msa_server=False,
        msa_paths=msa_paths,
      )

      # Clean up any partial output from failed attempt
      if out_dir.exists():
        import shutil
        shutil.rmtree(out_dir, ignore_errors=True)

      _run_boltz_prediction(
        input_path=input_path,
        out_dir=out_dir,
        num_samples=num_samples,
        use_msa_server=False,
        timeout_seconds=None,  # No timeout for fallback
      )
      msa_mode_used = "none"
      print("Boltz-2 prediction without MSA completed.")

    results_dir = out_dir / f"boltz_results_{input_name}"
    boltz_out_dir = results_dir if results_dir.exists() else out_dir

    prediction_path = _select_boltz_prediction(boltz_out_dir, input_name)
    confidence = _read_boltz_confidence(boltz_out_dir, input_name)

    # Compute distance-based interface metrics (fallback)
    distance_metrics = compute_interface_metrics(prediction_path, target_chain_ids)

    # Compute PAE-based ipSAE scores
    ipsae_scores = compute_interface_scores_from_boltz(
      out_dir=boltz_out_dir,
      structure_path=prediction_path,
      input_name=input_name,
      target_chains=list(target_chain_ids),
      binder_chain=binder_chain_id,
    )

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

  # Primary scores now include PAE-based metrics
  scores = {
    "plddt": plddt,
    "ptm": ptm,
    "iptm": iptm_confidence,
    # PAE-based ipSAE scores
    "ipsae": ipsae_scores.get("ipsae"),
    "ipsae_iptm": ipsae_scores.get("iptm"),  # ipTM from PAE (may differ from confidence.iptm)
    "pdockq": ipsae_scores.get("pdockq"),
    "pdockq2": ipsae_scores.get("pdockq2"),
    "lis": ipsae_scores.get("lis"),
    "n_interface_contacts": ipsae_scores.get("n_interface_contacts"),
    # Distance-based metrics (legacy/comparison)
    "shapeComplementarity": distance_metrics.get("shape_complementarity"),
    "buriedSurfaceArea": distance_metrics.get("interface_area"),
  }

  execution_seconds = round(time.time() - start_time, 2)

  return {
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


def _write_boltzgen_yaml(
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


def _parse_boltzgen_metrics(output_dir: Path, budget: int) -> list[dict]:
  """Parse BoltzGen output metrics from CSV files."""
  import csv

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


def _find_boltzgen_structures(output_dir: Path, budget: int) -> list[Path]:
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

  Args:
    target_pdb: Target structure as PDB string
    target_structure_url: URL to target structure
    target_chain_ids: Chain IDs to include from target (default: all)
    binder_length: Binder length spec (e.g., "80..120" for range, or 100 for fixed)
    binding_residues: Target residues to bind (e.g., ["5..7", "13"])
    protocol: Design protocol (protein-anything, peptide-anything, etc.)
    num_designs: Total designs to generate (100-60000 recommended)
    diffusion_batch_size: Designs per batch (auto-scales if not specified)
    step_scale: Sampling step scale parameter
    noise_scale: Sampling noise scale parameter
    inverse_fold_num_sequences: Sequences per backbone
    inverse_fold_avoid: Amino acids to avoid (e.g., "C" for no cysteines)
    skip_inverse_folding: Skip inverse folding step
    budget: Number of final designs after filtering
    alpha: Quality vs diversity trade-off (0.0-1.0, lower = more quality)
    filter_biased: Remove composition outliers
    refolding_rmsd_threshold: Max RMSD between design and refolded structure
    additional_filters: Extra filter expressions (e.g., ["ALA_fraction<0.3"])
    metrics_override: Per-metric ranking weights
    devices: Number of GPUs to use
    steps: Specific pipeline steps to run (design, inverse_folding, folding, analysis, filtering)
    reuse: Reuse existing results from previous runs
    job_id: Job ID for tracking
    challenge_id: Challenge ID for tracking

  Returns:
    dict with status, designs, metrics, and storage URLs
  """
  start_time = time.time()
  gpu_type = "A100"

  job_id = job_id or str(uuid.uuid4())
  target_source = _resolve_structure_source(target_pdb, target_structure_url)

  with tempfile.TemporaryDirectory() as tmpdir:
    tmpdir_path = Path(tmpdir)

    # Download target structure
    target_ext = ".cif" if target_structure_url and ".cif" in target_structure_url.lower() else ".pdb"
    target_path = download_to_path(target_source, tmpdir_path / f"target{target_ext}")

    # Determine target chains if not specified
    if not target_chain_ids:
      target_chain_ids = _ordered_chain_ids_from_pdb(target_path)
    if not target_chain_ids:
      raise ValueError("No protein chains found in target structure.")

    # Write design specification YAML
    design_spec_path = tmpdir_path / "design_spec.yaml"
    _write_boltzgen_yaml(
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
        tail = _tail_file(log_path, max_bytes=8000)
        raise RuntimeError(f"BoltzGen failed. Log snippet:\n{tail}") from exc

    # Parse results
    metrics_data = _parse_boltzgen_metrics(output_dir, budget)
    structure_paths = _find_boltzgen_structures(output_dir, budget)

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
        _rfd3_cif_to_pdb(struct_path, pdb_path)
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
    final_metrics_path = output_dir / f"final_ranked_designs/all_designs_metrics.csv"
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


@app.function(image=gpu_image, gpu="A10G", timeout=1200, secrets=[r2_secret])
def run_structure_prediction(
  sequence: str,
  target_sequence: str | None = None,
  job_id: str | None = None,
) -> dict:
  """
  Placeholder structure prediction hook – returns a stub response for now.
  """
  start_time = time.time()
  gpu_type = "A10G"

  job_id = job_id or str(uuid.uuid4())
  rng = _rng_from_job(job_id)
  length = len(sequence)
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
) -> dict:
  """CPU scoring pass computing ipSAE-style metrics."""
  start_time = time.time()

  job_id = job_id or str(uuid.uuid4())
  with tempfile.TemporaryDirectory() as tmpdir:
    tmpdir_path = Path(tmpdir)
    design_path = download_to_path(design_pdb, tmpdir_path / "design.pdb")
    target_path = download_to_path(target_pdb, tmpdir_path / "target.pdb")
    metrics = compute_interface_metrics(design_path, chain_ids_from_structure(target_path))

  execution_seconds = round(time.time() - start_time, 2)

  return {
    "status": "completed",
    "job_id": job_id,
    "scores": metrics,
    "usage": {
      "gpu_type": "CPU",  # CPU-only, no GPU
      "execution_seconds": execution_seconds,
    },
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
  if job_type == "boltzgen":
    return run_boltzgen.remote(**params)
  if job_type == "predict":
    return run_structure_prediction.remote(**params)
  if job_type == "score":
    return compute_scores.remote(**params)

  return {"status": "error", "message": f"Unknown job type: {job_type}"}
