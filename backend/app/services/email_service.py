from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger

LOGGER = get_logger(__name__)

# ---------------------------------------------------------------------------
# GGSIPU2617 extension - audit fix ("no email verification, no password
# reset"). This project has no SMTP/transactional-email provider configured
# (no SENDGRID_API_KEY/SMTP_* settings exist anywhere in core/config.py), so
# actually delivering an email is out of scope for this pass. Rather than
# silently no-op (which would make "forgot password" look like it works
# while quietly doing nothing), this logs the link at INFO level so it's
# fully usable in local/dev, and is the single seam a real deployment needs
# to replace (swap the body of `_deliver` for SendGrid/SES/SMTP/etc - every
# caller in api/auth.py already goes through this module, not print()/log
# calls scattered around).
# ---------------------------------------------------------------------------


def _frontend_url() -> str:
    settings = get_settings()
    # Reuses the first configured CORS origin as a best-guess frontend base
    # URL (there's no dedicated FRONTEND_URL setting in this project yet).
    origins = settings.cors_origins
    return origins[0] if origins else "http://localhost:5173"


def _deliver(to_email: str, subject: str, body: str) -> None:
    LOGGER.info(
        "Email delivery is not configured (no SMTP/email provider set up) - "
        "logging instead of sending. Wire a real provider into "
        "services/email_service._deliver for production use.",
        extra={"to": to_email, "subject": subject},
    )
    LOGGER.info(f"--- EMAIL to {to_email} ---\nSubject: {subject}\n\n{body}\n--- end email ---")


def send_verification_email(to_email: str, token: str) -> None:
    link = f"{_frontend_url()}/verify-email?token={token}"
    _deliver(
        to_email,
        "Verify your NARI account",
        f"Welcome to NARI. Confirm your email address by visiting:\n{link}\n\n"
        f"This link expires in 24 hours.",
    )


def send_password_reset_email(to_email: str, token: str) -> None:
    link = f"{_frontend_url()}/reset-password?token={token}"
    _deliver(
        to_email,
        "Reset your NARI password",
        f"Someone (hopefully you) requested a password reset. Visit:\n{link}\n\n"
        f"This link expires in 30 minutes. If you didn't request this, you can ignore this email.",
    )