from __future__ import annotations

import asyncio
import base64
import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EmptyTranscriptError
from app.core.logging import get_logger
from app.database.database import get_db_session
from app.schemas.chat import ChatHistoryItem, HealthProfile
from app.schemas.voice import VoiceConverseResponse, VoiceStatusResponse
from app.services import agent_service
from app.services.voice_service import get_voice_service

LOGGER = get_logger(__name__)

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])


@router.get("/status", response_model=VoiceStatusResponse)
async def voice_status() -> VoiceStatusResponse:
    """Lets the frontend decide whether to record audio for server-side STT
    or fall back to the browser's own SpeechRecognition, and whether to
    expect synthesized audio back (see App.jsx's `sttAvailable`/
    `ttsAvailable` state, set from this response)."""
    service = await asyncio.to_thread(get_voice_service)
    return VoiceStatusResponse(stt_available=service.stt_available, tts_available=service.tts_available)


@router.post("/converse", response_model=VoiceConverseResponse)
async def voice_converse(
    audio: UploadFile | None = File(default=None),
    transcript: str | None = Form(default=None),
    history_json: str = Form(default="[]"),
    patient_id: str | None = Form(default=None),
    language: str | None = Form(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> VoiceConverseResponse:
    """
    One voice turn. Matches frontend/src/api.js's voiceConverse(), which
    sends a multipart form with either:
      - `audio`: a recorded blob, transcribed here via faster-whisper if the
        server has it configured, or
      - `transcript`: text already transcribed by the browser's own
        SpeechRecognition (used when server-side STT isn't available).
    `history_json` is the same recentHistoryPayload() shape the text /chat
    endpoint uses, JSON-encoded because multipart/form-data can't carry
    structured fields directly.
    `language` is the frontend's currently-selected UI language code
    (e.g. "hi", "ta" - see i18n.js's SUPPORTED_LANGUAGES). BUG FIX: this
    field didn't exist before, so server-side STT always forced English
    decoding (see voice_service.transcribe) and the LLM was never told
    which language to reply in for voice turns - both are fixed below.

    The transcribed/given text is routed through the same
    services.agent_service.run_turn() the text chat endpoint uses (the
    real multi-agent LangGraph orchestrator, falling back to
    conversation_agent.get_agent_reply() if that raises), then, if a
    Piper voice is configured, synthesized back to audio.
    """
    try:
        raw_history = json.loads(history_json) if history_json else []
    except json.JSONDecodeError:
        LOGGER.warning("Ignoring malformed history_json in /voice/converse request")
        raw_history = []
    history = [ChatHistoryItem(**item) for item in raw_history if isinstance(item, dict)]

    service = await asyncio.to_thread(get_voice_service)

    text = (transcript or "").strip()

    if not text and audio is not None:
        text = await _transcribe_upload(service, audio, language=language)

    if not text:
        raise EmptyTranscriptError()

    # BUG FIX: this used to call run_turn() with no `profile` at all, so
    # voice replies never got the "Language Directive" that text /chat
    # sends (see agents/nodes.py's _build_agent_messages) and always came
    # back in English even when the browser-side transcript/audio was in
    # another language.
    profile = HealthProfile(language_preference=language) if language else None

    result = await agent_service.run_turn(
        session=session, message=text, patient_id=patient_id, history=history, profile=profile
    )

    audio_base64: str | None = None
    if service.tts_available:
        wav_bytes = await asyncio.to_thread(service.synthesize_wav, result.reply)
        if wav_bytes:
            audio_base64 = base64.b64encode(wav_bytes).decode("ascii")

    return VoiceConverseResponse(
        transcript=text,
        agent=result.agent,
        reply=result.reply,
        urgent=result.urgent,
        audio_base64=audio_base64,
        audio_format="wav",
        tts_available=service.tts_available,
        stt_available=service.stt_available,
    )


async def _transcribe_upload(service, audio: UploadFile, language: str | None = None) -> str:
    """Writes the uploaded audio blob to a temp file (faster-whisper's
    transcribe() takes a path) and runs STT off the event loop."""
    suffix = Path(audio.filename or "utterance.webm").suffix or ".webm"
    audio_bytes = await audio.read()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_file:
        tmp_file.write(audio_bytes)
        tmp_path = Path(tmp_file.name)

    try:
        result = await asyncio.to_thread(service.transcribe, tmp_path, language)
        return (result or "").strip()
    finally:
        tmp_path.unlink(missing_ok=True)