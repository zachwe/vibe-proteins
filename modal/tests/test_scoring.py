"""Unit tests for composite scoring module."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from utils.scoring import (  # noqa: E402
    compute_composite_score,
    generate_feedback,
    score_and_rank_designs,
)


class TestComputeCompositeScore(unittest.TestCase):
    """Tests for composite score calculation."""

    def test_perfect_scores(self) -> None:
        """All excellent scores should give high composite."""
        result = compute_composite_score(
            ipsae=-0.9,  # Excellent binding
            interface_area=2000,  # Good interface
            shape_complementarity=0.8,
            plddt=95,  # Excellent confidence
            ptm=0.9,
        )

        self.assertGreater(result["composite_score"], 0.8)
        self.assertEqual(result["grade"], "A")

    def test_poor_scores(self) -> None:
        """Poor scores should give low composite."""
        result = compute_composite_score(
            ipsae=-0.1,  # Weak binding
            interface_area=200,  # Small interface
            shape_complementarity=0.2,
            plddt=40,  # Low confidence
            ptm=0.3,
        )

        self.assertLess(result["composite_score"], 0.4)
        self.assertIn(result["grade"], ["D", "F"])

    def test_mixed_scores(self) -> None:
        """Mixed scores should give moderate composite."""
        result = compute_composite_score(
            ipsae=-0.5,  # Moderate binding
            interface_area=1000,  # Moderate interface
            shape_complementarity=0.5,
            plddt=75,  # Moderate confidence
            ptm=0.6,
        )

        self.assertGreater(result["composite_score"], 0.4)
        self.assertLess(result["composite_score"], 0.8)
        self.assertIn(result["grade"], ["B", "C"])

    def test_none_values(self) -> None:
        """Should handle None values gracefully."""
        result = compute_composite_score(
            ipsae=None,
            interface_area=None,
            shape_complementarity=None,
            plddt=None,
            ptm=None,
        )

        self.assertEqual(result["composite_score"], 0.0)
        self.assertEqual(result["grade"], "F")

    def test_partial_values(self) -> None:
        """Should handle partial data."""
        result = compute_composite_score(
            ipsae=-0.8,
            interface_area=None,
            shape_complementarity=None,
            plddt=90,
            ptm=None,
        )

        # Should still compute something meaningful
        self.assertGreater(result["composite_score"], 0)
        self.assertIsNotNone(result["grade"])

    def test_contributions_sum(self) -> None:
        """Contributions should approximately sum to composite score."""
        result = compute_composite_score(
            ipsae=-0.7,
            interface_area=1500,
            shape_complementarity=0.7,
            plddt=85,
            ptm=0.8,
        )

        expected_sum = (
            result["ipsae_contribution"]
            + result["interface_contribution"]
            + result["confidence_contribution"]
        )

        self.assertAlmostEqual(result["composite_score"], expected_sum, places=2)


class TestGenerateFeedback(unittest.TestCase):
    """Tests for feedback generation."""

    def test_strong_binding(self) -> None:
        """Should report strong binding for low ipSAE."""
        feedback = generate_feedback(
            ipsae=-0.8,
            iptm=0.7,
            pdockq=0.6,
            plddt=85,
            interface_area=1500,
            n_contacts=100,
        )

        self.assertIn("Strong predicted binding", feedback)

    def test_weak_binding(self) -> None:
        """Should warn about weak binding for high ipSAE."""
        feedback = generate_feedback(
            ipsae=-0.1,
            iptm=0.3,
            pdockq=0.1,
            plddt=60,
            interface_area=300,
            n_contacts=10,
        )

        self.assertIn("redesign", feedback.lower())

    def test_structure_confidence(self) -> None:
        """Should comment on structure confidence."""
        feedback_high = generate_feedback(
            ipsae=-0.5,
            iptm=None,
            pdockq=None,
            plddt=95,
            interface_area=None,
            n_contacts=None,
        )
        self.assertIn("Excellent structural confidence", feedback_high)

        feedback_low = generate_feedback(
            ipsae=-0.5,
            iptm=None,
            pdockq=None,
            plddt=40,
            interface_area=None,
            n_contacts=None,
        )
        self.assertIn("Low structural confidence", feedback_low)

    def test_no_data(self) -> None:
        """Should handle no data gracefully."""
        feedback = generate_feedback(
            ipsae=None,
            iptm=None,
            pdockq=None,
            plddt=None,
            interface_area=None,
            n_contacts=None,
        )

        self.assertIn("Insufficient data", feedback)


class TestScoreAndRankDesigns(unittest.TestCase):
    """Tests for design ranking."""

    def test_ranking_order(self) -> None:
        """Should rank designs by composite score (best first)."""
        designs = [
            {
                "design_id": "poor",
                "ipsae_scores": {"ipsae": -0.1},
                "scores": {"plddt": 50, "ptm": 0.3},
            },
            {
                "design_id": "best",
                "ipsae_scores": {"ipsae": -0.9},
                "scores": {"plddt": 95, "ptm": 0.9},
            },
            {
                "design_id": "medium",
                "ipsae_scores": {"ipsae": -0.5},
                "scores": {"plddt": 75, "ptm": 0.6},
            },
        ]

        ranked = score_and_rank_designs(designs)

        self.assertEqual(ranked[0]["design_id"], "best")
        self.assertEqual(ranked[0]["rank"], 1)
        self.assertEqual(ranked[1]["design_id"], "medium")
        self.assertEqual(ranked[1]["rank"], 2)
        self.assertEqual(ranked[2]["design_id"], "poor")
        self.assertEqual(ranked[2]["rank"], 3)

    def test_adds_composite_and_feedback(self) -> None:
        """Should add composite scores and feedback to each design."""
        designs = [
            {
                "design_id": "test",
                "ipsae_scores": {"ipsae": -0.7, "iptm": 0.6, "pdockq": 0.5},
                "scores": {"plddt": 85, "ptm": 0.7},
                "interface_metrics": {"interface_area": 1200},
            }
        ]

        ranked = score_and_rank_designs(designs)

        self.assertIn("composite", ranked[0])
        self.assertIn("composite_score", ranked[0]["composite"])
        self.assertIn("grade", ranked[0]["composite"])
        self.assertIn("feedback", ranked[0])
        self.assertIsInstance(ranked[0]["feedback"], str)

    def test_empty_designs(self) -> None:
        """Should handle empty list."""
        ranked = score_and_rank_designs([])
        self.assertEqual(ranked, [])


if __name__ == "__main__":
    unittest.main()
