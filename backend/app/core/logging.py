from __future__ import annotations

import logging
import sys

_CONFIGURED = False

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def configure_logging(log_level: str = "INFO") -> None:
    """
    Configure the root logger once for the whole process.

    Called a single time from main.py at startup. Safe to call more than
    once (e.g. from tests) - subsequent calls are no-ops so handlers are
    never attached twice.
    """
    global _CONFIGURED
    if _CONFIGURED:
        return

    level = getattr(logging, log_level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT))

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]

    # Quiet down noisy third-party loggers unless we're in DEBUG.
    if level > logging.DEBUG:
        for noisy in ("httpx", "httpcore", "faster_whisper", "uvicorn.access"):
            logging.getLogger(noisy).setLevel(logging.WARNING)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """
    Module-level logger factory used everywhere as
    `LOGGER = get_logger(__name__)`. Works even if configure_logging()
    hasn't run yet (falls back to logging's default lastResort handler),
    so import order never matters.
    """
    return logging.getLogger(name)