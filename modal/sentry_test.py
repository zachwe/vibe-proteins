"""Minimal Sentry test - deploy separately from main app."""

import modal
import os

app = modal.App("vibeproteins-sentry-test")

cpu_image = modal.Image.debian_slim(python_version="3.12").pip_install("sentry-sdk>=2.0.0")

sentry_secret = modal.Secret.from_name("sentry-dsn")


def init_sentry():
    import sentry_sdk
    dsn = os.environ.get("SENTRY_DSN")
    if dsn:
        sentry_sdk.init(
            dsn=dsn,
            traces_sample_rate=1.0,
            environment="test",
        )


@app.function(image=cpu_image, secrets=[sentry_secret])
def sentry_test():
    """Test Sentry integration by raising an exception."""
    import sentry_sdk
    init_sentry()
    try:
        raise Exception("Test error from Modal - Sentry integration check")
    except Exception as e:
        sentry_sdk.capture_exception(e)
        sentry_sdk.flush(timeout=10)  # Ensure event is sent before process exits
        raise


@app.local_entrypoint()
def main():
    """Run the sentry test."""
    print("Triggering Sentry test exception...")
    try:
        sentry_test.remote()
    except Exception as e:
        print(f"Exception raised (expected): {e}")
        print("Check Sentry dashboard for the error!")
