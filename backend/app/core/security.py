from __future__ import annotations

import hashlib
import secrets
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
# production rollout still needs (email verification, password reset, MFA).
#
# SECURITY FIX (audit finding "Auth & Security"): this used to fall back to
# a fixed "insecure-dev-secret-change-me" string with only a log line if
# JWT_SECRET_KEY was unset - meaning a misconfigured production deployment
# would boot "successfully" and sign every session with a secret published
# in this repo's source code. Now: the dev fallback only applies when
# ENVIRONMENT is NOT production (see Settings.is_production); main.py's
# `assert_production_config()` additionally fails app *startup* outright if
# JWT_SECRET_KEY is unset in production, rather than waiting for this
# function to be called lazily on the first login/token check.
# ---------------------------------------------------------------------------

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h - fine for a demo/hackathon build
_DEV_ONLY_JWT_SECRET = "insecure-dev-secret-change-me"


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _pwd_context.verify(plain_password, hashed_password)


def _jwt_secret() -> str:
    settings = get_settings()
    if settings.jwt_secret_key:
        return settings.jwt_secret_key
    if settings.is_production:
        # Defense in depth: main.py's startup check should already have
        # raised before the app ever accepted a request, but never issue a
        # token signed with the published dev secret in production even if
        # that check were somehow bypassed.
        raise RuntimeError(
            "JWT_SECRET_KEY is not set and ENVIRONMENT=production - refusing to "
            "sign tokens with the default development secret."
        )
    return _DEV_ONLY_JWT_SECRET


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


# ---------------------------------------------------------------------------
# GGSIPU2617 extension - audit fix ("Single 24h JWT with no refresh flow, no
# email verification, no password reset"). Opaque, single-use/rotatable
# tokens for refresh/reset/verify, distinct from the short-lived JWT access
# token above. The value handed to the client is a high-entropy random
# string; only its SHA-256 hash is ever persisted, so a leaked DB row alone
# can't be replayed as a live token (same principle as never storing plain
# passwords - see hash_password above).
# ---------------------------------------------------------------------------

REFRESH_TOKEN_EXPIRE_DAYS = 30
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 30
EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS = 24


def generate_opaque_token() -> str:
    """A URL-safe random token for refresh/reset/verify links. Not a JWT -
    it carries no claims itself, it's just a lookup key for the hashed row
    in refresh_tokens/password_reset_tokens/email_verification_tokens."""
    return secrets.token_urlsafe(32)


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


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