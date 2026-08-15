import os
import re
import hashlib
import requests
import mimetypes
from typing import Optional, Dict, Any, Union

SUPABASE_URL = os.environ.get(" ", "https://mimmgklddepndpgohcwo.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
BUCKET_NAME = os.environ.get("SUPABASE_BUCKET_NAME", "crimeos-evidence")


def compute_sha256(data: Union[bytes, str]) -> str:
    """Computes SHA-256 hash of data for forensic tamper verification."""
    raw_bytes = data if isinstance(data, bytes) else data.encode("utf-8")
    return hashlib.sha256(raw_bytes).hexdigest()


def upload_to_supabase_storage(
    content_or_path: Union[bytes, str],
    destination_path: str,
    mime_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Uploads a file or binary payload to Supabase Storage with deterministic upsert.
    Guarantees no duplicate storage consumption (x-upsert: true).
    
    Returns:
        Dict with storage_url, path, sha256, and is_cloud flag.
    """
    # 1. Read file bytes
    if isinstance(content_or_path, str) and os.path.exists(content_or_path):
        with open(content_or_path, "rb") as f:
            file_bytes = f.read()
        if not mime_type:
            mime_type = mimetypes.guess_type(content_or_path)[0] or "application/octet-stream"
    elif isinstance(content_or_path, bytes):
        file_bytes = content_or_path
        if not mime_type:
            mime_type = "application/octet-stream"
    else:
        file_bytes = str(content_or_path).encode("utf-8")
        if not mime_type:
            mime_type = "text/plain; charset=utf-8"

    sha256_hash = compute_sha256(file_bytes)

    # Clean destination path (prevent spaces and special characters)
    clean_dest = re.sub(r'[^a-zA-Z0-9_./-]', '_', destination_path).lstrip('/')

    if SUPABASE_URL and SUPABASE_KEY:
        try:
            # Supabase Storage REST endpoint for object upload
            url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{BUCKET_NAME}/{clean_dest}"
            headers = {
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "apikey": SUPABASE_KEY,
                "Content-Type": mime_type,
                "x-upsert": "true"  # Never creates duplicate files in Supabase
            }

            resp = requests.post(url, headers=headers, data=file_bytes, timeout=15)
            if resp.status_code in [200, 201]:
                public_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{BUCKET_NAME}/{clean_dest}"
                return {
                    "storage_url": public_url,
                    "path": clean_dest,
                    "sha256": sha256_hash,
                    "is_cloud": True,
                    "status": "success"
                }
            else:
                # If bucket doesn't exist, log warning and fallback
                print(f"[-] Supabase upload warning ({resp.status_code}): {resp.text}")
        except Exception as e:
            print(f"[-] Supabase connection error: {e}")

    # Fallback to local / API relative URL
    return {
        "storage_url": f"/api/requests/download/{os.path.basename(clean_dest)}",
        "path": clean_dest,
        "sha256": sha256_hash,
        "is_cloud": False,
        "status": "local_fallback"
    }
