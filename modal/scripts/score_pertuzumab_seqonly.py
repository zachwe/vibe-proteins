"""
Score Pertuzumab using sequences only (no PDB structure input).

This bypasses the multi-copy crystal structure issues by giving Boltz-2
just the raw sequences and letting it predict the complex from scratch.

Usage:
    cd modal && uv run modal run scripts/score_pertuzumab_seqonly.py
"""

from __future__ import annotations

import json
import subprocess
import tempfile
import time
from pathlib import Path

import modal

from core.config import app, boltz_image, r2_secret, BOLTZ_CACHE_DIR, BOLTZ_MODEL_VOLUME
from utils.boltz_helpers import _write_boltz_yaml, _read_boltz_confidence, _select_boltz_prediction
from utils.ipsae import compute_interface_scores_from_boltz

# Pertuzumab sequences extracted from PDB 1S78
TARGET_SEQUENCE = """TQVCTGTDMKLRLPASPETHLDMLRHLYQGCQVVQGNLELTYLPTNASLSFLQDIQEVQGYVLIAHNQVRQVPLQRLRIVRGTQLFEDNYALAVLDNGDPLNNTTPVTGASPGGLRELQLRSLTEILKGGVLIQRNPQLCYQDTILWKDIFHKNNQLALTLIDTNRSRACHPCSPMCKGSRCWGESSEDCQSLTRTVCAGGCARCKGPLPTDCCHEQCAAGCTGPKHSDCLACLHFNHSGICELHCPALVTYNTDTFESMPNPEGRYTFGASCVTACPYNYLSTDVGSCTLVCPLHNQEVTAEDGTQRCEKCSKPCARVCYGLGMEHLREVRAVTSANIQEFAGCKKIFGSLAFLPESFDGDPASNTAPLQPEQLQVFETLEEITGYLYISAWPDSLPDLSVFQNLQVIRGRILHNGAYSLTLQGLGISWLGLRSLRELGSGLALIHHNTHLCFVHTVPWDQLFRNPHQALLHTANRPEDECVGEGLACHQLCARGHCWGPGPTQCVNCSQFLRGQECVEECRVLQGLPREYVNARHCLPCHPECQPQNGSVTCFGPEADQCVACAHYKDPPFCVARCPSGVKPDLSYMPIWKFPDEEGACQPCPINCTHSCVDLDDKGCPAEQRASPLT"""

BINDER_HEAVY = """DIQMTQSPSSLSASVGDRVTITCKASQDVSIGVAWYQQKPGKAPKLLIYSASYRYTGVPSRFSGSGSGTDFTLTISSLQPEDFATYYCQQYYIYPYTFGQGTKVEIKRTVAAPSVFIFPPSDEQLKSGTASVVCLLNNFYPREAKVQWKVDNALQSGNSQESVTEQDSKDSTYSLSSTLTLSKADYEKHKVYACEVTHQGLSSPVTKSFNRGEC"""

BINDER_LIGHT = """EVQLVESGGGLVQPGGSLRLSCAASGFTFTDYTMDWVRQAPGKGLEWVADVNPNSGGSIYNQRFKGRFTLSVDRSKNTLYLQMNSLRAEDTAVYYCARNLGPSFYFDYWGQGTLVTVSSASTKGPSVFPLAPSSKSTSGGTAALGCLVKDYFPEPVTVSWNSGALTSGVHTFPAVLQSSGLYSLSSVVTVPSSSLGTQTYICNVNHKPSNTKVDKKVEPKSC"""


