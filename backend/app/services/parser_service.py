"""
Lab report / document intelligence pipeline.

This is Vitalis's (IBMIE) parser_service.py, reused near-verbatim for the
PDF-text-extraction -> OCR-fallback -> LLM-structuring flow, with two
changes for NARI:

  1. NARI's report dropzone accepts "image/*,.pdf" (a phone photo of a
     report, not just a scanned PDF) - extract_document_text() now branches
     on document kind instead of assuming PDF.
  2. If no GROQ_API_KEY is configured, parse_medical_document() no longer
     raises - it degrades to returning the raw OCR/extracted text as a
     single unstructured metric, so the upload pipeline still works
     end-to-end for local/offline development (mirrors MAITRI's "degrade
     gracefully, warn loudly" philosophy rather than the original's hard
     failure on a missing key).
"""
from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any, Literal

import httpx
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes
from pydantic import BaseModel, Field, field_validator
from pypdf import PdfReader

from app.core.config import get_settings
from app.core.exceptions import ParserServiceError
from app.core.logging import get_logger

LOGGER = get_logger(__name__)
GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are an advanced clinical data extraction engine specialized in women's "
    "health lab reports. Your job is to extract all health biomarkers, lab tests, "
    "and patient parameters from the provided text into a structured JSON format. "
    "Never drop metrics, values, or units. Return valid JSON matching the schema "
    "properties exactly."
)

DocumentKind = Literal["pdf", "image"]


class MedicalMetric(BaseModel):
    biomarker_name: str = Field(
        description="The standardized name of the test or metric (e.g., Hemoglobin, Ferritin, TSH)."
    )
    extracted_abbreviation: str | None = Field(
        default=None,
        description="The abbreviation as it appeared in the report, if any (e.g., Hb, Hgb, TSH).",
    )
    value: str = Field(
        description="The exact numerical or qualitative value recorded (e.g., 14.2, Negative, 5.5)."
    )
    unit: str | None = Field(
        default=None,
        description="The measurement unit associated with the value (e.g., g/dL, mIU/L, ng/mL).",
    )
    status: Literal["NORMAL", "HIGH", "LOW", "UNSPECIFIED"] = Field(
        description="The clinical status flag relative to standard reference ranges."
    )

    @field_validator("value", mode="before")
    @classmethod
    def coerce_value_to_string(cls, v: Any) -> str:
        if isinstance(v, (int, float)):
            return str(v)
        return str(v) if v is not None else ""


class LabReportExtractionSchema(BaseModel):
    patient_demographics_found: bool = Field(
        description="True if patient name or metadata is explicitly present on the document."
    )
    metrics: list[MedicalMetric] = Field(
        description="A comprehensive array containing all medical biomarkers extracted from the report."
    )


class ParserService:
    async def parse_document(
        self, file_path: Path, kind: DocumentKind = "pdf"
    ) -> LabReportExtractionSchema:
        return await asyncio.to_thread(self._parse_sync, file_path, kind)

    def _parse_sync(self, file_path: Path, kind: DocumentKind) -> LabReportExtractionSchema:
        try:
            return parse_medical_document(file_path, kind)
        except Exception as exc:
            raise ParserServiceError(str(exc)) from exc


def extract_document_text(file_path: str | Path, kind: DocumentKind) -> str:
    path = Path(file_path)

    if kind == "image":
        try:
            with Image.open(path) as img:
                return pytesseract.image_to_string(img).strip()
        except Exception as exc:
            LOGGER.error(f"OCR failed on image {path.name}: {exc}")
            raise ValueError("Failed to run OCR on the uploaded image.") from exc

    # PDF: try native text layer first, fall back to OCR for scanned PDFs -
    # unchanged from Vitalis's extract_pdf_text().
    reader = PdfReader(str(path))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages.append(text.strip())
    native_text = "\n\n".join(pages).strip()

    if len(native_text) > 50:
        return native_text

    LOGGER.info(
        f"Native extraction returned insufficient text ({len(native_text)} chars). "
        "Falling back to OCR processing."
    )
    ocr_pages: list[str] = []
    try:
        file_bytes = path.read_bytes()
        images = convert_from_bytes(file_bytes, dpi=150)
        for i, image in enumerate(images):
            page_text = pytesseract.image_to_string(image)
            if page_text.strip():
                ocr_pages.append(f"--- Page {i + 1} ---\n{page_text.strip()}")
    except Exception as exc:
        LOGGER.error(f"OCR execution error while processing {path.name}: {exc}")
        raise ValueError("Failed to process scanned document text layers.") from exc

    return "\n\n".join(ocr_pages).strip()


