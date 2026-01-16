"""Unit tests for ipSAE scoring module."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from utils.ipsae import (  # noqa: E402
    calc_d0,
    compute_ipsae_from_pae,
    ptm_func,
    read_boltz_pae,
)


class TestPtmFunc(unittest.TestCase):
    """Tests for the PTM conversion function."""

    def test_ptm_zero_pae(self) -> None:
        """PAE of 0 should give maximum score of 1.0."""
        self.assertAlmostEqual(ptm_func(0.0, 1.0), 1.0)

    def test_ptm_at_d0(self) -> None:
        """PAE equal to d0 should give score of 0.5."""
        self.assertAlmostEqual(ptm_func(2.0, 2.0), 0.5)

    def test_ptm_large_pae(self) -> None:
        """Large PAE should give very low score."""
        self.assertLess(ptm_func(20.0, 2.0), 0.02)

    def test_ptm_vectorized(self) -> None:
        """Function should work with numpy arrays."""
        pae = np.array([0.0, 2.0, 10.0])
        d0 = 2.0
        result = ptm_func(pae, d0)
        self.assertEqual(result.shape, (3,))
        self.assertAlmostEqual(result[0], 1.0)
        self.assertAlmostEqual(result[1], 0.5)


class TestCalcD0(unittest.TestCase):
    """Tests for d0 calculation."""

    def test_short_sequence(self) -> None:
        """Sequences shorter than 27 should use 27 in formula."""
        d0_short = calc_d0(10)
        d0_min = calc_d0(27)
        self.assertEqual(d0_short, d0_min)

    def test_increasing_d0(self) -> None:
        """d0 should increase with sequence length."""
        d0_50 = calc_d0(50)
        d0_100 = calc_d0(100)
        d0_200 = calc_d0(200)
        self.assertLess(d0_50, d0_100)
        self.assertLess(d0_100, d0_200)

    def test_minimum_value(self) -> None:
        """d0 should be at least 1.0 for proteins."""
        d0 = calc_d0(27)
        self.assertGreaterEqual(d0, 1.0)

    def test_nucleic_acid_minimum(self) -> None:
        """d0 should be at least 2.0 for nucleic acids."""
        d0 = calc_d0(27, pair_type="nucleic_acid")
        self.assertGreaterEqual(d0, 2.0)


class TestComputeIpsaeFromPae(unittest.TestCase):
    """Tests for ipSAE calculation from PAE matrix."""

    def setUp(self) -> None:
        """Create a simple two-chain structure for testing."""
        self.tmpdir = tempfile.mkdtemp()
        self.pdb_path = Path(self.tmpdir) / "test.pdb"

        # Simple structure with chain A (3 residues) and chain B (3 residues)
        pdb_content = """ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 90.00           N