@app.function(
    image=boltz_image,
    gpu="A10G",
    timeout=3600,
    secrets=[r2_secret],
    volumes={BOLTZ_CACHE_DIR: BOLTZ_MODEL_VOLUME},
)
def score_pertuzumab_sequences():
    """Run Boltz-2 on Pertuzumab using sequences only."""
    from boltz.main import download_boltz2

    start_time = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Prepare sequences
        target_seq = TARGET_SEQUENCE.replace("\n", "").strip()
        heavy_seq = BINDER_HEAVY.replace("\n", "").strip()
        light_seq = BINDER_LIGHT.replace("\n", "").strip()

        print(f"Target (HER2): {len(target_seq)} aa")
        print(f"Binder Heavy: {len(heavy_seq)} aa")
        print(f"Binder Light: {len(light_seq)} aa")
        print(f"Total: {len(target_seq) + len(heavy_seq) + len(light_seq)} aa")

        # Set up chain IDs
        target_chain_id = "A"
        target_sequences = [(target_chain_id, target_seq)]

        # Multi-chain binder
        binder_sequences = [
            ("H", heavy_seq),
            ("L", light_seq),
        ]

        input_name = "pertuzumab_seqonly"
        input_path = tmpdir_path / f"{input_name}.yaml"
        out_dir = tmpdir_path / "boltz_out"

        # Ensure model cache
        cache_dir = Path(BOLTZ_CACHE_DIR)
        cache_dir.mkdir(parents=True, exist_ok=True)
        if not (cache_dir / "boltz2_conf.ckpt").exists():
            print("Downloading Boltz-2 model...")
            download_boltz2(cache_dir)

        # Write YAML input (WITH MSA from public server)
        _write_boltz_yaml(
            target_sequences=target_sequences,
            binder_sequence=None,
            binder_chain_id=None,
            output_path=input_path,
            use_msa_server=True,  # Use ColabFold public MSA server
            binder_sequences=binder_sequences,
        )

        print(f"\nBoltz input YAML:")
        print(input_path.read_text())

        # Run Boltz-2 with MSA server
        print("\nRunning Boltz-2 with MSA...")
        cmd = [
            "boltz", "predict", str(input_path),
            "--out_dir", str(out_dir),
            "--cache", BOLTZ_CACHE_DIR,
            "--output_format", "pdb",
            "--diffusion_samples", "1",
            "--override",
            "--write_full_pae",
            "--use_msa_server",  # Use ColabFold public MSA server
        ]
        subprocess.run(cmd, check=True)

        # Find results
        results_dir = out_dir / f"boltz_results_{input_name}"
        boltz_out_dir = results_dir if results_dir.exists() else out_dir

        prediction_path = _select_boltz_prediction(boltz_out_dir, input_name)
        confidence = _read_boltz_confidence(boltz_out_dir, input_name)

        print(f"\nPrediction: {prediction_path}")
        print(f"Confidence: {json.dumps(confidence, indent=2)}")

        # Compute interface scores
        target_chains = [target_chain_id]
        binder_chains = ["H", "L"]

        ipsae_scores = compute_interface_scores_from_boltz(
            out_dir=boltz_out_dir,
            structure_path=prediction_path,
            input_name=input_name,
            target_chains=target_chains,
            binder_chain=None,
            binder_chains=binder_chains,
        )

        # Extract confidence metrics
        complex_plddt = confidence.get("complex_plddt") if confidence else None
        plddt = round(complex_plddt * 100, 2) if isinstance(complex_plddt, (float, int)) else None
        ptm = confidence.get("ptm") if confidence else None

        execution_seconds = round(time.time() - start_time, 2)

        result = {
            "id": "pertuzumab-her2",
            "name": "Pertuzumab (sequence-only)",
            "pdb_id": "1S78",
            "method": "boltz2_seqonly",
            "execution_seconds": execution_seconds,
            "scores": {
                "plddt": plddt,
                "ptm": ptm,
                "iptm": ipsae_scores.get("iptm"),
                "ipSaeScore": ipsae_scores.get("ipsae"),
                "pdockq": ipsae_scores.get("pdockq"),
                "pdockq2": ipsae_scores.get("pdockq2"),
                "lis": ipsae_scores.get("lis"),
                "n_interface_contacts": ipsae_scores.get("n_interface_contacts"),
            },
        }

        print(f"\n=== Results ===")
        print(json.dumps(result, indent=2))

        return result


@app.local_entrypoint()
def main():
    """Run sequence-only scoring for Pertuzumab."""
    print("Scoring Pertuzumab with sequences only (no PDB structure)...")
    result = score_pertuzumab_sequences.remote()

    print(f"\n=== Final Result ===")
    print(json.dumps(result, indent=2))

    scores = result.get("scores", {})
    pdockq = scores.get("pdockq", 0)
    if pdockq and pdockq > 0:
        print(f"\n✓ Success! pDockQ = {pdockq:.3f}")
    else:
        print(f"\n✗ No interface contacts found")

    return result
