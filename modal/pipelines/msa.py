"""
MSA (Multiple Sequence Alignment) search pipeline.
"""

from __future__ import annotations

import subprocess
import tempfile
import time
import uuid
from pathlib import Path

from core.config import (
    app,
    msa_image,
    colabfold_volume,
    sentry_secret,
    init_sentry,
    COLABFOLD_DB_DIR,
)


def convert_mmseqs_to_a3m(query_fasta: Path, hits_file: Path) -> str:
    """Convert MMseqs2 hits to A3M format."""
    # Read query sequence
    query_lines = query_fasta.read_text().strip().split("\n")
    query_id = query_lines[0][1:]  # Remove '>'
    query_seq = "".join(query_lines[1:])

    # Start with query as first sequence
    a3m_lines = [f">{query_id}", query_seq]

    # Parse hits and add aligned sequences
    if hits_file.exists():
        for line in hits_file.read_text().strip().split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 13:
                target_id = parts[1]
                target_seq = parts[12]  # tseq column
                # Add to A3M (MMseqs2 already provides aligned sequence)
                a3m_lines.append(f">{target_id}")
                a3m_lines.append(target_seq)

    return "\n".join(a3m_lines)


@app.function(
    image=msa_image,
    volumes={str(COLABFOLD_DB_DIR): colabfold_volume},
    secrets=[sentry_secret],
    memory=131072,  # 128GB RAM for MMseqs2 search
    timeout=1800,  # 30 min max per search
    cpu=8,
)
def run_msa_search(
    sequences: list[tuple[str, str]],
    job_id: str | None = None,
) -> dict:
    """
    Run MMseqs2 MSA search against ColabFold databases.

    Args:
        sequences: List of (chain_id, sequence) tuples
        job_id: Optional job ID for tracking

    Returns:
        dict with:
            - a3m_files: dict mapping chain_id to A3M file path
            - status: "completed" or "failed"
            - usage: timing info
    """
    init_sentry()
    start_time = time.time()
    job_id = job_id or str(uuid.uuid4())

    # Check if databases are available
    uniref_marker = COLABFOLD_DB_DIR / ".uniref30_complete"
    if not uniref_marker.exists():
        return {
            "status": "failed",
            "error": "ColabFold databases not set up. Run: modal run scripts/setup_colabfold_dbs.py",
            "job_id": job_id,
        }

    uniref_db = COLABFOLD_DB_DIR / "uniref30_2302" / "uniref30_2302_db"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        a3m_files: dict[str, str] = {}

        for chain_id, sequence in sequences:
            # Write query FASTA
            query_fasta = tmpdir_path / f"{chain_id}_query.fasta"
            query_fasta.write_text(f">{chain_id}\n{sequence}\n")

            # Output paths
            result_dir = tmpdir_path / f"{chain_id}_result"
            result_dir.mkdir(exist_ok=True)
            a3m_path = tmpdir_path / f"{chain_id}.a3m"

            # Run MMseqs2 search against UniRef30
            print(f"Searching UniRef30 for chain {chain_id} ({len(sequence)} residues)...")
            search_cmd = [
                "mmseqs", "easy-search",
                str(query_fasta),
                str(uniref_db),
                str(result_dir / "uniref_hits.m8"),
                str(result_dir / "tmp"),
                "--format-output", "query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,tseq",
                "-e", "0.0001",
                "--max-seqs", "500",
                "-s", "7.5",
            ]

            try:
                subprocess.run(search_cmd, check=True, capture_output=True, text=True)
            except subprocess.CalledProcessError as e:
                print(f"MMseqs2 search failed for {chain_id}: {e.stderr}")
                continue

            # Convert results to A3M format
            hits_file = result_dir / "uniref_hits.m8"
            if hits_file.exists():
                a3m_content = convert_mmseqs_to_a3m(query_fasta, hits_file)
                a3m_path.write_text(a3m_content)
                a3m_files[chain_id] = str(a3m_path)
                print(f"Generated MSA for chain {chain_id}: {a3m_path}")
            else:
                # No hits - create single-sequence A3M
                a3m_path.write_text(f">{chain_id}\n{sequence}\n")
                a3m_files[chain_id] = str(a3m_path)
                print(f"No MSA hits for chain {chain_id}, using single sequence")

        execution_seconds = round(time.time() - start_time, 2)

        return {
            "status": "completed",
            "job_id": job_id,
            "a3m_files": a3m_files,
            "usage": {
                "execution_seconds": execution_seconds,
            },
        }
