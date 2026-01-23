"""Unit tests for mBER integration helpers."""

from __future__ import annotations

import csv
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from integrations.mber import (
    MBER_DEFAULT_MASKED_VHH,
    apply_mber_relax_patch,
    build_vhh_settings,
    check_mber_weights,
    normalize_mber_hotspots,
    parse_accepted_csv,
)


class TestMberHelpers(unittest.TestCase):
    def test_normalize_mber_hotspots(self) -> None:
        self.assertEqual(
            normalize_mber_hotspots(["A:10", "B20", "A-30"], "A"),
            "A10,B20,A30",
        )

    def test_build_vhh_settings(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            settings = build_vhh_settings(
                output_dir=Path(tmpdir),
                target_path=Path(tmpdir) / "target.pdb",
                target_chains=["A", "B"],
                hotspots=["A:10"],
                target_name="Target",
                masked_sequence=MBER_DEFAULT_MASKED_VHH,
                num_accepted=5,
                max_trajectories=10,
                min_iptm=0.8,
                min_plddt=0.75,
                skip_animations=True,
                skip_pickle=True,
                skip_png=True,
            )

            self.assertEqual(settings["target"]["chains"], "A,B")
            self.assertEqual(settings["target"]["hotspots"], "A10")
            self.assertEqual(settings["stopping"]["num_accepted"], 5)

    def test_parse_accepted_csv(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / "accepted.csv"
            with csv_path.open("w", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow([
                    "trajectory_name",
                    "binder_index",
                    "binder_seq",
                    "i_ptm",
                    "plddt",
                    "ptm",
                    "complex_pdb_path",
                    "relaxed_pdb_path",
                ])
                writer.writerow(["traj_1", "0", "ACDE", "0.9", "0.8", "0.7", "c.pdb", "r.pdb"])

            rows = parse_accepted_csv(csv_path)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["binder_seq"], "ACDE")
            self.assertAlmostEqual(rows[0]["i_ptm"], 0.9)

    def test_check_mber_weights_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            missing = check_mber_weights(Path(tmpdir))
            self.assertTrue(missing)

    def test_apply_mber_relax_patch(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            core_src = Path(tmpdir) / "src"
            eval_path = core_src / "mber" / "core" / "modules" / "evaluation.py"
            eval_path.parent.mkdir(parents=True, exist_ok=True)
            eval_path.write_text(
                "def _relax_pdb():\n"
                "    \"\"\"Relax PDB structure using the AMBER force field.\"\"\"\n"
                "    pass\n"
            )

            apply_mber_relax_patch(core_src)
            patched = eval_path.read_text()
            self.assertIn("MBER_SKIP_RELAX", patched)


if __name__ == "__main__":
    unittest.main()
