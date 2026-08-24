from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import get_current_user_id
from app.core.exceptions import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidOrExpiredTokenError,
)
from app.core.logging import get_logger
from app.core.rate_limit import AUTH_RATE_LIMIT, limiter
from app.core.security import (
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS,
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    generate_opaque_token,
    hash_opaque_token,
    hash_password,
    verify_password,
)
from app.database.database import get_db_session
from app.database.models import EmailVerificationToken, PasswordResetToken, RefreshToken, User
from app.schemas.auth import (
    AccessTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserRead,
    VerifyEmailRequest,
)
from app.services.email_service import send_password_reset_email, send_verification_email
from app.services.report_service import ReportService

LOGGER = get_logger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _issue_tokens(session: AsyncSession, user: User) -> tuple[str, str]:
    """Issues a fresh access JWT + a fresh opaque refresh token, persisting
    only the refresh token's hash (see security.hash_opaque_token)."""
    access_token = create_access_token(user.id, user.role)
    refresh_token = generate_opaque_token()
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_opaque_token(refresh_token),
            expires_at=_utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    await session.commit()
    return access_token, refresh_token


async def _claim_guest_reports_if_any(
    session: AsyncSession, user_id, guest_session_id: str | None
) -> int:
    if not guest_session_id:
        return 0
    try:
        return await ReportService(session).claim_guest_reports(user_id, guest_session_id)
    except Exception as exc:  # best-effort - never block login/register on this
        LOGGER.warning(f"Failed to claim guest reports for user_id={user_id}: {exc}")
        return 0


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit(AUTH_RATE_LIMIT)
async def register(
    request: Request,
    payload: RegisterRequest,
    x_guest_session_id: str | None = Header(default=None, alias="X-Guest-Session-Id"),
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    existing = (
        await session.execute(select(User).where(User.email == payload.email.lower()))
    ).scalar_one_or_none()
    if existing is not None:
        raise EmailAlreadyRegisteredError()

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=(payload.full_name or "").strip(),
        role="patient",
        is_verified=False,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Email verification (audit fix: "no email verification"). Best-effort -
    # a delivery hiccup shouldn't block account creation.
    try:
        verify_token = generate_opaque_token()
        session.add(
            EmailVerificationToken(
                user_id=user.id,
                token_hash=hash_opaque_token(verify_token),
                expires_at=_utcnow() + timedelta(hours=EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS),
            )
        )
        await session.commit()
        send_verification_email(user.email, verify_token)
    except Exception as exc:
        LOGGER.warning(f"Failed to create/send verification email for {user.email}: {exc}")

    claimed = await _claim_guest_reports_if_any(session, user.id, x_guest_session_id)
    access_token, refresh_token = await _issue_tokens(session, user)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserRead.model_validate(user, from_attributes=True),
        claimed_reports=claimed,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def login(
    request: Request,
    payload: LoginRequest,
    x_guest_session_id: str | None = Header(default=None, alias="X-Guest-Session-Id"),
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    user = (
        await session.execute(select(User).where(User.email == payload.email.lower()))
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise InvalidCredentialsError()

    claimed = await _claim_guest_reports_if_any(session, user.id, x_guest_session_id)
    access_token, refresh_token = await _issue_tokens(session, user)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserRead.model_validate(user, from_attributes=True),
        claimed_reports=claimed,
    )


@router.post("/refresh", response_model=AccessTokenResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def refresh_token_endpoint(
    request: Request,
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
) -> AccessTokenResponse:
    """
    GGSIPU2617 extension - audit fix ("Single 24h JWT with no refresh
    flow"). Verifies the presented refresh token against its stored hash,
    rejects it if revoked/expired, then rotates it (issues a new refresh
    token and revokes the old one) rather than reusing the same refresh
    token indefinitely - limits the blast radius if one is ever leaked.
    """
    token_hash = hash_opaque_token(payload.refresh_token)
    stored = (
        await session.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    ).scalar_one_or_none()

    if stored is None or stored.revoked_at is not None or stored.expires_at < _utcnow():
        raise InvalidOrExpiredTokenError("This session has expired - please sign in again")

    user = (await session.execute(select(User).where(User.id == stored.user_id))).scalar_one_or_none()
    if user is None:
        raise InvalidOrExpiredTokenError("This session is no longer valid - please sign in again")

    # Rotate: revoke the used token, issue a brand new one.
    stored.revoked_at = _utcnow()
    access_token, new_refresh_token = await _issue_tokens(session, user)

    return AccessTokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    payload: LogoutRequest,
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    token_hash = hash_opaque_token(payload.refresh_token)
    stored = (
        await session.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    ).scalar_one_or_none()
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = _utcnow()
        await session.commit()
    # Always a generic success, whether or not the token existed - no need
    # to leak that information to the caller.
    return MessageResponse(message="Signed out")


@router.get("/me", response_model=UserRead)
async def read_current_user(
    user_id=Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> UserRead:
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise InvalidCredentialsError("Account no longer exists")
    return UserRead.model_validate(user, from_attributes=True)


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    """
    GGSIPU2617 extension - audit fix ("no ... forgot-password flow").
    Always returns the same generic message regardless of whether the
    email is registered, so this endpoint can't be used to enumerate which
    emails have accounts.
    """
    generic_message = MessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )
    user = (
        await session.execute(select(User).where(User.email == payload.email.lower()))
    ).scalar_one_or_none()
    if user is None:
        return generic_message

    try:
        reset_token = generate_opaque_token()
        session.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_opaque_token(reset_token),
                expires_at=_utcnow() + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
            )
        )
        await session.commit()
        send_password_reset_email(user.email, reset_token)
    except Exception as exc:
        LOGGER.warning(f"Failed to create/send password reset email for {user.email}: {exc}")

    return generic_message


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    token_hash = hash_opaque_token(payload.token)
    stored = (
        await session.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        )
    ).scalar_one_or_none()

    if stored is None or stored.used_at is not None or stored.expires_at < _utcnow():
        raise InvalidOrExpiredTokenError()

    user = (await session.execute(select(User).where(User.id == stored.user_id))).scalar_one_or_none()
    if user is None:
        raise InvalidOrExpiredTokenError()

    user.hashed_password = hash_password(payload.new_password)
    stored.used_at = _utcnow()

    # Resetting the password invalidates every existing session - a
    # leaked/compromised-password scenario is exactly when you don't want
    # old refresh tokens to keep working.
    active_tokens = (
        await session.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
            )
        )
    ).scalars().all()
    for rt in active_tokens:
        rt.revoked_at = _utcnow()

    await session.commit()
    return MessageResponse(message="Your password has been reset - please sign in again")


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    payload: VerifyEmailRequest,
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    token_hash = hash_opaque_token(payload.token)
    stored = (
        await session.execute(
            select(EmailVerificationToken).where(EmailVerificationToken.token_hash == token_hash)
        )
    ).scalar_one_or_none()

    if stored is None or stored.used_at is not None or stored.expires_at < _utcnow():
        raise InvalidOrExpiredTokenError()

    user = (await session.execute(select(User).where(User.id == stored.user_id))).scalar_one_or_none()
    if user is None:
        raise InvalidOrExpiredTokenError()

    user.is_verified = True
    stored.used_at = _utcnow()
    await session.commit()
    return MessageResponse(message="Email verified")