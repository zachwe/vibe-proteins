"""
Composite scoring and feedback generation for protein designs.

Combines PAE-based ipSAE scores with interface metrics and confidence scores
to produce a single composite score and human-readable feedback.
"""

from __future__ import annotations

from typing import Any


def compute_composite_score(
    ipsae: float | None,
    interface_area: float | None,
    shape_complementarity: float | None,
    plddt: float | None,
    ptm: float | None,
    task_type: str = "binder",
) -> dict[str, Any]:
    """
    Compute weighted composite score per PLAN.md formula.

    Design_Score = 0.4 * normalized(ipSAE)
                 + 0.3 * normalized(interface + task-specific)
                 + 0.3 * normalized(structure confidence)

    Args:
        ipsae: ipSAE score (typically -1 to 0, more negative = better binding)
        interface_area: Buried surface area in Å²
        shape_complementarity: Shape complementarity score (0-1)
        plddt: pLDDT score (0-100)
        ptm: pTM score (0-1)
        task_type: Task type for scoring adjustments ("binder", "blocker", "decoy")

    Returns:
        dict with:
            - composite_score: Overall score (0-1, higher = better)
            - ipsae_contribution: Contribution from ipSAE
            - interface_contribution: Contribution from interface metrics
            - confidence_contribution: Contribution from structure confidence
            - grade: Letter grade (A-F)
    """
    # Normalize ipSAE (typically -1 to 0, more negative = better)
    # ipSAE of -0.8 or lower is excellent, -0.3 is moderate, 0 is poor
    if ipsae is not None:
        # Map -1 to 1.0, 0 to 0.0
        ipsae_norm = min(1.0, max(0.0, -ipsae))
    else:
        ipsae_norm = 0.0

    # Normalize interface metrics
    interface_norm = 0.0
    interface_count = 0

    if interface_area is not None:
        # 2000 Å² is considered good for a binder interface
        area_norm = min(1.0, interface_area / 2000.0)
        interface_norm += area_norm
        interface_count += 1

    if shape_complementarity is not None:
        interface_norm += shape_complementarity
        interface_count += 1

    if interface_count > 0:
        interface_norm /= interface_count

    # Normalize confidence metrics
    confidence_norm = 0.0
    confidence_count = 0

    if plddt is not None:
        # pLDDT is 0-100, >90 is excellent, >70 is confident
        plddt_norm = min(1.0, plddt / 100.0)
        confidence_norm += plddt_norm
        confidence_count += 1

    if ptm is not None:
        confidence_norm += ptm
        confidence_count += 1

    if confidence_count > 0:
        confidence_norm /= confidence_count

    # Compute weighted composite
    # Weights can be adjusted based on task type
    if task_type == "binder":
        w_ipsae, w_interface, w_confidence = 0.4, 0.3, 0.3
    elif task_type == "blocker":
        # For blockers, interface area might matter more
        w_ipsae, w_interface, w_confidence = 0.35, 0.35, 0.3
    elif task_type == "decoy":
        # For decoys, overall structure quality matters more
        w_ipsae, w_interface, w_confidence = 0.3, 0.3, 0.4
    else:
        w_ipsae, w_interface, w_confidence = 0.4, 0.3, 0.3

    composite = (
        w_ipsae * ipsae_norm +
        w_interface * interface_norm +
        w_confidence * confidence_norm
    )

    # Assign letter grade
    if composite >= 0.85:
        grade = "A"
    elif composite >= 0.70:
        grade = "B"
    elif composite >= 0.55:
        grade = "C"
    elif composite >= 0.40:
        grade = "D"
    else:
        grade = "F"

    return {
        "composite_score": round(composite, 3),
        "ipsae_contribution": round(w_ipsae * ipsae_norm, 3),
        "interface_contribution": round(w_interface * interface_norm, 3),
        "confidence_contribution": round(w_confidence * confidence_norm, 3),
        "grade": grade,
    }


