"""Unit tests for Mosaic integration helpers."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from integrations.mosaic import (
    MOSAIC_TOKENS,
    build_trigram_run_metadata,
    decode_soft_sequence,
)


class TestMosaicHelpers(unittest.TestCase):
    def test_decode_soft_sequence(self) -> None:
        row_a = [0.0] * len(MOSAIC_TOKENS)
        row_c = [0.0] * len(MOSAIC_TOKENS)
        row_a[0] = 1.0
        row_c[2] = 1.0
        sequence = decode_soft_sequence([row_a, row_c])
        self.assertEqual(sequence, MOSAIC_TOKENS[0] + MOSAIC_TOKENS[2])

    def test_build_trigram_run_metadata(self) -> None:
        meta = build_trigram_run_metadata(
            sequence_length=42,
            n_steps=100,
            stepsize=0.2,
            momentum=0.7,
            seed=123,
        )
        self.assertEqual(meta["sequence_length"], 42)
        self.assertEqual(meta["seed"], 123)


if __name__ == "__main__":
    unittest.main()
