"""
Lab report / document intelligence pipeline.

This implements the PDF-text-extraction -> OCR-fallback -> LLM-structuring flow:
  1. Accepts "image/*,.pdf" (a phone photo of a report, scanned PDF, or digital PDF).
  2. Uses PyTesseract with local tessdata fallback for OCR on image documents.
  3. Uses PdfReader / pdfplumber for native PDF text & positioned table extraction.
  4. Parses extracted biomarkers using Gemini / Groq / OpenAI LLM structuring or local regex fallback.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Literal

import httpx
import pdfplumber
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

METRIC_LINE_PATTERN = re.compile(
    r"^\s*(?P<name>[A-Za-z][A-Za-z0-9 ()/._%+-]{1,80}?)\s*(?:[:=]|\s+)\s*"
    r"(?P<value>[<>≤≥]?\s*\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|"
    r"(?:negative|positive|reactive|non[- ]?reactive))"
    r"(?:\s+(?P<unit>[A-Za-zµμ/%^0-9.×x*/-]{1,24}))?\s*(?P<tail>.*)$",
    re.IGNORECASE,
)
REFERENCE_RANGE_PATTERN = re.compile(
    r"(?:ref(?:erence)?\s*(?:range)?\s*[:=]?)?\s*(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)",
    re.IGNORECASE,
)
FLAG_PATTERN = re.compile(r"\b(high|low|normal|h|l|n)\b", re.IGNORECASE)
NON_METRIC_LABELS = {
    "test", "test name", "investigation", "result", "results", "parameter",
    "units", "reference range", "bio reference range"
}
NUMERIC_RESULT_PATTERN = re.compile(r"^[<>≤≥]?\s*\d+(?:[.,]\d+)?$")


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
    reference_range: str | None = Field(
        default=None,
        description="The reference interval printed on the report, when available.",
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


def _configure_tesseract():
    settings = get_settings()
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    # Ensure TESSDATA_PREFIX points to valid traineddata directory
    local_tessdata = Path(__file__).resolve().parents[2] / "tessdata"
    if local_tessdata.exists() and (local_tessdata / "eng.traineddata").exists():
        os.environ["TESSDATA_PREFIX"] = str(local_tessdata)


def extract_document_text(file_path: str | Path, kind: DocumentKind) -> str:
    path = Path(file_path)
    _configure_tesseract()

    if kind == "image":
        try:
            with Image.open(path) as img:
                return pytesseract.image_to_string(img).strip()
        except Exception as exc:
            LOGGER.error(f"OCR failed on image {path.name}: {exc}")
            raise ValueError(f"Failed to run OCR on the uploaded image: {exc}") from exc

    # PDF: try native text layer first, fall back to OCR for scanned PDFs
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
        settings = get_settings()
        images = convert_from_bytes(file_bytes, dpi=200, poppler_path=settings.poppler_path or None)
        for i, image in enumerate(images):
            page_text = pytesseract.image_to_string(image)
            if page_text.strip():
                ocr_pages.append(f"--- Page {i + 1} ---\n{page_text.strip()}")
    except Exception as exc:
        LOGGER.error(f"OCR execution error while processing {path.name}: {exc}")
        raise ValueError(f"Failed to process scanned document text layers: {exc}") from exc

    return "\n\n".join(ocr_pages).strip()


def _group_words_by_line(words: list[dict[str, Any]], tolerance: float = 3.0) -> list[list[dict[str, Any]]]:
    lines: list[list[dict[str, Any]]] = []
    for word in sorted(words, key=lambda item: (float(item["top"]), float(item["x0"]))):
        if not lines or abs(float(lines[-1][0]["top"]) - float(word["top"])) > tolerance:
            lines.append([word])
        else:
            lines[-1].append(word)
    return lines


def _joined(words: list[dict[str, Any]]) -> str:
    return " ".join(word["text"] for word in sorted(words, key=lambda item: float(item["x0"]))).strip()


def _table_layout(lines: list[list[dict[str, Any]]]) -> tuple[float, float, float, float] | None:
    for line in lines:
        labels = [(word["text"].lower().strip(".:"), float(word["x0"]), float(word["top"])) for word in line]
        result = next((item for item in labels if item[0].startswith("result")), None)
        unit = next((item for item in labels if item[0].startswith("unit")), None)
        reference = next((item for item in labels if item[0].startswith(("bio", "ref", "reference"))), None)
        if result and unit and reference and result[1] < unit[1] < reference[1]:
            return result[1], unit[1], reference[1], result[2]
    return None


def extract_pdf_table_metrics(file_path: str | Path) -> list[dict[str, Any]]:
    metrics: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str | None]] = set()
    active_layout: tuple[float, float, float] | None = None

    try:
        with pdfplumber.open(str(file_path)) as pdf:
            for page in pdf.pages:
                lines = _group_words_by_line(page.extract_words())
                discovered = _table_layout(lines)
                header_top: float | None = None
                if discovered:
                    result_x, unit_x, reference_x, header_top = discovered
                    active_layout = (result_x, unit_x, reference_x)
                if not active_layout:
                    continue

                result_x, unit_x, reference_x = active_layout
                for line in lines:
                    line_top = float(line[0]["top"])
                    if header_top is not None and line_top <= header_top + 8:
                        continue
                    result_words = [
                        word for word in line
                        if result_x - 18 <= float(word["x0"]) < unit_x - 10
                        and NUMERIC_RESULT_PATTERN.fullmatch(word["text"].strip())
                    ]
                    if not result_words:
                        continue

                    name = _joined([word for word in line if float(word["x0"]) < result_x - 18]).strip(" .:-")
                    if (
                        not name
                        or len(name) > 72
                        or len(name.split()) > 8
                        or name.lower() in NON_METRIC_LABELS
                        or name.lower().startswith(("page ", "report status", "test report"))
                    ):
                        continue

                    value = _joined(result_words)
                    unit = _joined([word for word in line if unit_x - 12 <= float(word["x0"]) < reference_x - 8]) or None
                    reference_range = _joined([word for word in line if float(word["x0"]) >= reference_x - 8]) or None
                    key = (name.lower(), value.lower(), unit.lower() if unit else None)
                    if key in seen:
                        continue
                    seen.add(key)
                    metrics.append({
                        "biomarker_name": name,
                        "extracted_abbreviation": None,
                        "value": value,
                        "unit": unit,
                        "reference_range": reference_range,
                        "status": _status_from_tail(value, reference_range or ""),
                    })
    except Exception as exc:
        LOGGER.warning("Could not extract positioned PDF table", extra={"error": str(exc)})
    return metrics


def _decimal(value: str) -> Decimal | None:
    try:
        return Decimal(value.replace(",", ".").replace("≤", "").replace("≥", "").replace("<", "").replace(">", "").strip())
    except (InvalidOperation, AttributeError):
        return None


def _status_from_tail(value: str, tail: str) -> str:
    flag = FLAG_PATTERN.search(tail)
    if flag:
        return {"high": "HIGH", "h": "HIGH", "low": "LOW", "l": "LOW", "normal": "NORMAL", "n": "NORMAL"}[flag.group(1).lower()]

    value_number = _decimal(value.split("-")[0])
    range_match = REFERENCE_RANGE_PATTERN.search(tail)
    if value_number is not None and range_match:
        low, high = _decimal(range_match.group(1)), _decimal(range_match.group(2))
        if low is not None and high is not None:
            if value_number < low:
                return "LOW"
            if value_number > high:
                return "HIGH"
            return "NORMAL"
    return "UNSPECIFIED"


def extract_metrics_locally(report_text: str) -> list[dict[str, Any]]:
    metrics: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str | None]] = set()
    for raw_line in report_text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip(" |")
        match = METRIC_LINE_PATTERN.match(line)
        if not match:
            continue
        name = re.sub(r"\s+", " ", match.group("name")).strip(" .:-")
        if name.lower() in NON_METRIC_LABELS or len(name) < 2:
            continue
        value = re.sub(r"\s+", " ", match.group("value")).strip()
        unit = (match.group("unit") or "").strip() or None
        tail = match.group("tail") or ""
        if unit and re.fullmatch(r"\d+(?:[.,]\d+)?", unit):
            tail = f"{unit} {tail}".strip()
            unit = None
        key = (name.lower(), value.lower(), unit.lower() if unit else None)
        if key in seen:
            continue
        seen.add(key)
        metrics.append(
            {
                "biomarker_name": name,
                "extracted_abbreviation": None,
                "value": value,
                "unit": unit,
                "reference_range": tail or None,
                "status": _status_from_tail(value, tail),
            }
        )
    return metrics


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

    # Prefer the report's visual table structure when it exists for digital PDFs
    if kind == "pdf":
        table_metrics = extract_pdf_table_metrics(path)
        if table_metrics:
            LOGGER.info("Extracted structured metrics from positioned PDF table", extra={"metrics_found": len(table_metrics)})
            return LabReportExtractionSchema(patient_demographics_found=False, metrics=table_metrics)

    if settings.groq_api_key:
        content = call_groq(
            report_text, settings.groq_api_key, settings.groq_model, timeout=settings.request_timeout_seconds
        )
        return LabReportExtractionSchema.model_validate(normalize_groq_output(content))

    # If Gemini is configured in .env, use complete_json
    from app.services.llm_client import LLMMessage, complete_json
    if settings.gemini_api_key or settings.openai_api_key:
        try:
            prompt = (
                "You are an expert clinical data parsing engine for women's health lab reports.\n"
                "Extract every medical test, biomarker, and health metric present in the document text.\n"
                'Return strictly as JSON matching this schema: {"patient_demographics_found": boolean, '
                '"metrics": [{"biomarker_name": string, "extracted_abbreviation": string|null, '
                '"value": string, "unit": string|null, "status": "NORMAL"|"HIGH"|"LOW"|"UNSPECIFIED"}]}'
            )
            raw = complete_json(prompt, [LLMMessage("user", f"Document text:\n{report_text}")])
            if raw and "metrics" in raw and isinstance(raw["metrics"], list) and len(raw["metrics"]) > 0:
                return LabReportExtractionSchema.model_validate(normalize_groq_output(json.dumps(raw)))
        except Exception as exc:
            LOGGER.warning(f"LLM extraction fallback to local regex: {exc}")

    metrics = extract_metrics_locally(report_text)
    LOGGER.info("Used local structured lab extraction", extra={"metrics_found": len(metrics)})
    return LabReportExtractionSchema(
        patient_demographics_found=False,
        metrics=metrics,
    )
