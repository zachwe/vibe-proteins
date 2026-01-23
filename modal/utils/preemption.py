"""Preemption helpers for resumable pipelines."""

from __future__ import annotations

import json
import signal
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Protocol


class PreemptionRequested(RuntimeError):
    """Raised when a preemption signal is detected and the job should retry."""


class PreemptionAdapter(Protocol):
    """Provider-specific hooks for preemption handling."""

    def register_handler(self, handler: Callable[[], None]) -> None:
        """Register a handler to run when preemption is requested."""

    def commit(self) -> None:
        """Persist any provider-specific state needed for resume."""


@dataclass
class NoopPreemptionAdapter:
    """Adapter that does nothing (useful for non-preemptible runtimes)."""

    def register_handler(self, handler: Callable[[], None]) -> None:
        return None

    def commit(self) -> None:
        return None


@dataclass
class ModalPreemptionAdapter:
    """Adapter for Modal preemptible functions."""

    volume: object | None = None

    def register_handler(self, handler: Callable[[], None]) -> None:
        def _handle_sigterm(_signum, _frame):
            handler()

        signal.signal(signal.SIGTERM, _handle_sigterm)

    def commit(self) -> None:
        if self.volume is None:
            return
        try:
            self.volume.commit()
        except Exception as exc:  # pragma: no cover - best effort
            print(f"[preemption] Warning: Failed to commit volume: {exc}")


@dataclass
class PreemptionManager:
    """Checkpoint helper that pairs provider hooks with local state."""

    work_dir: Path
    adapter: PreemptionAdapter
    state_filename: str = "checkpoint.json"

    def __post_init__(self) -> None:
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.state_path = self.work_dir / self.state_filename
        self.preempted = False

    def register_signal_handler(self, on_preempt: Callable[[], None] | None = None) -> None:
        def _handler():
            self.preempted = True
            if on_preempt:
                on_preempt()
            self.adapter.commit()

        self.adapter.register_handler(_handler)

    def load_state(self) -> dict | None:
        if not self.state_path.exists():
            return None
        return json.loads(self.state_path.read_text())

    def save_state(self, state: dict) -> None:
        self.state_path.write_text(json.dumps(state, indent=2))
        self.adapter.commit()

    def clear_state(self) -> None:
        if self.state_path.exists():
            self.state_path.unlink()

    def raise_if_preempted(self) -> None:
        if self.preempted:
            raise PreemptionRequested("Preemption requested; retry to resume.")
