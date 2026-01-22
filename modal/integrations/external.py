"""Helpers for external repo integrations."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ExternalRepo:
    name: str
    repo_url: str
    ref: str | None = None
    subdir: str | None = None

    def pip_spec(self, package_name: str | None = None) -> str:
        base = f"git+{self.repo_url}"
        if self.ref:
            base = f"{base}@{self.ref}"
        suffix = f"#subdirectory={self.subdir}" if self.subdir else ""
        if package_name:
            return f"{package_name} @ {base}{suffix}"
        return f"{base}{suffix}"
