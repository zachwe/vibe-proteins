from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
  sys.path.append(str(ROOT))

from utils.boltz_helpers import (  # noqa: E402
  _boltz_prediction_dirs,
  _clean_sequence,
  _extract_chain_sequences,
  _read_boltz_confidence,
  _select_boltz_prediction,
  _select_chain_id,
  _write_boltz_yaml,
)


class BoltzHelpersTest(unittest.TestCase):
  def test_clean_sequence(self) -> None:
    raw = ">seq1\nACD\n\n>seq2\nEF\n"
    self.assertEqual(_clean_sequence(raw), "ACDEF")

  def test_select_chain_id(self) -> None:
    self.assertEqual(_select_chain_id({"A", "B"}), "C")

  def test_extract_chain_sequences(self) -> None:
    repo_root = ROOT.parent
    pdb_path = repo_root / "sample_data/pdb/mini_complex.pdb"
    sequences = _extract_chain_sequences(pdb_path)
    chain_ids = {chain_id for chain_id, _ in sequences}
    lengths = {chain_id: len(seq) for chain_id, seq in sequences}
    self.assertEqual(chain_ids, {"A", "B"})
    self.assertEqual(lengths["A"], 3)
    self.assertEqual(lengths["B"], 3)

  def test_write_boltz_yaml_respects_msa_toggle(self) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
      path = Path(tmpdir) / "input.yaml"
      _write_boltz_yaml(
        target_sequences=[("A", "AAA")],
        binder_sequence="BBB",
        binder_chain_id="B",
        output_path=path,
        use_msa_server=False,
      )
      content = path.read_text()
      self.assertEqual(content.count("msa: empty"), 2)

      _write_boltz_yaml(
        target_sequences=[("A", "AAA")],
        binder_sequence="BBB",
        binder_chain_id="B",
        output_path=path,
        use_msa_server=True,
      )
      content = path.read_text()
      self.assertNotIn("msa: empty", content)

  def test_prediction_dirs_uses_manifest(self) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
      out_dir = Path(tmpdir)
      pred_dir = out_dir / "predictions" / "boltz_input"
      pred_dir.mkdir(parents=True)
      (out_dir / "processed").mkdir(parents=True)
      manifest = {"records": [{"id": "boltz_input"}]}
      (out_dir / "processed" / "manifest.json").write_text(json.dumps(manifest))

      dirs = _boltz_prediction_dirs(out_dir, "boltz_input")
      self.assertEqual(dirs, [pred_dir])

  def test_select_prediction_and_confidence(self) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
      out_dir = Path(tmpdir)
      pred_dir = out_dir / "predictions" / "sample"
      pred_dir.mkdir(parents=True)
      pred_path = pred_dir / "sample_model_0.pdb"
      pred_path.write_text("MODEL 1\nEND\n")

      conf0 = {"ptm": 0.1}
      conf1 = {"ptm": 0.9}
      (pred_dir / "confidence_sample_model_0.json").write_text(json.dumps(conf0))
      (pred_dir / "confidence_sample_model_1.json").write_text(json.dumps(conf1))

      selected = _select_boltz_prediction(out_dir, "sample")
      self.assertEqual(selected, pred_path)

      confidence = _read_boltz_confidence(out_dir, "sample")
      self.assertEqual(confidence["ptm"], 0.1)


if __name__ == "__main__":
  unittest.main()