def generate_feedback(
    ipsae: float | None,
    iptm: float | None,
    pdockq: float | None,
    plddt: float | None,
    interface_area: float | None,
    n_contacts: int | None,
    task_type: str = "binder",
) -> str:
    """
    Generate human-readable feedback based on scores.

    Args:
        ipsae: ipSAE score (more negative = better)
        iptm: Interface pTM score (0-1)
        pdockq: pDockQ score (0-1)
        plddt: pLDDT score (0-100)
        interface_area: Buried surface area in Å²
        n_contacts: Number of interface contacts
        task_type: Task type

    Returns:
        Human-readable feedback string
    """
    feedback: list[str] = []

    # Binding affinity assessment
    if ipsae is not None:
        if ipsae <= -0.7:
            feedback.append("Strong predicted binding affinity")
        elif ipsae <= -0.4:
            feedback.append("Moderate predicted binding affinity")
        elif ipsae <= -0.2:
            feedback.append("Weak predicted binding - consider redesigning")
        else:
            feedback.append("Very weak binding prediction - significant redesign needed")

    # Interface quality
    if pdockq is not None:
        if pdockq >= 0.5:
            feedback.append("High confidence in complex formation")
        elif pdockq >= 0.23:
            feedback.append("Moderate confidence in complex formation")
        else:
            feedback.append("Low confidence in complex formation")

    # Structural confidence
    if plddt is not None:
        if plddt >= 90:
            feedback.append("Excellent structural confidence")
        elif plddt >= 70:
            feedback.append("Good structural confidence")
        elif plddt >= 50:
            feedback.append("Moderate structural confidence - some regions may be disordered")
        else:
            feedback.append("Low structural confidence - consider verifying experimentally")

    # Interface size
    if interface_area is not None:
        if interface_area >= 1500:
            feedback.append("Large buried interface area")
        elif interface_area >= 800:
            feedback.append("Moderate interface area")
        elif interface_area >= 400:
            feedback.append("Small interface area - may need additional contacts")
        else:
            feedback.append("Very small interface - consider adding more contact residues")

    # Contact count
    if n_contacts is not None:
        if n_contacts >= 100:
            feedback.append("Many confident interface contacts")
        elif n_contacts >= 30:
            feedback.append("Reasonable number of interface contacts")
        elif n_contacts >= 10:
            feedback.append("Few interface contacts")
        else:
            feedback.append("Very few interface contacts - binding may be weak")

    if not feedback:
        return "Insufficient data for feedback generation."

    return ". ".join(feedback) + "."


def score_and_rank_designs(
    designs: list[dict[str, Any]],
    task_type: str = "binder",
) -> list[dict[str, Any]]:
    """
    Score and rank a list of designs.

    Args:
        designs: List of design dicts with score fields
        task_type: Task type for scoring

    Returns:
        Designs sorted by composite score (best first), with added composite_score field
    """
    scored_designs: list[dict[str, Any]] = []

    for design in designs:
        scores = design.get("scores", {})
        ipsae_scores = design.get("ipsae_scores", {})
        interface_metrics = design.get("interface_metrics", {})

        # Extract scores from various sources
        ipsae = ipsae_scores.get("ipsae") or scores.get("ipsae")
        interface_area = interface_metrics.get("interface_area") or scores.get("buriedSurfaceArea")
        shape_comp = interface_metrics.get("shape_complementarity") or scores.get("shapeComplementarity")
        plddt = scores.get("plddt")
        ptm = scores.get("ptm")

        composite = compute_composite_score(
            ipsae=ipsae,
            interface_area=interface_area,
            shape_complementarity=shape_comp,
            plddt=plddt,
            ptm=ptm,
            task_type=task_type,
        )

        # Generate feedback
        feedback = generate_feedback(
            ipsae=ipsae,
            iptm=ipsae_scores.get("iptm"),
            pdockq=ipsae_scores.get("pdockq"),
            plddt=plddt,
            interface_area=interface_area,
            n_contacts=ipsae_scores.get("n_interface_contacts"),
            task_type=task_type,
        )

        design_with_composite = {
            **design,
            "composite": composite,
            "feedback": feedback,
        }
        scored_designs.append(design_with_composite)

    # Sort by composite score descending (higher = better)
    scored_designs.sort(
        key=lambda d: d.get("composite", {}).get("composite_score", 0),
        reverse=True,
    )

    # Add rank
    for i, design in enumerate(scored_designs, 1):
        design["rank"] = i

    return scored_designs