ATOM      2  CA  ALA A   1       1.458   0.000   0.000  1.00 90.00           C
ATOM      3  C   ALA A   1       2.009   1.420   0.000  1.00 90.00           C
ATOM      4  N   ALA A   2       3.500   0.000   0.000  1.00 85.00           N
ATOM      5  CA  ALA A   2       4.958   0.000   0.000  1.00 85.00           C
ATOM      6  C   ALA A   2       5.509   1.420   0.000  1.00 85.00           C
ATOM      7  N   ALA A   3       7.000   0.000   0.000  1.00 80.00           N
ATOM      8  CA  ALA A   3       8.458   0.000   0.000  1.00 80.00           C
ATOM      9  C   ALA A   3       9.009   1.420   0.000  1.00 80.00           C
TER
ATOM     10  N   ALA B   1      10.000   0.000   0.000  1.00 75.00           N
ATOM     11  CA  ALA B   1      11.458   0.000   0.000  1.00 75.00           C
ATOM     12  C   ALA B   1      12.009   1.420   0.000  1.00 75.00           C
ATOM     13  N   ALA B   2      13.500   0.000   0.000  1.00 70.00           N
ATOM     14  CA  ALA B   2      14.958   0.000   0.000  1.00 70.00           C
ATOM     15  C   ALA B   2      15.509   1.420   0.000  1.00 70.00           C
ATOM     16  N   ALA B   3      17.000   0.000   0.000  1.00 65.00           N
ATOM     17  CA  ALA B   3      18.458   0.000   0.000  1.00 65.00           C
ATOM     18  C   ALA B   3      19.009   1.420   0.000  1.00 65.00           C
TER
END
"""
        self.pdb_path.write_text(pdb_content)

    def tearDown(self) -> None:
        """Clean up temporary files."""
        import shutil

        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_confident_interface(self) -> None:
        """Low PAE values should give high scores (negative ipSAE)."""
        # 6x6 PAE matrix for 2 chains of 3 residues each
        # Low PAE (2-3 Å) between chains = confident interaction
        pae_matrix = np.array(
            [
                [0.5, 1.0, 1.5, 2.0, 2.5, 3.0],  # Chain A res 1
                [1.0, 0.5, 1.0, 2.5, 3.0, 3.5],  # Chain A res 2
                [1.5, 1.0, 0.5, 3.0, 3.5, 4.0],  # Chain A res 3
                [2.0, 2.5, 3.0, 0.5, 1.0, 1.5],  # Chain B res 1
                [2.5, 3.0, 3.5, 1.0, 0.5, 1.0],  # Chain B res 2
                [3.0, 3.5, 4.0, 1.5, 1.0, 0.5],  # Chain B res 3
            ]
        )

        result = compute_ipsae_from_pae(
            pae_matrix=pae_matrix,
            structure_path=self.pdb_path,
            chain_pairs=[("A", "B")],
        )

        # Should have confident interface
        # ipSAE should be negative (lower = better binding prediction)
        self.assertLess(result["ipsae"], 0)
        # Should have positive ipTM score (indicating some interface quality)
        self.assertGreater(result["iptm"], 0)
        # Should detect interface contacts (PAE < 12 Å cutoff)
        self.assertGreater(result["n_interface_contacts"], 0)

    def test_ipsae_uses_rowwise_max(self) -> None:
        """ipSAE should use max of row-wise pTM means (not global mean)."""
        pae_matrix = np.full((6, 6), 20.0)
        # Chain A (rows 0-2) -> Chain B (cols 3-5)
        pae_matrix[0:3, 3:6] = np.array(
            [
                [1.0, 1.0, 1.0],   # high-confidence row
                [10.0, 10.0, 10.0],
                [10.0, 10.0, 10.0],
            ]
        )
        # Chain B -> Chain A (rows 3-5, cols 0-2)
        pae_matrix[3:6, 0:3] = np.array(
            [
                [1.0, 1.0, 1.0],
                [10.0, 10.0, 10.0],
                [10.0, 10.0, 10.0],
            ]
        )

        result = compute_ipsae_from_pae(
            pae_matrix=pae_matrix,
            structure_path=self.pdb_path,
            chain_pairs=[("A", "B")],
        )

        d0 = calc_d0(6)
        expected = round(-ptm_func(1.0, d0), 4)
        self.assertEqual(result["ipsae"], expected)

    def test_weak_interface(self) -> None:
        """High PAE values should give low scores (close to zero ipSAE)."""
        # High PAE (>12 Å) between chains = weak interaction
        pae_matrix = np.array(
            [
                [0.5, 1.0, 1.5, 15.0, 18.0, 20.0],
                [1.0, 0.5, 1.0, 16.0, 18.0, 19.0],
                [1.5, 1.0, 0.5, 17.0, 19.0, 20.0],
                [15.0, 16.0, 17.0, 0.5, 1.0, 1.5],
                [18.0, 18.0, 19.0, 1.0, 0.5, 1.0],
                [20.0, 19.0, 20.0, 1.5, 1.0, 0.5],
            ]
        )

        result = compute_ipsae_from_pae(
            pae_matrix=pae_matrix,
            structure_path=self.pdb_path,
            chain_pairs=[("A", "B")],
        )

        # Should have no confident interface contacts
        self.assertEqual(result["n_interface_contacts"], 0)

    def test_empty_scores_on_missing_chains(self) -> None:
        """Should return empty scores if chains not in structure."""
        pae_matrix = np.zeros((6, 6))

        result = compute_ipsae_from_pae(
            pae_matrix=pae_matrix,
            structure_path=self.pdb_path,
            chain_pairs=[("X", "Y")],  # Non-existent chains
        )

        self.assertEqual(result["ipsae"], 0.0)
        self.assertEqual(result["n_interface_contacts"], 0)


class TestReadBoltzPae(unittest.TestCase):
    """Tests for reading PAE from Boltz-2 output."""

    def setUp(self) -> None:
        """Create mock Boltz-2 output structure."""
        self.tmpdir = tempfile.mkdtemp()
        self.out_dir = Path(self.tmpdir)

    def tearDown(self) -> None:
        """Clean up temporary files."""
        import shutil

        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_read_pae_from_npz(self) -> None:
        """Should read PAE matrix from NPZ file."""
        pred_dir = self.out_dir / "predictions" / "test_input"
        pred_dir.mkdir(parents=True)

        # Create mock PAE NPZ file
        pae_data = np.random.rand(10, 10) * 10
        np.savez(pred_dir / "pae_test_input_model_0.npz", pae=pae_data)

        result = read_boltz_pae(self.out_dir, "test_input")

        self.assertIsNotNone(result)
        self.assertEqual(result.shape, (10, 10))
        np.testing.assert_array_almost_equal(result, pae_data)

    def test_read_pae_with_manifest(self) -> None:
        """Should use manifest to find correct record ID."""
        pred_dir = self.out_dir / "predictions" / "record_abc"
        pred_dir.mkdir(parents=True)
        (self.out_dir / "processed").mkdir(parents=True)

        # Create manifest pointing to different record ID
        manifest = {"records": [{"id": "record_abc"}]}
        (self.out_dir / "processed" / "manifest.json").write_text(json.dumps(manifest))

        # Create PAE file with record ID from manifest
        pae_data = np.random.rand(5, 5) * 10
        np.savez(pred_dir / "pae_record_abc_model_0.npz", pae=pae_data)

        result = read_boltz_pae(self.out_dir, "different_name")

        self.assertIsNotNone(result)
        np.testing.assert_array_almost_equal(result, pae_data)

    def test_returns_none_when_no_pae(self) -> None:
        """Should return None if no PAE file exists."""
        (self.out_dir / "predictions" / "test").mkdir(parents=True)

        result = read_boltz_pae(self.out_dir, "test")

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
