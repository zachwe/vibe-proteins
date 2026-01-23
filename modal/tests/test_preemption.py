"""Unit tests for preemption helpers."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from utils.preemption import NoopPreemptionAdapter, PreemptionManager


class TestPreemptionManager(unittest.TestCase):
    def test_save_and_load_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PreemptionManager(
                work_dir=Path(tmpdir),
                adapter=NoopPreemptionAdapter(),
            )
            manager.save_state({"phase": "coarse", "steps_completed": 3})
            loaded = manager.load_state()
            self.assertEqual(loaded["phase"], "coarse")


if __name__ == "__main__":
    unittest.main()
