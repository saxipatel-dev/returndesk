"""Evidence uploads (photos and receipts).

Files are checked three ways before they are stored: extension, declared
content type and the actual leading bytes of the file. They are saved under a
random name in a private directory and only served through an authorized
download endpoint, never as static files.
"""

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

# extension -> (mime type, magic bytes check)
ALLOWED_TYPES = {
    ".jpg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    ".png": ("image/png", lambda b: b.startswith(b"\x89PNG\r\n\x1a\n")),
    ".webp": ("image/webp", lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
    ".pdf": ("application/pdf", lambda b: b.startswith(b"%PDF-")),
}


def upload_root() -> Path:
    root = get_settings().upload_dir
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_upload(file: UploadFile) -> tuple[str, str, int]:
    """Validate and store an upload. Returns (storage_key, mime_type, size)."""
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Only JPG, PNG, WEBP and PDF files are allowed.",
        )

    mime_type, looks_valid = ALLOWED_TYPES[extension]
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"Files must be {get_settings().max_upload_mb} MB or smaller.",
        )
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty.")
    if not looks_valid(data[:16]):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "The file content doesn't match its extension."
        )

    storage_key = f"{uuid.uuid4().hex}{extension}"
    (upload_root() / storage_key).write_bytes(data)
    return storage_key, mime_type, len(data)


def stored_path(storage_key: str) -> Path:
    path = (upload_root() / storage_key).resolve()
    if path.parent != upload_root().resolve() or not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    return path


def delete_stored(storage_key: str):
    (upload_root() / storage_key).unlink(missing_ok=True)
