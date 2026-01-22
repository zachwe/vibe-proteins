"""Mosaic integration helpers."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from integrations.external import ExternalRepo

MOSAIC_REPO = ExternalRepo(
    name="mosaic",
    repo_url="https://github.com/escalante-bio/mosaic.git",
    ref="437ef86ad557e57bea667faeb676403b0a5737e5",
)

MOSAIC_TOKENS = "ARNDCQEGHILKMFPSTWYV"
MOSAIC_ASSETS_DIR = Path("/assets/mosaic")
MOSAIC_TRIGRAM_PATH = MOSAIC_ASSETS_DIR / "trigram_seg.pkl"


def pip_specs_for_mosaic() -> list[str]:
    return [MOSAIC_REPO.pip_spec()]


def decode_soft_sequence(soft_sequence: Iterable[Iterable[float]], tokens: str = MOSAIC_TOKENS) -> str:
    """Convert a soft sequence (N x 20) into a hard sequence via argmax."""
    sequence = []
    for row in soft_sequence:
        row_list = list(row)
        if not row_list:
            continue
        max_index = max(range(len(row_list)), key=row_list.__getitem__)
        sequence.append(tokens[max_index])
    return "".join(sequence)


def build_trigram_run_metadata(
    sequence_length: int,
    n_steps: int,
    stepsize: float,
    momentum: float,
    seed: int | None,
) -> dict[str, float | int | None]:
    return {
        "sequence_length": sequence_length,
        "n_steps": n_steps,
        "stepsize": stepsize,
        "momentum": momentum,
        "seed": seed,
    }
