from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import UploadFile
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.exceptions import InvalidDocumentError

# ---------------------------------------------------------------------------
# GGSIPU2617 extension: password hashing + JWT issuing/verification.
#
# The Vitalis/Aarogya baseline had no authentication at all beyond an
# optional, never-set `user_id` on Report. SRAI - Safety Framework and
# EPGA - Gap Analysis both flag "Privacy: Consent + RBAC + minimization +
# audit" as Critical priority, so this adds a minimal but real JWT auth
# layer (roles: "patient" / "clinician") that the new patient-data and
# clinician-dashboard endpoints depend on.
#
# This is intentionally minimal - see README "Known gaps" for what a
# production rollout still needs (refresh tokens, email verification,
# password reset, rate limiting, MFA).
# ---------------------------------------------------------------------------

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h - fine for a demo/hackathon build


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _pwd_context.verify(plain_password, hashed_password)


def _jwt_secret() -> str:
    settings = get_settings()
    # Falls back to a fixed dev secret so the app still boots with zero
    # configuration (matching the rest of this codebase's philosophy), but
    # logs loudly - see Settings.jwt_secret_key.
    return settings.jwt_secret_key or "insecure-dev-secret-change-me"


def create_access_token(subject: uuid.UUID, role: str, extra_claims: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
    except JWTError:
        return None

ALLOWED_PDF_MIME_TYPES = {"application/pdf", "application/octet-stream"}
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}


def _looks_like_image(header: bytes) -> bool:
    """
    Sniff the file's actual magic bytes rather than trusting its extension
    or client-supplied Content-Type, mirroring the PDF check below (which
    already verified b"%PDF"). Covers the formats accepted by the
    dropzone's "image/*,.pdf" input: JPEG, PNG, WEBP, and HEIC/HEIF (which
    are all boxes in an ISO base media container with "ftyp" at offset 4).
    """
    if header.startswith(b"\xff\xd8\xff"):
        return True
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return True
    if header[4:8] == b"ftyp":
        return True
    return False


async def validate_report_upload(upload_file: UploadFile) -> str:
    """
    Extended from Vitalis's validate_pdf_upload: the NARI dropzone
    accepts "image/*,.pdf" (a photo of a report, not just a scanned PDF),
    so this validates either and returns which kind it is.
    """
    filename = (upload_file.filename or "").lower()
    content_type = upload_file.content_type or ""

    is_pdf = filename.endswith(".pdf") or content_type in ALLOWED_PDF_MIME_TYPES
    is_image = content_type in ALLOWED_IMAGE_MIME_TYPES or filename.endswith(
        (".jpg", ".jpeg", ".png", ".webp", ".heic")
    )

    if not (is_pdf or is_image):
        raise InvalidDocumentError(
            f"Unsupported file: {filename or 'unknown'} ({content_type or 'unknown type'})"
        )

    header = await upload_file.read(16)
    await upload_file.seek(0)

    if is_pdf and not is_image:
        if not header.startswith(b"%PDF"):
            raise InvalidDocumentError("The uploaded file does not appear to be a valid PDF")
        return "pdf"

    if not _looks_like_image(header):
        raise InvalidDocumentError(
            f"The uploaded file does not appear to be a valid image: {filename or 'unknown'}"
        )

    return "image"