"""
Core configuration and utilities for Modal functions.
"""

from core.config import (
    app,
    job_status_dict,
    gpu_image,
    cpu_image,
    boltz_image,
    proteinmpnn_image,
    rfdiffusion3_image,
    boltzgen_image,
    msa_image,
    r2_secret,
    colabfold_volume,
    RESULTS_PREFIX,
    BOLTZ_CACHE_DIR,
    BOLTZ_MODEL_VOLUME,
    BOLTZ_USE_MSA_SERVER,
    BOLTZ_MSA_TIMEOUT_SECONDS,
    BOLTZ_EXTRA_ARGS,
    RFD3_MODELS_DIR,
    RFD3_MODEL_VOLUME,
    RFD3_CHECKPOINT_FILENAME,
    RFD3_HOTSPOT_ATOMS,
    RFD3_LOW_MEMORY_MODE,
    RFD3_EXTRA_ARGS,
    RFD3_MAX_BATCH_SIZE,
    PROTEINMPNN_DIR,
    PROTEINMPNN_MODEL_NAME,
    PROTEINMPNN_SAMPLING_TEMP,
    PROTEINMPNN_BATCH_SIZE,
    BOLTZGEN_CACHE_DIR,
    BOLTZGEN_MODEL_VOLUME,
    COLABFOLD_DB_DIR,
)

from core.job_status import (
    get_job_status,
    update_job_status,
    send_progress,
    send_completion,
)

__all__ = [
    # App
    "app",
    "job_status_dict",
    # Images
    "gpu_image",
    "cpu_image",
    "boltz_image",
    "proteinmpnn_image",
    "rfdiffusion3_image",
    "boltzgen_image",
    "msa_image",
    # Secrets and volumes
    "r2_secret",
    "colabfold_volume",
    "BOLTZ_MODEL_VOLUME",
    "RFD3_MODEL_VOLUME",
    "BOLTZGEN_MODEL_VOLUME",
    # Constants
    "RESULTS_PREFIX",
    "BOLTZ_CACHE_DIR",
    "BOLTZ_USE_MSA_SERVER",
    "BOLTZ_MSA_TIMEOUT_SECONDS",
    "BOLTZ_EXTRA_ARGS",
    "RFD3_MODELS_DIR",
    "RFD3_CHECKPOINT_FILENAME",
    "RFD3_HOTSPOT_ATOMS",
    "RFD3_LOW_MEMORY_MODE",
    "RFD3_EXTRA_ARGS",
    "RFD3_MAX_BATCH_SIZE",
    "PROTEINMPNN_DIR",
    "PROTEINMPNN_MODEL_NAME",
    "PROTEINMPNN_SAMPLING_TEMP",
    "PROTEINMPNN_BATCH_SIZE",
    "BOLTZGEN_CACHE_DIR",
    "COLABFOLD_DB_DIR",
    # Job status functions
    "get_job_status",
    "update_job_status",
    "send_progress",
    "send_completion",
]
