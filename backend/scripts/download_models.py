#!/usr/bin/env python3
"""
Fetches the Piper TTS voice model into backend/models/piper/.

This is the only model NARI needs to download ahead of time:
  - faster-whisper (speech-to-text) downloads and caches its own model
    from Hugging Face automatically on first use - no separate step.
  - Piper (text-to-speech) needs its .onnx voice + .onnx.json config
    fetched manually, which is what this script does.

Run this on a machine with normal internet access (including to
huggingface.co). If GROQ_API_KEY and PIPER_VOICE_MODEL/PIPER_VOICE_CONFIG
aren't set at all, the app still runs fine - report parsing falls back to
raw OCR text, chat/voice fall back to the offline keyword-rule router,
and TTS falls back to the browser's own speechSynthesis. This script
just lets you upgrade the voice pipeline to the real Piper engine.

Usage:
    python scripts/download_models.py

Notes:
  * Any voice from https://huggingface.co/rhasspy/piper-voices works -
    update PIPER_VOICE below (and PIPER_VOICE_MODEL/PIPER_VOICE_CONFIG
    in your .env) to use a different one.
  * If a download 404s, the source has likely moved - check the voices
    listing at the URL above and update PIPER_VOICE_URL_BASE.
"""
import json
import shutil
import sys
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

# Anything under ~1KB downloaded for a model file is almost certainly an
# error page, not real weights/config.
MIN_PLAUSIBLE_BYTES = 1_000

PIPER_VOICE = "en_US-lessac-medium"
PIPER_VOICE_URL_BASE = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium"
)


def _download(url: str, dest: Path, min_bytes: int = MIN_PLAUSIBLE_BYTES) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "nari-model-fetch/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp, open(dest, "wb") as f:
            shutil.copyfileobj(resp, f)
    except Exception as e:
        print(f"    ! download failed: {e}")
        return False

    size = dest.stat().st_size
    if size < min_bytes:
        head = dest.read_bytes()[:200]
        print(
            f"    ! downloaded file is only {size} bytes - looks like an error page, "
            f"not model weights/config. First bytes: {head!r}"
        )
        dest.unlink(missing_ok=True)
        return False

    print(f"    saved {dest} ({size / 1024:.0f} KB)")
    return True


def fetch_piper_voice() -> None:
    print(f"Piper TTS voice ({PIPER_VOICE}, MIT license)")
    voice_dir = MODELS_DIR / "piper"
    model_dest = voice_dir / f"{PIPER_VOICE}.onnx"
    config_dest = voice_dir / f"{PIPER_VOICE}.onnx.json"

    if model_dest.exists() and config_dest.exists():
        print(f"    already present at {voice_dir}, skipping")
        return

    ok = _download(f"{PIPER_VOICE_URL_BASE}/{PIPER_VOICE}.onnx", model_dest, min_bytes=1_000_000)
    ok = _download(f"{PIPER_VOICE_URL_BASE}/{PIPER_VOICE}.onnx.json", config_dest, min_bytes=100) and ok

    if not ok:
        print("    Could not fetch automatically. Browse available voices at:")
        print("      https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US")
        print("    Any voice works - update PIPER_VOICE/PIPER_VOICE_URL_BASE above")
        print("    (and PIPER_VOICE_MODEL/PIPER_VOICE_CONFIG in your .env) accordingly.")
        return

    try:
        json.loads(config_dest.read_text())
    except Exception:
        print("    ! voice config doesn't look like valid JSON - check it manually.")


def main() -> int:
    MODELS_DIR.mkdir(exist_ok=True)
    fetch_piper_voice()
    print("\nDone. Set these in your .env to enable server-side TTS:")
    print(f"  PIPER_VOICE_MODEL=backend/models/piper/{PIPER_VOICE}.onnx")
    print(f"  PIPER_VOICE_CONFIG=backend/models/piper/{PIPER_VOICE}.onnx.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())