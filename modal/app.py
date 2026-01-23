"""
VibeProteins Modal Functions

Main entry point for the Modal app. Imports pipeline functions and defines
web endpoints for job submission and status checking.
"""

from __future__ import annotations

import modal
import sentry_sdk

from core.config import app, cpu_image, sentry_secret, init_sentry
from core.job_status import get_job_status

# Import all pipeline functions - this registers them with the app
from pipelines import (
    run_rfdiffusion3,
    run_boltz2,
    run_boltzgen,
    run_mber_vhh,
    run_mosaic_boltz2,
    run_mosaic_trigram,
    run_proteinmpnn,
    compute_scores,
    run_structure_prediction,
    run_msa_search,
)


@app.function(image=cpu_image, secrets=[sentry_secret])
def health_check() -> dict:
    """Simple health check to verify Modal is working."""
    init_sentry()
    return {"status": "ok", "message": "VibeProteins Modal ready"}


@app.function(image=cpu_image, timeout=3600, secrets=[sentry_secret])
@modal.fastapi_endpoint(method="POST")
def submit_job(request: dict) -> dict:
    """
    Web endpoint to submit inference jobs.

    Supports both sync and async modes:
    - sync (default): Blocks until job completes, returns full result
    - async: Returns immediately with call_id, job runs in background
      and updates status in Modal Dict

    Set request["async"] = True for async mode.
    """
    init_sentry()

    job_type = request.get("job_type", "")
    params = request.get("params", {})
    async_mode = request.get("async", False)

    # Map job types to their functions
    job_functions = {
        "health": health_check,
        "rfdiffusion3": run_rfdiffusion3,
        "proteinmpnn": run_proteinmpnn,
        "boltz2": run_boltz2,
        "boltzgen": run_boltzgen,
        "mber_vhh": run_mber_vhh,
        "mosaic_trigram": run_mosaic_trigram,
        "mosaic_boltz2": run_mosaic_boltz2,
        "predict": run_structure_prediction,
        "score": compute_scores,
        "msa": run_msa_search,
    }

    if job_type not in job_functions:
        return {"status": "error", "message": f"Unknown job type: {job_type}"}

    func = job_functions[job_type]

    # Health check is always sync
    if job_type == "health":
        return func.remote()

    if async_mode:
        # Spawn the function asynchronously
        try:
            call = func.spawn(**params)
            return {
                "status": "pending",
                "job_id": params.get("job_id"),
                "call_id": call.object_id,
                "message": f"Job {job_type} submitted asynchronously",
            }
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return {
                "status": "error",
                "job_id": params.get("job_id"),
                "message": f"Failed to spawn job: {str(e)}",
            }
    else:
        # Sync mode: block until complete (legacy behavior)
        return func.remote(**params)


@app.function(image=cpu_image, timeout=60, secrets=[sentry_secret])
@modal.fastapi_endpoint(method="GET")
def get_job_status_endpoint(job_id: str) -> dict:
    """
    Get job status and progress from the Modal Dict.

    Returns the current status, progress events, and output (if completed).
    """
    init_sentry()
    status = get_job_status(job_id)
    if status is None:
        return {"status": "not_found", "job_id": job_id}
    return status
