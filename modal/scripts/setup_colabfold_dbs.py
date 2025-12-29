"""
Setup ColabFold Databases for MSA Search

This script downloads and prepares the ColabFold databases for use with MMseqs2.
Run this once to populate the Modal Volume with required databases.

Usage:
    modal run scripts/setup_colabfold_dbs.py

The script downloads:
- UniRef30 (~100GB compressed, ~200GB uncompressed)
- ColabFoldDB (~400GB compressed)

Total estimated time: 2-4 hours depending on network speed.
Total disk space required: ~600GB-1TB
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import modal

app = modal.App("vibeproteins-db-setup")

# Volume for storing ColabFold databases
COLABFOLD_VOLUME_NAME = os.environ.get("COLABFOLD_VOLUME_NAME", "colabfold-dbs")
colabfold_volume = modal.Volume.from_name(COLABFOLD_VOLUME_NAME, create_if_missing=True)

DB_DIR = Path("/colabfold-dbs")

# Database URLs from ColabFold
UNIREF30_URL = "https://wwwuser.gwdg.de/~compbiol/colabfold/uniref30_2302.tar.gz"
COLABFOLD_ENV_URL = "https://wwwuser.gwdg.de/~compbiol/colabfold/colabfolddb_envdb_202108.tar.gz"

setup_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("wget", "aria2", "tar", "pigz", "mmseqs2")
    .pip_install("tqdm", "requests")
)


def run_cmd(cmd: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a shell command with output streaming."""
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, check=check)
    return result


@app.function(
    image=setup_image,
    volumes={str(DB_DIR): colabfold_volume},
    timeout=14400,  # 4 hours
    memory=32768,  # 32GB RAM
    cpu=4,
)
def download_uniref30():
    """Download and extract UniRef30 database."""
    db_path = DB_DIR / "uniref30_2302"
    marker = DB_DIR / ".uniref30_complete"

    if marker.exists():
        print("UniRef30 already downloaded and extracted.")
        return {"status": "cached", "path": str(db_path)}

    print("Downloading UniRef30 database (~100GB)...")
    tar_path = DB_DIR / "uniref30_2302.tar.gz"

    # Use aria2c for faster downloads with resume support
    run_cmd(
        f"aria2c -x 16 -s 16 -c -d {DB_DIR} -o uniref30_2302.tar.gz {UNIREF30_URL}"
    )

    print("Extracting UniRef30 database...")
    run_cmd(f"tar -xzf {tar_path} -C {DB_DIR}")

    # Clean up tarball to save space
    tar_path.unlink()

    # Mark as complete
    marker.touch()
    colabfold_volume.commit()

    print(f"UniRef30 database ready at {db_path}")
    return {"status": "downloaded", "path": str(db_path)}


@app.function(
    image=setup_image,
    volumes={str(DB_DIR): colabfold_volume},
    timeout=14400,  # 4 hours
    memory=32768,  # 32GB RAM
    cpu=4,
)
def download_colabfolddb():
    """Download and extract ColabFoldDB (environmental sequences)."""
    db_path = DB_DIR / "colabfolddb_envdb_202108"
    marker = DB_DIR / ".colabfolddb_complete"

    if marker.exists():
        print("ColabFoldDB already downloaded and extracted.")
        return {"status": "cached", "path": str(db_path)}

    print("Downloading ColabFoldDB database (~400GB)...")
    tar_path = DB_DIR / "colabfolddb_envdb_202108.tar.gz"

    # Use aria2c for faster downloads with resume support
    run_cmd(
        f"aria2c -x 16 -s 16 -c -d {DB_DIR} -o colabfolddb_envdb_202108.tar.gz {COLABFOLD_ENV_URL}"
    )

    print("Extracting ColabFoldDB database...")
    run_cmd(f"tar -xzf {tar_path} -C {DB_DIR}")

    # Clean up tarball to save space
    tar_path.unlink()

    # Mark as complete
    marker.touch()
    colabfold_volume.commit()

    print(f"ColabFoldDB database ready at {db_path}")
    return {"status": "downloaded", "path": str(db_path)}


@app.function(
    image=setup_image,
    volumes={str(DB_DIR): colabfold_volume},
    timeout=600,
    memory=4096,
)
def verify_databases():
    """Verify that databases are properly set up."""
    results = {}

    # Check UniRef30
    uniref_path = DB_DIR / "uniref30_2302"
    uniref_marker = DB_DIR / ".uniref30_complete"
    if uniref_marker.exists() and uniref_path.exists():
        # Check for expected files
        db_files = list(uniref_path.glob("*"))
        results["uniref30"] = {
            "status": "ok",
            "path": str(uniref_path),
            "files": len(db_files),
        }
    else:
        results["uniref30"] = {"status": "missing"}

    # Check ColabFoldDB
    colabfold_path = DB_DIR / "colabfolddb_envdb_202108"
    colabfold_marker = DB_DIR / ".colabfolddb_complete"
    if colabfold_marker.exists() and colabfold_path.exists():
        db_files = list(colabfold_path.glob("*"))
        results["colabfolddb"] = {
            "status": "ok",
            "path": str(colabfold_path),
            "files": len(db_files),
        }
    else:
        results["colabfolddb"] = {"status": "missing"}

    # List all contents
    all_contents = list(DB_DIR.iterdir()) if DB_DIR.exists() else []
    results["volume_contents"] = [str(p) for p in all_contents]

    return results


@app.local_entrypoint()
def main(verify_only: bool = False, uniref_only: bool = False, colabfold_only: bool = False):
    """
    Download and setup ColabFold databases.

    Args:
        verify_only: Only verify existing databases, don't download
        uniref_only: Only download UniRef30
        colabfold_only: Only download ColabFoldDB
    """
    if verify_only:
        print("Verifying database setup...")
        result = verify_databases.remote()
        print(f"Verification result: {result}")
        return

    print("=" * 60)
    print("ColabFold Database Setup")
    print("=" * 60)
    print()
    print("This will download ~500GB of databases for MSA search.")
    print("Estimated time: 2-4 hours")
    print()

    if not colabfold_only:
        print("Step 1: Downloading UniRef30...")
        result = download_uniref30.remote()
        print(f"UniRef30: {result}")

    if not uniref_only:
        print("Step 2: Downloading ColabFoldDB...")
        result = download_colabfolddb.remote()
        print(f"ColabFoldDB: {result}")

    print()
    print("Step 3: Verifying setup...")
    result = verify_databases.remote()
    print(f"Verification: {result}")

    print()
    print("=" * 60)
    print("Database setup complete!")
    print("=" * 60)
