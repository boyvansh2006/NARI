from __future__ import annotations

from pydantic import BaseModel


class VoiceConverseResponse(BaseModel):
    transcript: str
    agent: str
    reply: str
    urgent: bool = False
    audio_base64: str | None = None
    audio_format: str = "wav"
    tts_available: bool = False
    stt_available: bool = False


class VoiceStatusResponse(BaseModel):
    """Returned from GET /api/v1/voice/status so the frontend knows
    whether to record audio for server-side STT (faster-whisper) or fall
    back to the browser's own SpeechRecognition, and whether to expect
    synthesized audio back or fall back to speechSynthesis."""

    stt_available: bool
    tts_available: bool