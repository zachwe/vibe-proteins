"""Pipeline functions for protein design and analysis."""

from __future__ import annotations

import importlib
from typing import Dict

_EXPORTS: Dict[str, str] = {
    "run_rfdiffusion3": "pipelines.rfdiffusion3",
    "run_boltz2": "pipelines.boltz2",
    "run_boltzgen": "pipelines.boltzgen",
    "run_proteinmpnn": "pipelines.proteinmpnn",
    "compute_scores": "pipelines.scoring",
    "run_structure_prediction": "pipelines.scoring",
    "run_msa_search": "pipelines.msa",
    "run_mber_vhh": "pipelines.mber",
    "run_mosaic_trigram": "pipelines.mosaic",
    "run_mosaic_boltz2": "pipelines.mosaic",
}


def __getattr__(name: str):
    module_path = _EXPORTS.get(name)
    if not module_path:
        raise AttributeError(f"module 'pipelines' has no attribute '{name}'")
    module = importlib.import_module(module_path)
    return getattr(module, name)


__all__ = list(_EXPORTS.keys())
