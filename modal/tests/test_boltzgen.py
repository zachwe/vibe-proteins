"""Unit tests for BoltzGen pipeline utilities."""

from __future__ import annotations

import csv
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from pipelines.boltzgen import (  # noqa: E402
    find_boltzgen_structures,
    parse_boltzgen_metrics,
    write_boltzgen_yaml,
)


class TestWriteBoltzgenYaml(unittest.TestCase):
    """Tests for BoltzGen YAML specification generation."""

    def test_basic_yaml_generation(self) -> None:
        """Should generate valid YAML with minimal parameters."""
        import yaml

        with tempfile.TemporaryDirectory() as tmpdir:
            target_path = Path(tmpdir) / "target.pdb"
            target_path.write_text("ATOM 1 N GLY A 1\nEND\n")
            output_path = Path(tmpdir) / "design_spec.yaml"

            write_boltzgen_yaml(
                target_path=target_path,
                target_chain_ids=["A"],
                binder_length="80..120",
                binding_residues=None,
                output_path=output_path,
            )

            self.assertTrue(output_path.exists())
            spec = yaml.safe_load(output_path.read_text())

            # Should have entities section
            self.assertIn("entities", spec)
            entities = spec["entities"]
            self.assertEqual(len(entities), 2)

            # First entity should be the binder
            self.assertIn("protein", entities[0])
            self.assertEqual(entities[0]["protein"]["id"], "B")
            self.assertEqual(entities[0]["protein"]["sequence"], "80..120")

            # Second entity should be the target file
            self.assertIn("file", entities[1])
            self.assertEqual(entities[1]["file"]["path"], str(target_path))
            self.assertEqual(len(entities[1]["file"]["include"]), 1)
            self.assertEqual(entities[1]["file"]["include"][0]["chain"]["id"], "A")

            # Should not have binding_types without binding residues
            self.assertNotIn("binding_types", spec)

    def test_yaml_with_binding_residues(self) -> None:
        """Should include binding_types when binding residues specified."""
        import yaml

        with tempfile.TemporaryDirectory() as tmpdir:
            target_path = Path(tmpdir) / "target.pdb"
            target_path.write_text("ATOM 1 N GLY A 1\nEND\n")
            output_path = Path(tmpdir) / "design_spec.yaml"

            write_boltzgen_yaml(
                target_path=target_path,
                target_chain_ids=["A"],
                binder_length=100,
                binding_residues=["5..7", "13", "25..30"],
                output_path=output_path,
            )

            spec = yaml.safe_load(output_path.read_text())

            self.assertIn("binding_types", spec)
            binding_types = spec["binding_types"]
            self.assertEqual(len(binding_types), 1)
            self.assertEqual(binding_types[0]["chain"]["id"], "A")
            self.assertEqual(binding_types[0]["chain"]["binding"], "5..7,13,25..30")

    def test_yaml_with_multiple_target_chains(self) -> None:
        """Should include multiple target chains in file entity."""
        import yaml

        with tempfile.TemporaryDirectory() as tmpdir:
            target_path = Path(tmpdir) / "target.pdb"
            target_path.write_text("ATOM 1 N GLY A 1\nEND\n")
            output_path = Path(tmpdir) / "design_spec.yaml"

            write_boltzgen_yaml(
                target_path=target_path,
                target_chain_ids=["A", "C", "D"],
                binder_length="60..80",
                binding_residues=None,
                output_path=output_path,
            )

            spec = yaml.safe_load(output_path.read_text())
            file_entity = spec["entities"][1]["file"]
            include = file_entity["include"]

            self.assertEqual(len(include), 3)
            chain_ids = [inc["chain"]["id"] for inc in include]
            self.assertEqual(chain_ids, ["A", "C", "D"])

    def test_yaml_binder_length_integer(self) -> None:
        """Should handle integer binder length."""
        import yaml

        with tempfile.TemporaryDirectory() as tmpdir:
            target_path = Path(tmpdir) / "target.pdb"
            target_path.write_text("ATOM 1 N GLY A 1\nEND\n")
            output_path = Path(tmpdir) / "design_spec.yaml"

            write_boltzgen_yaml(
                target_path=target_path,
                target_chain_ids=["A"],
                binder_length=100,
                binding_residues=None,
                output_path=output_path,
            )

            spec = yaml.safe_load(output_path.read_text())
            self.assertEqual(spec["entities"][0]["protein"]["sequence"], "100")

    def test_yaml_binder_length_range_with_dash(self) -> None:
        """Should convert dash-separated range to double-dot format."""
        import yaml

        with tempfile.TemporaryDirectory() as tmpdir:
            target_path = Path(tmpdir) / "target.pdb"
            target_path.write_text("ATOM 1 N GLY A 1\nEND\n")
            output_path = Path(tmpdir) / "design_spec.yaml"

            write_boltzgen_yaml(
                target_path=target_path,
                target_chain_ids=["A"],
                binder_length="80-120",
                binding_residues=None,
                output_path=output_path,
            )

            spec = yaml.safe_load(output_path.read_text())
            self.assertEqual(spec["entities"][0]["protein"]["sequence"], "80..120")