def build_extraction_prompt(report_text: str) -> str:
    return (
        "You are an expert clinical data parsing engine for women's health lab reports.\n"
        "Extract every medical test, biomarker, and health metric present in the document text.\n\n"
        "Strict Formatting Rules:\n"
        "- Return a root JSON object with two keys: 'patient_demographics_found' (boolean) and "
        "'metrics' (array of objects).\n"
        "- Each object inside 'metrics' MUST have exactly these keys: 'biomarker_name', "
        "'extracted_abbreviation', 'value', 'unit', and 'status'.\n"
        "- 'status' must be exactly one of: 'NORMAL', 'HIGH', 'LOW', or 'UNSPECIFIED'.\n"
        "- Pay particular attention to biomarkers relevant to women's health: Hemoglobin, Ferritin, "
        "TSH/T3/T4, Vitamin D, Vitamin B12, FSH, LH, AMH, Prolactin, Estradiol, Progesterone, "
        "Testosterone, HbA1c, and Fasting Glucose.\n"
        "- Ensure absolutely no biomarkers or numerical results are missing from the output list.\n\n"
        f"Document text:\n{report_text}"
    )


def call_groq(report_text: str, api_key: str, model: str, timeout: float = 120.0) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_extraction_prompt(report_text)},
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    response = httpx.post(GROQ_CHAT_COMPLETIONS_URL, headers=headers, json=payload, timeout=timeout)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"Groq API error {response.status_code}: {response.text}") from exc

    return str(response.json()["choices"][0]["message"]["content"])


def normalize_groq_output(content: str) -> dict[str, Any]:
    """Unchanged from Vitalis - tolerates a couple of different shapes the
    LLM might return and normalizes them into our schema."""
    raw = json.loads(content)

    if isinstance(raw, dict) and "metrics" in raw and isinstance(raw["metrics"], list):
        for metric in raw["metrics"]:
            if isinstance(metric, dict):
                if "value" in metric and metric["value"] is not None:
                    metric["value"] = str(metric["value"])
                status = str(metric.get("status", "UNSPECIFIED")).upper()
                metric["status"] = status if status in {"NORMAL", "HIGH", "LOW", "UNSPECIFIED"} else "UNSPECIFIED"
        return {
            "patient_demographics_found": bool(raw.get("patient_demographics_found", False)),
            "metrics": raw["metrics"],
        }

    test_items = raw.get("tests") or raw.get("results") or []
    if not isinstance(test_items, list) and isinstance(raw, list):
        test_items = raw
    elif not isinstance(test_items, list):
        test_items = []

    metrics: list[dict[str, Any]] = []
    for item in test_items:
        if not isinstance(item, dict):
            continue
        test_name = str(item.get("biomarker_name") or item.get("name") or item.get("test") or "").strip()
        if not test_name:
            continue
        abbreviation = item.get("extracted_abbreviation") or item.get("abbreviation")
        match = re.match(r"^(.*)\(([^)]+)\)\s*$", test_name)
        if match:
            test_name = match.group(1).strip()
            abbreviation = match.group(2).strip() or None
        status = str(item.get("status") or "UNSPECIFIED").upper()
        if status not in {"NORMAL", "HIGH", "LOW", "UNSPECIFIED"}:
            status = "UNSPECIFIED"
        extracted_value = item.get("value") if item.get("value") is not None else item.get("result", "")
        metrics.append(
            {
                "biomarker_name": test_name,
                "extracted_abbreviation": abbreviation,
                "value": str(extracted_value),
                "unit": item.get("unit"),
                "status": status,
            }
        )

    return {
        "patient_demographics_found": bool(raw.get("patient_demographics_found", False) or raw.get("patient")),
        "metrics": metrics,
    }


def parse_medical_document(file_path: str | Path, kind: DocumentKind) -> LabReportExtractionSchema:
    settings = get_settings()
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    report_text = extract_document_text(path, kind)
    if not report_text:
        raise ValueError("No readable text was extracted from the document")

    if not settings.groq_api_key:
        # Graceful degradation: no LLM key configured, so skip structuring
        # and surface the raw OCR/text-layer output as a single metric
        # instead of failing the whole upload.
        LOGGER.warning("GROQ_API_KEY not set - returning raw extracted text without structuring")
        return LabReportExtractionSchema(
            patient_demographics_found=False,
            metrics=[
                {
                    "biomarker_name": "Raw extracted text (set GROQ_API_KEY for structured extraction)",
                    "extracted_abbreviation": None,
                    "value": report_text[:1500],
                    "unit": None,
                    "status": "UNSPECIFIED",
                }
            ],
        )

    content = call_groq(
        report_text, settings.groq_api_key, settings.groq_model, timeout=settings.request_timeout_seconds
    )
    return LabReportExtractionSchema.model_validate(normalize_groq_output(content))