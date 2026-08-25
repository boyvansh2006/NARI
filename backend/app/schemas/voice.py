from __future__ import annotations

from pydantic import BaseModel, Field


class VoiceConverseResponse(BaseModel):
    transcript: str
    agent: str
    reply: str
    urgent: bool = False
    audio_base64: str | None = None
    audio_format: str = "wav"
    tts_available: bool = False
    stt_available: bool = False
    # See schemas/chat.py's ChatResponse.follow_up_questions - same idea,
    # threaded through for voice turns so the frontend can offer the same
    # tappable quick-reply chips after a spoken answer.
    follow_up_questions: list[str] = Field(default_factory=list)


class VoiceStatusResponse(BaseModel):
    """Returned from GET /api/v1/voice/status so the frontend knows
    whether to record audio for server-side STT (faster-whisper) or fall
    back to the browser's own SpeechRecognition, and whether to expect
    synthesized audio back or fall back to speechSynthesis."""

    stt_available: bool
    tts_available: bool