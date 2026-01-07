"""
Job status tracking using Modal Dict.

Provides functions to track job progress and completion without
requiring a public callback URL.
"""

import time

from core.config import job_status_dict


def get_job_status(job_id: str) -> dict | None:
    """Get job status from the Modal Dict."""
    try:
        return job_status_dict.get(job_id)
    except KeyError:
        return None


def update_job_status(
    job_id: str,
    status: str,
    stage: str | None = None,
    message: str | None = None,
    output: dict | None = None,
    error: str | None = None,
    usage: dict | None = None,
) -> None:
    """Update job status in the Modal Dict."""
    existing = get_job_status(job_id) or {
        "job_id": job_id,
        "status": "pending",
        "progress": [],
        "created_at": time.time(),
    }

    existing["status"] = status
    existing["updated_at"] = time.time()

    if stage and message:
        existing["progress"].append({
            "stage": stage,
            "message": message,
            "timestamp": time.time(),
        })

    if output is not None:
        existing["output"] = output
    if error is not None:
        existing["error"] = error
    if usage is not None:
        existing["usage"] = usage

    job_status_dict[job_id] = existing


def send_progress(job_id: str | None, stage: str, message: str) -> None:
    """Record a progress update for a job."""
    print(f"[{stage}] {message}")
    if job_id:
        update_job_status(job_id, status="running", stage=stage, message=message)


def send_usage_update(
    job_id: str | None,
    gpu_type: str,
    execution_seconds: float,
) -> None:
    """
    Send periodic usage update for long-running jobs.

    This allows the API to track and bill for partial usage,
    protecting against preemption and giving users cost visibility.
    """
    if not job_id:
        return

    existing = get_job_status(job_id) or {
        "job_id": job_id,
        "status": "running",
        "progress": [],
        "created_at": time.time(),
    }

    # Track cumulative usage with timestamp
    existing["usage"] = {
        "gpu_type": gpu_type,
        "execution_seconds": execution_seconds,
        "last_updated": time.time(),
    }
    existing["updated_at"] = time.time()

    job_status_dict[job_id] = existing
    print(f"[usage] {gpu_type}: {execution_seconds:.1f}s elapsed")


def send_completion(
    job_id: str | None,
    status: str,
    output: dict | None = None,
    error: str | None = None,
    usage: dict | None = None,
) -> None:
    """Record job completion."""
    if job_id:
        update_job_status(job_id, status=status, output=output, error=error, usage=usage)