class TestParseBoltzgenMetrics(unittest.TestCase):
    """Tests for BoltzGen metrics CSV parsing."""

    def test_parse_final_ranked_metrics(self) -> None:
        """Should parse metrics from final_ranked_designs directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            metrics_dir = output_dir / "final_ranked_designs"
            metrics_dir.mkdir(parents=True)

            # Create sample metrics CSV
            metrics_path = metrics_dir / "final_designs_metrics_10.csv"
            with metrics_path.open("w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=["design_id", "plddt", "iptm", "rmsd"])
                writer.writeheader()
                writer.writerow({"design_id": "design_0", "plddt": "0.85", "iptm": "0.72", "rmsd": "1.2"})
                writer.writerow({"design_id": "design_1", "plddt": "0.78", "iptm": "0.65", "rmsd": "1.8"})

            results = parse_boltzgen_metrics(output_dir, budget=10)

            self.assertEqual(len(results), 2)
            self.assertEqual(results[0]["design_id"], "design_0")
            self.assertEqual(results[0]["plddt"], "0.85")
            self.assertEqual(results[1]["design_id"], "design_1")
            self.assertEqual(results[1]["rmsd"], "1.8")

    def test_parse_fallback_all_designs_metrics(self) -> None:
        """Should fallback to all_designs_metrics.csv if final not found."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            metrics_dir = output_dir / "final_ranked_designs"
            metrics_dir.mkdir(parents=True)

            # Create all_designs_metrics.csv instead of final_designs_metrics
            metrics_path = metrics_dir / "all_designs_metrics.csv"
            with metrics_path.open("w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=["design_id", "score"])
                writer.writeheader()
                writer.writerow({"design_id": "d0", "score": "0.9"})

            results = parse_boltzgen_metrics(output_dir, budget=5)

            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["score"], "0.9")

    def test_parse_no_metrics_file(self) -> None:
        """Should return empty list if no metrics file exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            output_dir.mkdir(parents=True, exist_ok=True)

            results = parse_boltzgen_metrics(output_dir, budget=10)

            self.assertEqual(results, [])


class TestFindBoltzgenStructures(unittest.TestCase):
    """Tests for BoltzGen structure file discovery."""

    def test_find_in_final_ranked_designs(self) -> None:
        """Should find structures in final_ranked_designs directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            final_dir = output_dir / "final_ranked_designs" / "final_5_designs"
            final_dir.mkdir(parents=True)

            # Create structure files
            (final_dir / "design_0.cif").write_text("data_design_0\n")
            (final_dir / "design_1.cif").write_text("data_design_1\n")
            (final_dir / "design_2.cif").write_text("data_design_2\n")

            structures = find_boltzgen_structures(output_dir, budget=5)

            self.assertEqual(len(structures), 3)
            self.assertTrue(all(s.suffix == ".cif" for s in structures))

    def test_find_respects_budget_limit(self) -> None:
        """Should limit returned structures to budget count."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            # Budget is 5, but we put 10 structures in intermediate_designs to test the limit
            intermediate_dir = output_dir / "intermediate_designs"
            intermediate_dir.mkdir(parents=True)

            # Create more structures than budget
            for i in range(10):
                (intermediate_dir / f"design_{i}.cif").write_text(f"data_{i}\n")

            structures = find_boltzgen_structures(output_dir, budget=5)

            self.assertEqual(len(structures), 5)

    def test_find_fallback_to_refold_dir(self) -> None:
        """Should fallback to intermediate_designs_inverse_folded/refold_cif."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            refold_dir = output_dir / "intermediate_designs_inverse_folded" / "refold_cif"
            refold_dir.mkdir(parents=True)

            (refold_dir / "seq_0.cif").write_text("data_0\n")
            (refold_dir / "seq_1.cif").write_text("data_1\n")

            structures = find_boltzgen_structures(output_dir, budget=10)

            self.assertEqual(len(structures), 2)

    def test_find_fallback_to_intermediate_designs(self) -> None:
        """Should fallback to intermediate_designs directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            intermediate_dir = output_dir / "intermediate_designs"
            intermediate_dir.mkdir(parents=True)

            (intermediate_dir / "backbone_0.cif").write_text("data_0\n")

            structures = find_boltzgen_structures(output_dir, budget=5)

            self.assertEqual(len(structures), 1)

    def test_find_empty_directory(self) -> None:
        """Should return empty list for empty output directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)

            structures = find_boltzgen_structures(output_dir, budget=10)

            self.assertEqual(structures, [])

    def test_find_includes_pdb_files(self) -> None:
        """Should find both CIF and PDB files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            final_dir = output_dir / "final_ranked_designs" / "final_3_designs"
            final_dir.mkdir(parents=True)

            (final_dir / "design_0.cif").write_text("data_0\n")
            (final_dir / "design_1.pdb").write_text("ATOM 1\nEND\n")

            structures = find_boltzgen_structures(output_dir, budget=3)

            self.assertEqual(len(structures), 2)
            extensions = {s.suffix for s in structures}
            self.assertEqual(extensions, {".cif", ".pdb"})


if __name__ == "__main__":
    unittest.main()
