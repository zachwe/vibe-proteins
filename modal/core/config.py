"""
Modal configuration: images, volumes, secrets, and constants.
"""

import os
from pathlib import Path

import modal

from integrations.mber import pip_specs_for_mber
from integrations.mosaic import pip_specs_for_mosaic


def init_sentry():
    """Initialize Sentry SDK for error tracking."""
    import sentry_sdk  # Import inside function to avoid local dependency

    dsn = os.environ.get("SENTRY_DSN")
    if dsn:
        sentry_sdk.init(
            dsn=dsn,
            environment=os.environ.get("MODAL_ENVIRONMENT", "production"),
            send_default_pii=True,
        )


# App definition
app = modal.App("vibeproteins")

# Torch and package versions
TORCH_INDEX = "https://download.pytorch.org/whl/cu121"
BOLTZ_TORCH_VERSION = "2.9.1"
BOLTZ_TORCHVISION_VERSION = "0.24.1"
BOLTZ_TORCHAUDIO_VERSION = "2.9.1"
RFD3_TORCH_INDEX = "https://download.pytorch.org/whl/cu121"
RFD3_TORCH_VERSION = "2.3.1"
BOLTZGEN_TORCH_VERSION = "2.5.1"
MOSAIC_TORCH_VERSION = "2.7.1"

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
    "sentry-sdk>=2.0.0",
]

MOSAIC_PY_PKGS = [
    "boto3",
    "requests",
    "sentry-sdk>=2.0.0",
    "numpy==2.1",
    "scipy==1.15.1",
    "jax[cpu]",
    "equinox>=0.13.0",
    "jaxtyping",
    "tqdm",
]

MOSAIC_GPU_PY_PKGS = [
    "boto3",
    "requests",
    "sentry-sdk>=2.0.0",
    "numpy==2.1",
    "scipy==1.15.1",
    "jax[cuda12]",
    "equinox>=0.13.0",
    "jaxtyping",
    "tqdm",
    "gemmi>=0.6.5",
    "ml-collections>=1.0.0",
]


def _add_local_sources(image: modal.Image) -> modal.Image:
    """Add local Python sources to an image."""
    return (
        image.add_local_python_source("core")
        .add_local_python_source("integrations")
        .add_local_python_source("pipelines")
        .add_local_python_source("utils")
        .add_local_dir("assets", remote_path="/assets")
    )


# Docker images
gpu_image = _add_local_sources(
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

cpu_image = _add_local_sources(
    modal.Image.debian_slim(python_version="3.11").pip_install(*COMMON_PY_PKGS)
)

boltz_image = _add_local_sources(
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libxrender1", "libxext6", "libsm6")
    .pip_install(*COMMON_PY_PKGS)
    .pip_install(
        f"torch=={BOLTZ_TORCH_VERSION}",
        f"torchvision=={BOLTZ_TORCHVISION_VERSION}",
        f"torchaudio=={BOLTZ_TORCHAUDIO_VERSION}",
        "boltz[cuda]==2.2.1",
    )
)

proteinmpnn_image = _add_local_sources(
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
)

rfdiffusion3_image = _add_local_sources(
    modal.Image.debian_slim(python_version="3.12")
    .apt_install(
        "git", "libgomp1", "libglib2.0-0", "libgl1", "libsm6", "libxext6", "libxrender1"
    )
    .pip_install(*COMMON_PY_PKGS)
    .pip_install("rc-foundry[rfd3]")
    .pip_install(
        f"torch=={RFD3_TORCH_VERSION}",
        extra_index_url=RFD3_TORCH_INDEX,
    )
    .env({"FOUNDRY_CHECKPOINT_DIRS": "/rfd3-models"})
)

boltzgen_image = _add_local_sources(
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "git",
        "libgomp1",
        "libglib2.0-0",
        "libgl1",
        "libsm6",
        "libxext6",
        "libxrender1",
        "wget",
    )
    .pip_install(*COMMON_PY_PKGS)
    .pip_install(
        f"torch=={BOLTZGEN_TORCH_VERSION}",
        extra_index_url=TORCH_INDEX,
    )
    .pip_install("boltzgen")
)

mosaic_image = _add_local_sources(
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install(*MOSAIC_PY_PKGS)
    .run_commands(f"pip install --no-deps {pip_specs_for_mosaic()[0]}")
)

mosaic_gpu_image = _add_local_sources(
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git", "libgomp1")
    .pip_install(*MOSAIC_GPU_PY_PKGS)
    .pip_install(
        f"torch=={MOSAIC_TORCH_VERSION}",
        extra_index_url=TORCH_INDEX,
    )
    .pip_install("boltz[cuda]==2.2.1")
    .run_commands("pip install --no-deps git+https://github.com/nboyd/joltz")
    .run_commands(f"pip install --no-deps {pip_specs_for_mosaic()[0]}")
)

mber_image = _add_local_sources(
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "git",
        "wget",
        "libgomp1",
        "libglib2.0-0",
        "libgl1",
        "libsm6",
        "libxext6",
        "libxrender1",
    )
    .pip_install(*COMMON_PY_PKGS)
    .pip_install(*pip_specs_for_mber())
)

msa_image = _add_local_sources(
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("mmseqs2", "wget")
    .pip_install(*COMMON_PY_PKGS)
)

