"""Mosaic sequence optimization pipelines."""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path

import numpy as np
import modal

from core.config import (
    app,
    init_sentry,
    mosaic_gpu_image,
    mosaic_image,
    r2_secret,
    sentry_secret,
    BOLTZ_CACHE_DIR,
    BOLTZ_MODEL_VOLUME,
    MOSAIC_WORK_DIR,
    MOSAIC_WORK_VOLUME,
    RESULTS_PREFIX,
)
from core.job_status import send_completion, send_progress
from integrations.mosaic import (
    MOSAIC_TOKENS,
    MOSAIC_TRIGRAM_PATH,
    build_trigram_run_metadata,
    decode_soft_sequence,
)
from pipelines.proteinmpnn import resolve_structure_source
from utils.boltz_helpers import _extract_chain_sequences, ensure_boltz2_cache
from utils.pdb import cif_to_pdb
from utils.preemption import ModalPreemptionAdapter, PreemptionManager, PreemptionRequested
from utils.storage import download_to_path, object_url, upload_bytes


@app.function(
    image=mosaic_image,
    timeout=3600,
    secrets=[r2_secret, sentry_secret],
)
def run_mosaic_trigram(
    sequence_length: int = 80,
    n_steps: int = 120,
    stepsize: float = 0.1,
    momentum: float = 0.9,
    seed: int | None = None,
    job_id: str | None = None,
    challenge_id: str | None = None,
) -> dict:
    """Optimize a sequence under Mosaic's trigram language model loss."""
    init_sentry()
    start_time = time.time()
    job_id = job_id or str(uuid.uuid4())

    sequence_length = int(sequence_length)
    if sequence_length < 3:
        raise ValueError("sequence_length must be at least 3 for trigram scoring.")

    send_progress(job_id, "init", "Loading Mosaic trigram model")

    import jax
    import inspect

    if "simple" not in inspect.signature(jax.tree_util.keystr).parameters:
        original_keystr = jax.tree_util.keystr

        def _keystr_compat(key, simple=False, separator="."):
            return original_keystr(key)

        jax.tree_util.keystr = _keystr_compat
    from mosaic.losses.trigram import TrigramLL
    from mosaic.optimizers import simplex_APGM

    trigram_path = Path(MOSAIC_TRIGRAM_PATH)
    if not trigram_path.exists():
        raise FileNotFoundError(f"Missing trigram asset at {trigram_path}")

    loss = TrigramLL.from_pkl(path=trigram_path)
    seed_value = seed if seed is not None else int(time.time() * 1000) % 2**31
    key = jax.random.key(seed_value)

    send_progress(job_id, "optimize", f"Running Mosaic trigram optimization ({n_steps} steps)")
    soft_init = jax.nn.softmax(
        0.5 * jax.random.gumbel(key, shape=(sequence_length, 20))
    )
    _, best_soft = simplex_APGM(
        loss_function=loss,
        x=soft_init,
        n_steps=int(n_steps),
        stepsize=float(stepsize),
        momentum=float(momentum),
        key=key,
    )

    best_soft = jax.numpy.array(best_soft)
    loss_value, aux = loss(best_soft, key=jax.random.fold_in(key, 1))
    trigram_ll = float(aux.get("trigram_ll", 0.0))
    best_sequence = decode_soft_sequence(np.array(best_soft))

    manifest = {
        "job_id": job_id,
        "challenge_id": challenge_id,
        "status": "completed",
        "pipeline": "mosaic_trigram",
        "parameters": build_trigram_run_metadata(
            sequence_length=sequence_length,
            n_steps=int(n_steps),
            stepsize=float(stepsize),
            momentum=float(momentum),
            seed=seed_value,
        ),
        "designs": [
            {
                "design_id": f"{job_id}-d0",
                "sequence": best_sequence,
                "metrics": {
                    "loss": float(loss_value),
                    "trigram_ll": trigram_ll,
                },
            }
        ],
    }

    manifest_key = f"{RESULTS_PREFIX}/{job_id}/mosaic_manifest.json"
    upload_bytes(
        json.dumps(manifest, indent=2).encode("utf-8"),
        manifest_key,
        "application/json",
    )

    execution_seconds = round(time.time() - start_time, 2)
    output = {
        "status": "completed",
        "job_id": job_id,
        "challenge_id": challenge_id,
        "pipeline": "mosaic_trigram",
        "manifest": {"key": manifest_key, "url": object_url(manifest_key)},
        "designs": manifest["designs"],
        "parameters": manifest["parameters"],
        "usage": {
            "gpu_type": "cpu",
            "execution_seconds": execution_seconds,
        },
    }

    send_progress(job_id, "complete", "Mosaic trigram optimization complete")
    send_completion(job_id, status="completed", output=output, usage=output["usage"])

    return output


