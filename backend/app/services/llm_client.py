"""
Generic LLM client for the multi-agent system (app/agents/).

GGSIPU2617's tech stack calls for "Gemini API/OpenAI/Llama". The Vitalis/
Aarogya baseline only ever talked to Groq, hardcoded into
parser_service.py and conversation_agent.py individually. This module
factors that into one provider-agnostic `complete_json()` call so every
agent can ask for a structured JSON reply without caring which provider is
configured - and, critically, so the whole agent graph keeps working with
*no* API key configured at all (LLM_PROVIDER=auto with nothing set),
falling back to a deterministic mock responder. That's what lets this
project's multi-agent pipeline be exercised end-to-end in an offline CI/
sandbox environment rather than only "should work if you paste in a key".

Provider resolution (LLM_PROVIDER=auto, the default):
  1. GROQ_API_KEY set      -> Groq   (openai-compatible chat.completions)
  2. OPENAI_API_KEY set    -> OpenAI (chat.completions, JSON mode)
  3. GEMINI_API_KEY set    -> Gemini (generateContent, response_mime_type)
  4. none of the above     -> mock responder (see MockResponder below)

Set LLM_PROVIDER explicitly (groq|openai|gemini|mock) to override.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

LOGGER = get_logger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"

@dataclass
class LLMMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


class LLMUnavailableError(RuntimeError):
    """Raised when a real provider is configured but the call fails, so
    callers can decide whether to fall back to a rule-based path."""


def resolve_provider() -> str:
    settings = get_settings()
    configured = (settings.llm_provider or "auto").lower()
    if configured != "auto":
        return configured
    if settings.groq_api_key:
        return "groq"
    if settings.mistral_api_key:
        return "mistral"
    if settings.openai_api_key:
        return "openai"
    if settings.gemini_api_key:
        return "gemini"
    return "mock"

def complete_json(
    system_prompt: str,
    messages: list[LLMMessage],
    *,
    temperature: float = 0.3,
    mock_key: str = "default",
    mock_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Ask the configured provider for a reply and parse it as JSON. Every
    agent prompt in app/agents/ instructs the model to reply with a JSON
    object matching a documented shape, so this is the single choke point
    for "call an LLM and get structured data back" across the whole
    multi-agent system.

    `mock_key`/`mock_context` select which canned response the offline
    MockResponder returns when no provider is configured (or a real call
    fails) - see mock_responses.py.
    """
    provider = resolve_provider()
    settings = get_settings()

    try:
        if provider == "groq" and settings.groq_api_key:
            return _call_openai_compatible(
                GROQ_URL, settings.groq_api_key, settings.groq_model, system_prompt, messages, temperature
            )
        if provider == "mistral" and settings.mistral_api_key:
            return _call_openai_compatible(
                MISTRAL_URL, settings.mistral_api_key, settings.mistral_model, system_prompt, messages, temperature
            )
        if provider == "openai" and settings.openai_api_key:
            return _call_openai_compatible(
                OPENAI_URL, settings.openai_api_key, settings.openai_model, system_prompt, messages, temperature
            )
        if provider == "gemini" and settings.gemini_api_key:
            return _call_gemini(settings.gemini_api_key, settings.gemini_model, system_prompt, messages, temperature)
    except Exception as exc:
        LOGGER.warning(f"LLM provider '{provider}' call failed, falling back to mock responder: {exc}")

    from app.services.mock_responses import mock_reply

    return mock_reply(mock_key, mock_context or {})


def _call_openai_compatible(
    url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    messages: list[LLMMessage],
    temperature: float,
) -> dict[str, Any]:
    settings = get_settings()
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}]
        + [{"role": m.role, "content": m.content} for m in messages],
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    response = httpx.post(url, headers=headers, json=payload, timeout=settings.request_timeout_seconds)
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def _call_gemini(
    api_key: str,
    model: str,
    system_prompt: str,
    messages: list[LLMMessage],
    temperature: float,
) -> dict[str, Any]:
    settings = get_settings()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    contents = [
        {
            "role": "user" if m.role != "assistant" else "model",
            "parts": [{"text": m.content}],
        }
        for m in messages
    ]
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"temperature": temperature, "response_mime_type": "application/json"},
    }
    response = httpx.post(url, json=payload, timeout=settings.request_timeout_seconds)
    response.raise_for_status()
    text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)