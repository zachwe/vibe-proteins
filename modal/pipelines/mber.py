"""mBER VHH binder design pipeline."""

from __future__ import annotations

import json
import os
import subprocess
import time
import uuid
from pathlib import Path
import textwrap

import modal

from core.config import (
    app,
    mber_image,
    init_sentry,
    r2_secret,
    sentry_secret,
    MBER_MODEL_VOLUME,
    MBER_WEIGHTS_DIR,
    MBER_WORK_DIR,
    MBER_WORK_VOLUME,
    RESULTS_PREFIX,
)
from core.job_status import send_completion, send_progress
from integrations.mber import (
    build_vhh_settings,
    check_mber_weights,
    download_mber_weights,
    ensure_mber_repo,
    parse_accepted_csv,
)
from pipelines.proteinmpnn import resolve_structure_source
from utils.pdb import cif_to_pdb, tail_file
from utils.storage import download_to_path, object_url, upload_bytes, upload_file


@app.function(
    image=mber_image,
    gpu="A100",
    timeout=14400,
    secrets=[r2_secret, sentry_secret],
    volumes={
        MBER_WEIGHTS_DIR: MBER_MODEL_VOLUME,
        MBER_WORK_DIR: MBER_WORK_VOLUME,
    },
)
def run_mber_vhh(
    target_pdb: str | None = None,
    target_structure_url: str | None = None,
    target_name: str | None = None,
    target_chain_ids: list[str] | None = None,
    hotspot_residues: list[str] | None = None,
    masked_binder_sequence: str | None = None,
    num_accepted: int = 25,
    max_trajectories: int = 200,
    min_iptm: float = 0.75,
    min_plddt: float = 0.7,
    skip_animations: bool = True,
    skip_pickle: bool = True,
    skip_png: bool = True,
    skip_relax: bool = False,
    skip_weight_check: bool = False,
    job_id: str | None = None,
    challenge_id: str | None = None,
) -> dict:
    """Run mBER VHH binder design using the bundled protocol."""
    init_sentry()
    start_time = time.time()
    gpu_type = "A100"
    job_id = job_id or str(uuid.uuid4())

    work_dir = Path(MBER_WORK_DIR) / job_id
    work_dir.mkdir(parents=True, exist_ok=True)

    send_progress(job_id, "init", "Initializing mBER VHH pipeline")

    if not skip_weight_check:
        missing = check_mber_weights(Path(MBER_WEIGHTS_DIR))
        if missing:
            send_progress(job_id, "init", "Downloading mBER weights")
            download_mber_weights(Path(MBER_WEIGHTS_DIR))
            missing = check_mber_weights(Path(MBER_WEIGHTS_DIR))
            if missing:
                raise ValueError(
                    "Missing mBER weights. Populate the mBER volume before running. Missing: "
                    + ", ".join(missing)
                )

    target_id = resolve_structure_source(target_pdb, target_structure_url)
    target_pdb_path: Path | None = None
    inline_target = bool(
        target_pdb
        and (
            "\n" in target_pdb
            or target_pdb.strip().startswith("ATOM")
            or target_pdb.strip().lower().startswith("data_")
        )
    )
    remote_target = bool(
        target_pdb
        and target_pdb.startswith(("http://", "https://", "s3://", "r2://"))
    )
    if target_structure_url or inline_target or remote_target:
        source_hint = target_structure_url or target_pdb or ""
        is_cif = ".cif" in source_hint.lower() or (
            target_pdb and "_atom_site." in target_pdb
        )
        target_ext = ".cif" if is_cif else ".pdb"
        target_path = work_dir / f"target{target_ext}"
        send_progress(job_id, "init", "Downloading target structure")
        download_to_path(target_id, target_path)

        if target_path.suffix.lower() == ".cif":
            target_pdb_path = work_dir / "target.pdb"
            cif_to_pdb(target_path, target_pdb_path)
        else:
            target_pdb_path = target_path

        target_id = str(target_pdb_path)
    elif target_pdb:
        candidate_path = Path(target_pdb)
        if candidate_path.suffix.lower() == ".cif" and candidate_path.exists():
            target_pdb_path = work_dir / "target.pdb"
            cif_to_pdb(candidate_path, target_pdb_path)
            target_id = str(target_pdb_path)

    chains = target_chain_ids or ["A"]
    settings = build_vhh_settings(
        output_dir=work_dir,
        target_path=Path(target_id),
        target_chains=chains,
        hotspots=hotspot_residues,
        target_name=target_name,
        masked_sequence=masked_binder_sequence,
        num_accepted=num_accepted,
        max_trajectories=max_trajectories,
        min_iptm=min_iptm,
        min_plddt=min_plddt,
        skip_animations=skip_animations,
        skip_pickle=skip_pickle,
        skip_png=skip_png,
    )
    settings_path = work_dir / "mber_settings.json"
    settings_path.write_text(json.dumps(settings, indent=2))

    cmd = ["mber-vhh", "--settings", str(settings_path)]
    env = os.environ.copy()
    env.setdefault("HOME", "/root")
    env.setdefault("HF_HOME", str(Path(MBER_WEIGHTS_DIR) / "huggingface"))
    if skip_relax:
        env["MBER_SKIP_RELAX"] = "1"
    core_src, protocols_src = ensure_mber_repo(Path(MBER_WEIGHTS_DIR))
    env["PYTHONPATH"] = f"{core_src}:{protocols_src}:{env.get('PYTHONPATH', '')}"

    try:
        import anarci  # noqa: F401
    except Exception:
        stub_dir = work_dir / "anarci_stub"
        stub_dir.mkdir(parents=True, exist_ok=True)
        stub_path = stub_dir / "anarci.py"
        stub_path.write_text(
            textwrap.dedent(
                """
                scheme_short_to_long = {
                    "imgt": "imgt",
                    "kabat": "kabat",
                    "chothia": "chothia",
                    "raw": "raw",
                }

                def validate_sequence(sequence):
                    if not sequence:
                        raise ValueError("Empty sequence")
                    allowed = set("ACDEFGHIKLMNPQRSTVWY")
                    invalid = [c for c in sequence.upper() if c not in allowed]
                    if invalid:
                        raise ValueError(f"Invalid residues: {sorted(set(invalid))}")

                def anarci(seqs, scheme="imgt", output=False, allow=None, allowed_species=None):
                    numbered = []
                    for _name, seq in seqs:
                        domain = []
                        length = len(seq)
                        for i, aa in enumerate(seq):
                            num = i + 1
                            if i == length - 1 and num <= 120:
                                num = 121
                            domain.append(((num, " "), aa))
                        numbered.append([[domain]])
                    return numbered, None, None
                """
            ).lstrip()
        )
        env["PYTHONPATH"] = f"{stub_dir}:{env.get('PYTHONPATH', '')}"
        send_progress(job_id, "init", "ANARCI not available; using stub numbering")

    send_progress(job_id, "design", f"Running mBER VHH ({num_accepted} accepted designs target)")
    log_path = work_dir / "mber_vhh.log"
    with log_path.open("w", encoding="utf-8") as log_handle:
        process = subprocess.Popen(
            cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        for line in process.stdout:
            log_handle.write(line)
            log_handle.flush()
            print(line, end="")
        return_code = process.wait()

    if return_code != 0:
        tail = tail_file(log_path, max_bytes=8000)
        raise RuntimeError(f"mBER VHH failed with exit code {return_code}. Log snippet:\n{tail}")

    send_progress(job_id, "processing", "Parsing mBER accepted designs")
    accepted_csv = work_dir / "accepted.csv"
    accepted = parse_accepted_csv(accepted_csv)

    designs = []
    for idx, row in enumerate(accepted):
        design_id = f"{job_id}-d{idx}"
        design = {
            "design_id": design_id,
            "sequence": row.get("binder_seq"),
            "metrics": {
                "i_ptm": row.get("i_ptm"),
                "plddt": row.get("plddt"),
                "ptm": row.get("ptm"),
            },
            "structures": {},
        }

        complex_path = row.get("complex_pdb_path")
        if complex_path and Path(complex_path).exists():
            key = f"{RESULTS_PREFIX}/{job_id}/mber_{idx}_complex.pdb"
            upload_file(Path(complex_path), key, content_type="chemical/x-pdb")
            design["structures"]["complex"] = {"key": key, "url": object_url(key)}

        relaxed_path = row.get("relaxed_pdb_path")
        if relaxed_path and Path(relaxed_path).exists():
            key = f"{RESULTS_PREFIX}/{job_id}/mber_{idx}_relaxed.pdb"
            upload_file(Path(relaxed_path), key, content_type="chemical/x-pdb")
            design["structures"]["relaxed"] = {"key": key, "url": object_url(key)}

        designs.append(design)

    manifest = {
        "job_id": job_id,
        "challenge_id": challenge_id,
        "status": "completed",
        "pipeline": "mber_vhh",
        "parameters": {
            "num_accepted": num_accepted,
            "max_trajectories": max_trajectories,
            "min_iptm": min_iptm,
            "min_plddt": min_plddt,
            "target_chains": chains,
            "hotspots": hotspot_residues,
            "skip_relax": skip_relax,
        },
        "designs": designs,
    }
    manifest_key = f"{RESULTS_PREFIX}/{job_id}/manifest.json"
    upload_bytes(json.dumps(manifest, indent=2).encode("utf-8"), manifest_key, "application/json")

    execution_seconds = round(time.time() - start_time, 2)
    output = {
        "status": "completed",
        "job_id": job_id,
        "challenge_id": challenge_id,
        "manifest": {"key": manifest_key, "url": object_url(manifest_key)},
        "designs": designs,
        "pipeline": "mber_vhh",
        "parameters": manifest["parameters"],
        "usage": {
            "gpu_type": gpu_type,
            "execution_seconds": execution_seconds,
        },
    }

    send_progress(job_id, "complete", f"mBER complete: {len(designs)} designs accepted")
    send_completion(job_id, status="completed", output=output, usage=output["usage"])

    try:
        MBER_WORK_VOLUME.commit()
    except Exception as exc:
        print(f"[cleanup] Warning: Failed to commit mBER work volume: {exc}")

    return output
