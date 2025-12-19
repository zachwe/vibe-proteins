"""
Storage helpers for Cloudflare R2 / S3-compatible buckets.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Tuple

import boto3
import botocore.client
import requests


class R2ConfigError(RuntimeError):
  """Raised when required environment variables are missing."""


def _require_env(name: str) -> str:
  value = os.environ.get(name)
  if not value:
    raise R2ConfigError(f"Missing environment variable: {name}")
  return value


@lru_cache(maxsize=1)
def get_r2_client() -> botocore.client.BaseClient:
  account_id = _require_env("R2_ACCOUNT_ID")
  access_key = _require_env("R2_ACCESS_KEY_ID")
  secret_key = _require_env("R2_SECRET_ACCESS_KEY")

  session = boto3.session.Session(
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
  )
  endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
  return session.client("s3", region_name="auto", endpoint_url=endpoint)


def parse_s3_uri(uri: str) -> Tuple[str, str]:
  if not uri.startswith(("s3://", "r2://")):
    raise ValueError(f"Unsupported URI: {uri}")
  scheme, remainder = uri.split("://", 1)
  parts = remainder.split("/", 1)
  bucket = parts[0]
  key = parts[1] if len(parts) > 1 else ""
  return bucket, key


def object_url(key: str) -> str:
  key = key.lstrip("/")
  public_base = os.environ.get("R2_PUBLIC_BASE_URL")
  if public_base:
    return f"{public_base.rstrip('/')}/{key}"

  account_id = _require_env("R2_ACCOUNT_ID")
  bucket = _require_env("R2_BUCKET_NAME")
  return f"https://{account_id}.r2.cloudflarestorage.com/{bucket}/{key}"


def upload_bytes(data: bytes, key: str, content_type: str = "application/octet-stream") -> dict:
  client = get_r2_client()
  bucket = _require_env("R2_BUCKET_NAME")
  client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
  return {"key": key, "url": object_url(key)}


def upload_file(path: Path, key: str, content_type: str = "application/octet-stream") -> dict:
  return upload_bytes(path.read_bytes(), key, content_type=content_type)


def download_to_path(source: str, destination: Path) -> Path:
  destination.parent.mkdir(parents=True, exist_ok=True)
  if source.startswith(("s3://", "r2://")):
    bucket, key = parse_s3_uri(source)
    get_r2_client().download_file(bucket, key, str(destination))
  elif source.startswith("http://") or source.startswith("https://"):
    response = requests.get(source, timeout=60)
    response.raise_for_status()
    destination.write_bytes(response.content)
  else:
    # Raw PDB string
    destination.write_text(source)
  return destination