@app.function(
    image=mosaic_gpu_image,
    gpu="A100",
    timeout=14400,
    secrets=[r2_secret, sentry_secret],
    volumes={
        BOLTZ_CACHE_DIR: BOLTZ_MODEL_VOLUME,
        MOSAIC_WORK_DIR: MOSAIC_WORK_VOLUME,
    },
    retries=modal.Retries(
        max_retries=3,
        backoff_coefficient=1.0,
        initial_delay=1.0,
    ),
)
def run_mosaic_boltz2(
    target_sequence: str | None = None,
    target_pdb: str | None = None,
    target_structure_url: str | None = None,
    target_chain_ids: list[str] | None = None,
    binder_length: int = 75,
    n_steps: int = 75,
    stepsize: float = 0.1,
    momentum: float = 0.0,
    sharpen_steps: int = 50,
    sharpen_stepsize: float = 0.5,
    sharpen_scale: float = 1.5,
    chunk_size: int = 25,
    binder_target_contact_weight: float = 2.0,
    within_binder_contact_weight: float = 1.0,
    helix_weight: float = 0.0,
    helix_max_distance: float = 6.0,
    helix_target_value: float = -2.0,
    radius_of_gyration_weight: float = 0.0,
    radius_of_gyration_target: float | None = None,
    use_sequence_recovery: bool = True,
    sequence_recovery_weight: float = 5.0,
    sequence_recovery_temp: float = 0.01,
    sequence_recovery_samples: int = 16,
    sequence_recovery_iterations: int = 10,
    recycling_steps: int = 1,
    use_msa: bool = True,
    seed: int | None = None,
    job_id: str | None = None,
    challenge_id: str | None = None,
) -> dict:
    """Run Mosaic Boltz2 binder optimization with recommended loss terms."""
    init_sentry()
    start_time = time.time()
    gpu_type = "A100_40GB"

    job_id = job_id or str(uuid.uuid4())
    work_dir = Path(MOSAIC_WORK_DIR) / job_id
    work_dir.mkdir(parents=True, exist_ok=True)

    preemption = PreemptionManager(
        work_dir=work_dir,
        adapter=ModalPreemptionAdapter(volume=MOSAIC_WORK_VOLUME),
    )
    preemption.register_signal_handler(
        lambda: send_progress(job_id, "processing", "Preemption detected, checkpointing...")
    )

    send_progress(job_id, "init", "Initializing Mosaic Boltz2 pipeline")

    send_progress(job_id, "init", "Ensuring Boltz-2 cache is available")
    boltz_cache = Path(BOLTZ_CACHE_DIR)
    ensure_boltz2_cache(boltz_cache)
    home_cache = Path.home() / ".boltz"
    if home_cache.is_symlink():
        if home_cache.resolve() != boltz_cache:
            home_cache.unlink()
            home_cache.symlink_to(boltz_cache)
    elif home_cache.exists():
        for name in ("mols", "boltz2_conf.ckpt", "boltz2_aff.ckpt", "ccd.pkl"):
            src = boltz_cache / name
            dst = home_cache / name
            if not dst.exists() and src.exists():
                dst.symlink_to(src)
    else:
        home_cache.symlink_to(boltz_cache)

    import jax
    import inspect

    if "simple" not in inspect.signature(jax.tree_util.keystr).parameters:
        original_keystr = jax.tree_util.keystr

        def _keystr_compat(key, simple=False, separator="."):
            return original_keystr(key)

        jax.tree_util.keystr = _keystr_compat

    seed_value = seed if seed is not None else int(time.time() * 1000) % 2**31
    key = jax.random.key(seed_value)

    if binder_length <= 0:
        raise ValueError("binder_length must be positive.")
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive.")

    target_sequences: list[tuple[str, str]] = []
    target_path = None
    if target_sequence:
        chain_ids = target_chain_ids or ["A"]
        target_sequences = [(chain_ids[0], target_sequence)]
    else:
        target_source = resolve_structure_source(target_pdb, target_structure_url)
        target_ext = ".cif" if target_structure_url and ".cif" in target_structure_url.lower() else ".pdb"
        target_path = work_dir / f"target{target_ext}"
        if not target_path.exists():
            send_progress(job_id, "init", "Downloading target structure")
            download_to_path(target_source, target_path)
        if target_path.suffix.lower() == ".cif":
            target_path = cif_to_pdb(target_path, work_dir / "target.pdb")
        sequences = _extract_chain_sequences(target_path)
        if not sequences:
            raise ValueError("Unable to extract sequences from target structure.")
        if target_chain_ids:
            sequences = [seq for seq in sequences if seq[0] in target_chain_ids]
        if not sequences:
            raise ValueError("No target chains matched the provided chain IDs.")
        target_sequences = sequences

    send_progress(job_id, "init", f"Using {len(target_sequences)} target chain(s)")

    from mosaic.structure_prediction import TargetChain
    from mosaic.models.boltz2 import Boltz2
    import mosaic.losses.structure_prediction as sp
    from mosaic.losses.protein_mpnn import InverseFoldingSequenceRecovery
    from mosaic.proteinmpnn.mpnn import ProteinMPNN

    target_chains = [
        TargetChain(sequence=seq, use_msa=use_msa) for _, seq in target_sequences
    ]
    model = Boltz2(cache_path=Path(BOLTZ_CACHE_DIR) / "boltz2_conf.ckpt")
    features, writer = model.binder_features(
        binder_length=int(binder_length),
        chains=target_chains,
    )

    loss_terms = binder_target_contact_weight * sp.BinderTargetContact()
    if within_binder_contact_weight:
        loss_terms += within_binder_contact_weight * sp.WithinBinderContact()
    if helix_weight:
        loss_terms += helix_weight * sp.HelixLoss(
            max_distance=helix_max_distance,
            target_value=helix_target_value,
        )
    if radius_of_gyration_weight:
        loss_terms += radius_of_gyration_weight * sp.DistogramRadiusOfGyration(
            target_radius=radius_of_gyration_target,
        )
    if use_sequence_recovery:
        mpnn = ProteinMPNN.from_pretrained()
        loss_terms += sequence_recovery_weight * InverseFoldingSequenceRecovery(
            mpnn,
            temp=jax.numpy.array(sequence_recovery_temp),
            num_samples=sequence_recovery_samples,
            jacobi_iterations=sequence_recovery_iterations,
        )

    loss = model.build_loss(
        loss=loss_terms,
        features=features,
        recycling_steps=int(recycling_steps),
    )

    def save_checkpoint(phase: str, steps_completed: int, soft_seq: np.ndarray, best_seq: np.ndarray) -> None:
        soft_path = work_dir / f"{phase}_soft.npy"
        best_path = work_dir / f"{phase}_best.npy"
        np.save(soft_path, soft_seq)
        np.save(best_path, best_seq)
        preemption.save_state({
            "phase": phase,
            "steps_completed": steps_completed,
            "seed": seed_value,
            "soft_sequence_path": str(soft_path),
            "best_sequence_path": str(best_path),
        })

    state = preemption.load_state() or {}
    phase = state.get("phase")
    completed_steps = int(state.get("steps_completed") or 0)
    soft_sequence = None
    best_sequence = None
    if state.get("soft_sequence_path"):
        soft_path = Path(state["soft_sequence_path"])
        if soft_path.exists():
            soft_sequence = np.load(soft_path)
    if state.get("best_sequence_path"):
        best_path = Path(state["best_sequence_path"])
        if best_path.exists():
            best_sequence = np.load(best_path)

    if soft_sequence is None:
        soft_sequence = np.array(
            jax.nn.softmax(
                0.5 * jax.random.gumbel(key, shape=(int(binder_length), 20))
            )
        )

    if best_sequence is None:
        best_sequence = soft_sequence.copy()

    def run_phase(
        phase_name: str,
        start_steps: int,
        total_steps: int,
        phase_stepsize: float,
        phase_momentum: float,
        phase_scale: float,
        initial_sequence: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray]:
        steps_completed = start_steps
        current = np.array(initial_sequence)
        best = best_sequence.copy()
        best_loss = None

        while steps_completed < total_steps:
            steps_this = min(chunk_size, total_steps - steps_completed)
            chunk_key = jax.random.fold_in(key, steps_completed)
            current, candidate_best = simplex_APGM(
                loss_function=loss,
                x=current,
                n_steps=int(steps_this),
                stepsize=float(phase_stepsize),
                momentum=float(phase_momentum),
                scale=float(phase_scale),
                key=chunk_key,
            )
            loss_value, _ = loss(candidate_best, key=jax.random.fold_in(chunk_key, 1))
            loss_value = float(loss_value)
            if best_loss is None or loss_value < best_loss:
                best_loss = loss_value
                best = np.array(candidate_best)

            current = np.array(current)
            steps_completed += steps_this
            save_checkpoint(phase_name, steps_completed, current, best)
            preemption.raise_if_preempted()

        return current, best

    from mosaic.optimizers import simplex_APGM

    try:
        if phase not in ("sharpen", "completed"):
            send_progress(job_id, "optimize", "Running coarse optimization")
            soft_sequence, best_sequence = run_phase(
                phase_name="coarse",
                start_steps=completed_steps if phase == "coarse" else 0,
                total_steps=int(n_steps),
                phase_stepsize=stepsize,
                phase_momentum=momentum,
                phase_scale=1.0,
                initial_sequence=soft_sequence,
            )
            phase = "coarse"
            completed_steps = int(n_steps)

        if sharpen_steps > 0 and phase != "completed":
            send_progress(job_id, "optimize", "Running sharpening optimization")
            initial_sequence = soft_sequence if phase == "sharpen" else best_sequence
            soft_sequence, best_sequence = run_phase(
                phase_name="sharpen",
                start_steps=completed_steps if phase == "sharpen" else 0,
                total_steps=int(sharpen_steps),
                phase_stepsize=sharpen_stepsize,
                phase_momentum=momentum,
                phase_scale=sharpen_scale,
                initial_sequence=initial_sequence,
            )
            phase = "sharpen"
    except PreemptionRequested:
        send_progress(job_id, "processing", "Preemption checkpoint saved; retrying job")
        raise

    send_progress(job_id, "predict", "Running Boltz2 prediction on optimized sequence")
    final_loss, _ = loss(
        jax.numpy.array(best_sequence),
        key=jax.random.fold_in(key, 3),
    )
    prediction = model.predict(
        PSSM=jax.numpy.array(best_sequence),
        features=features,
        writer=writer,
        key=jax.random.fold_in(key, 2),
        recycling_steps=int(recycling_steps),
    )

    binder_sequence = decode_soft_sequence(best_sequence, tokens=MOSAIC_TOKENS)
    pdb_bytes = prediction.st.make_pdb_string().encode("utf-8")
    struct_key = f"{RESULTS_PREFIX}/{job_id}/mosaic_boltz2_complex.pdb"
    upload_bytes(pdb_bytes, struct_key, "chemical/x-pdb")

    metrics = {
        "loss": float(final_loss),
        "iptm": float(prediction.iptm),
        "plddt_mean": float(np.mean(prediction.plddt)),
    }

    manifest = {
        "job_id": job_id,
        "challenge_id": challenge_id,
        "status": "completed",
        "pipeline": "mosaic_boltz2",
        "target_chains": [chain_id for chain_id, _ in target_sequences],
        "parameters": {
            "binder_length": int(binder_length),
            "n_steps": int(n_steps),
            "sharpen_steps": int(sharpen_steps),
            "stepsize": float(stepsize),
            "sharpen_stepsize": float(sharpen_stepsize),
            "sharpen_scale": float(sharpen_scale),
            "binder_target_contact_weight": binder_target_contact_weight,
            "within_binder_contact_weight": within_binder_contact_weight,
            "sequence_recovery_weight": sequence_recovery_weight if use_sequence_recovery else 0.0,
            "seed": seed_value,
        },
        "designs": [
            {
                "design_id": f"{job_id}-d0",
                "sequence": binder_sequence,
                "structures": {"complex": {"key": struct_key, "url": object_url(struct_key)}},
                "metrics": metrics,
            }
        ],
    }

    manifest_key = f"{RESULTS_PREFIX}/{job_id}/mosaic_manifest.json"
    upload_bytes(
        json.dumps(manifest, indent=2).encode("utf-8"),
        manifest_key,
        "application/json",
    )

    execution_seconds = round(time.time() - start_time, 2)
    output = {
        "status": "completed",
        "job_id": job_id,
        "challenge_id": challenge_id,
        "pipeline": "mosaic_boltz2",
        "manifest": {"key": manifest_key, "url": object_url(manifest_key)},
        "designs": manifest["designs"],
        "parameters": manifest["parameters"],
        "usage": {
            "gpu_type": gpu_type,
            "execution_seconds": execution_seconds,
        },
    }

    preemption.clear_state()

    send_progress(job_id, "complete", "Mosaic Boltz2 pipeline complete")
    send_completion(job_id, status="completed", output=output, usage=output["usage"])

    return output
