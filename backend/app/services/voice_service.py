"""
Voice-to-voice pipeline: speech-to-text and text-to-speech.

This is MAITRI's audio stack (maitri/audio/stt.py, maitri/audio/tts.py)
reused for the STT/TTS engines themselves (faster-whisper, Piper), but
restructured for a web request/response cycle instead of a desktop app
with a live microphone:

  - MAITRI's SpeechRecognizer ran a background thread doing continuous
    mic capture + RMS voice-activity detection to decide when an
    utterance started/ended, then handed a buffered numpy array to
    faster-whisper. In the browser, the NARI mic button already does
    that job (the person presses to start/stop recording), so this
    service only needs the transcription half: given a finished audio
    file from the browser's MediaRecorder, run it through the same
    WhisperModel.transcribe() call MAITRI used.

  - MAITRI's VoiceOutput queued text, synthesized it with Piper, and
    played it through local speakers via sounddevice. Here there are no
    local speakers - _synthesize_to_array's Piper call is reused as-is,
    then the resulting float32 PCM array is encoded to a WAV byte string
    and sent back to the browser to play, instead of calling sd.play().

Both engines load lazily and optionally, exactly like MAITRI: if
faster-whisper/Piper or their model files aren't available, the service
reports itself unavailable rather than raising, and the API layer falls
back to the browser's own SpeechRecognition/speechSynthesis (which is
what aarogya-app.jsx already used before this backend existed).
"""
from __future__ import annotations

import io
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.core.config import get_settings
from app.core.logging import get_logger

LOGGER = get_logger(__name__)

try:
    from faster_whisper import WhisperModel

    WHISPER_IMPORT_OK = True
except Exception as exc:  # pragma: no cover - depends on optional install
    WHISPER_IMPORT_OK = False
    LOGGER.warning(f"faster-whisper unavailable: {exc}")

try:
    from piper import PiperVoice, SynthesisConfig

    PIPER_IMPORT_OK = True
except Exception as exc:  # pragma: no cover - depends on optional install
    PIPER_IMPORT_OK = False
    LOGGER.warning(f"piper-tts unavailable: {exc}")


class VoiceService:
    def __init__(self) -> None:
        settings = get_settings()
        self._whisper_model = None
        self._piper_voice = None
        self._piper_syn_config = None

        self.stt_available = False
        self.tts_available = False

        if WHISPER_IMPORT_OK:
            try:
                self._whisper_model = WhisperModel(
                    settings.whisper_model_size,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type,
                )
                self.stt_available = True
                LOGGER.info(f"faster-whisper model '{settings.whisper_model_size}' loaded")
            except Exception as exc:
                LOGGER.warning(
                    f"Whisper model load failed ({exc}); STT will fall back to the browser's "
                    "own SpeechRecognition."
                )

        if PIPER_IMPORT_OK and settings.piper_voice_model and settings.piper_voice_config:
            try:
                self._piper_voice = PiperVoice.load(settings.piper_voice_model, settings.piper_voice_config)
                self._piper_syn_config = SynthesisConfig(length_scale=1.0, noise_scale=0.667, noise_w_scale=0.8)
                self.tts_available = True
                LOGGER.info(f"Piper voice loaded from {settings.piper_voice_model}")
            except Exception as exc:
                LOGGER.warning(
                    f"Piper voice load failed ({exc}); run scripts/download_models.py --voice, or "
                    "TTS will fall back to the browser's own speechSynthesis."
                )
        else:
            LOGGER.info(
                "PIPER_VOICE_MODEL/PIPER_VOICE_CONFIG not set - TTS will fall back to the "
                "browser's own speechSynthesis."
            )

    # -- STT ------------------------------------------------------------

    def transcribe(self, audio_path: Path, language: str | None = None) -> str | None:
        """Reused from MAITRI's SpeechRecognizer._transcribe: same
        WhisperModel.transcribe() call, minus the VAD-segmentation/queue
        machinery that only made sense for a live microphone stream.
        faster-whisper decodes most container/codec formats (webm/opus,
        wav, m4a, ...) directly via its bundled PyAV dependency, so the
        browser's raw MediaRecorder blob can be passed straight through.

        BUG FIX ("platform doesn't understand what I say"): this used to
        hard-code `language="en"` on every call, so any of the app's other
        9 supported languages (see i18n.js's SUPPORTED_LANGUAGES) got force
        -decoded as English and came out as garbage or empty text. Now the
        caller (api/voice.py) passes through the UI's selected language;
        if it's None/unrecognized, we let Whisper auto-detect instead of
        assuming English. Auto-detect needs a couple hundred ms of audio to
        be reliable, but is still far better than a hard-coded wrong
        language. See also core/config.py's whisper_model_size - this only
        helps if the loaded model is actually multilingual (a "*.en" model
        physically cannot decode anything but English, no matter what
        language= is passed here)."""
        if not self.stt_available or self._whisper_model is None:
            return None
        try:
            segments, _info = self._whisper_model.transcribe(
                str(audio_path),
                language=language or None,  # None = auto-detect, not "en"
                vad_filter=True,
                beam_size=1,
                condition_on_previous_text=False,
            )
            text = " ".join(seg.text.strip() for seg in segments).strip()
            return text or None
        except Exception as exc:
            LOGGER.error(f"Whisper transcription failed: {exc}")
            return None

    # -- TTS ------------------------------------------------------------

    def synthesize_wav(self, text: str) -> bytes | None:
        """Reused from MAITRI's VoiceOutput._synthesize_to_array, with the
        sd.play()/sd.wait() local-speaker playback swapped for WAV-encoding
        the resulting PCM so it can be sent back over HTTP and played by
        the browser's <audio> element instead."""
        if not self.tts_available or self._piper_voice is None:
            return None
        try:
            chunks = list(self._piper_voice.synthesize(text, syn_config=self._piper_syn_config))
            if not chunks:
                return None
            sample_rate = chunks[0].sample_rate
            audio = np.concatenate([c.audio_float_array for c in chunks])
            return _float32_to_wav_bytes(audio, sample_rate)
        except Exception as exc:
            LOGGER.error(f"Piper synthesis failed: {exc}")
            return None


def _float32_to_wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
    pcm16 = np.clip(audio, -1.0, 1.0)
    pcm16 = (pcm16 * 32767.0).astype(np.int16)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm16.tobytes())
    return buffer.getvalue()


@lru_cache(maxsize=1)
def get_voice_service() -> VoiceService:
    return VoiceService()