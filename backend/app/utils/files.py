from __future__ import annotations

import re
import unicodedata
from pathlib import Path

_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")
DEFAULT_FALLBACK_NAME = "upload"
MAX_FILENAME_LENGTH = 200


def sanitize_filename(filename: str) -> str:
    """
    Turn a user-supplied filename into something safe to use as part of a
    storage path: strips any directory components (so "../../etc/passwd"
    can't escape the uploads dir), normalizes unicode, replaces anything
    that isn't alphanumeric/dot/dash/underscore, and caps the length while
    preserving the file extension.
    """
    # Drop any path component the client might have sent - only the
    # basename is ever trusted.
    name = Path(filename or "").name
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")

    stem, _, suffix = name.rpartition(".")
    if not stem:
        stem, suffix = suffix, ""

    stem = _UNSAFE_CHARS.sub("_", stem).strip("._") or DEFAULT_FALLBACK_NAME
    suffix = _UNSAFE_CHARS.sub("", suffix)[:10]

    safe_name = f"{stem}.{suffix}" if suffix else stem
    if len(safe_name) > MAX_FILENAME_LENGTH:
        keep = MAX_FILENAME_LENGTH - len(suffix) - 1 if suffix else MAX_FILENAME_LENGTH
        safe_name = f"{stem[:keep]}.{suffix}" if suffix else stem[:keep]

    return safe_name