# Secrets
r2_secret = modal.Secret.from_name("r2-credentials")
sentry_secret = modal.Secret.from_name("sentry-dsn", required_keys=["SENTRY_DSN"])

# Volumes
BOLTZ_CACHE_DIR = "/boltz-cache"
BOLTZ_VOLUME_NAME = os.environ.get("BOLTZ_VOLUME_NAME", "boltz-models")
BOLTZ_MODEL_VOLUME = modal.Volume.from_name(BOLTZ_VOLUME_NAME, create_if_missing=True)

RFD3_MODELS_DIR = Path("/rfd3-models")
RFD3_VOLUME_NAME = os.environ.get("RFD3_VOLUME_NAME", "rfd3-models")
RFD3_MODEL_VOLUME = modal.Volume.from_name(RFD3_VOLUME_NAME, create_if_missing=True)

BOLTZGEN_CACHE_DIR = "/boltzgen-cache"
BOLTZGEN_VOLUME_NAME = os.environ.get("BOLTZGEN_VOLUME_NAME", "boltzgen-models")
BOLTZGEN_MODEL_VOLUME = modal.Volume.from_name(
    BOLTZGEN_VOLUME_NAME, create_if_missing=True
)

# BoltzGen work directory volume for preemption recovery
BOLTZGEN_WORK_DIR = "/boltzgen-work"
BOLTZGEN_WORK_VOLUME_NAME = os.environ.get("BOLTZGEN_WORK_VOLUME_NAME", "boltzgen-work")
BOLTZGEN_WORK_VOLUME = modal.Volume.from_name(
    BOLTZGEN_WORK_VOLUME_NAME, create_if_missing=True
)

MBER_WEIGHTS_DIR = "/root/.mber"
MBER_VOLUME_NAME = os.environ.get("MBER_VOLUME_NAME", "mber-weights")
MBER_MODEL_VOLUME = modal.Volume.from_name(MBER_VOLUME_NAME, create_if_missing=True)

MBER_WORK_DIR = "/mber-work"
MBER_WORK_VOLUME_NAME = os.environ.get("MBER_WORK_VOLUME_NAME", "mber-work")
MBER_WORK_VOLUME = modal.Volume.from_name(MBER_WORK_VOLUME_NAME, create_if_missing=True)

MOSAIC_WORK_DIR = "/mosaic-work"
MOSAIC_WORK_VOLUME_NAME = os.environ.get("MOSAIC_WORK_VOLUME_NAME", "mosaic-work")
MOSAIC_WORK_VOLUME = modal.Volume.from_name(
    MOSAIC_WORK_VOLUME_NAME, create_if_missing=True
)

COLABFOLD_VOLUME_NAME = os.environ.get("COLABFOLD_VOLUME_NAME", "colabfold-dbs")
COLABFOLD_DB_DIR = Path("/colabfold-dbs")
colabfold_volume = modal.Volume.from_name(COLABFOLD_VOLUME_NAME, create_if_missing=True)

# Job status Dict
job_status_dict = modal.Dict.from_name(
    "vibeproteins-job-status", create_if_missing=True
)

# Environment configuration
RESULTS_PREFIX = os.environ.get("DESIGN_RESULTS_PREFIX", "designs").strip("/")
PROTEINMPNN_DIR = Path("/proteinmpnn")

# RFD3 configuration
RFD3_CHECKPOINT_FILENAME = os.environ.get(
    "RFD3_CHECKPOINT_FILENAME", "rfd3_latest.ckpt"
)
RFD3_HOTSPOT_ATOMS = os.environ.get("RFD3_HOTSPOT_ATOMS", "ALL")
RFD3_LOW_MEMORY_MODE = os.environ.get("RFD3_LOW_MEMORY_MODE", "0").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
RFD3_EXTRA_ARGS = os.environ.get("RFD3_EXTRA_ARGS", "")
RFD3_MAX_BATCH_SIZE = int(os.environ.get("RFD3_MAX_BATCH_SIZE", "8"))

# ProteinMPNN configuration
PROTEINMPNN_MODEL_NAME = os.environ.get("PROTEINMPNN_MODEL_NAME", "v_48_020")
PROTEINMPNN_SAMPLING_TEMP = os.environ.get("PROTEINMPNN_SAMPLING_TEMP", "0.1")
PROTEINMPNN_BATCH_SIZE = int(os.environ.get("PROTEINMPNN_BATCH_SIZE", "1"))

# Boltz configuration
BOLTZ_USE_MSA_SERVER = os.environ.get("BOLTZ_USE_MSA_SERVER", "1").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
BOLTZ_MSA_TIMEOUT_SECONDS = int(os.environ.get("BOLTZ_MSA_TIMEOUT_SECONDS", "600"))
BOLTZ_EXTRA_ARGS = os.environ.get("BOLTZ_EXTRA_ARGS", "")

# BoltzGen configuration
BOLTZGEN_DEFAULT_PROTOCOL = os.environ.get(
    "BOLTZGEN_DEFAULT_PROTOCOL", "protein-anything"
)
BOLTZGEN_DEFAULT_NUM_DESIGNS = int(
    os.environ.get("BOLTZGEN_DEFAULT_NUM_DESIGNS", "100")
)
BOLTZGEN_DEFAULT_BUDGET = int(os.environ.get("BOLTZGEN_DEFAULT_BUDGET", "10"))
