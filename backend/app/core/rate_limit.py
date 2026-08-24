from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# ---------------------------------------------------------------------------
# GGSIPU2617 extension - audit fix ("No rate limiting anywhere (login, chat,
# upload) - brute-forceable and abuse-prone"). Shared Limiter instance:
# main.py registers it on app.state + the SlowAPIMiddleware/exception
# handler, and individual routes opt in with @limiter.limit("...").
#
# Keyed by remote address (per-IP) rather than per-user, since the routes
# that most need protection (login, register, forgot-password) are exactly
# the ones an unauthenticated caller hits before we know who they are.
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

# Named limits so every route that shares a sensitivity class stays in sync
# instead of each endpoint hand-rolling its own string.
AUTH_RATE_LIMIT = "5/minute"
UPLOAD_RATE_LIMIT = "20/minute"
CHAT_RATE_LIMIT = "30/minute"