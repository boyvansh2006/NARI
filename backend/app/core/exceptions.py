from __future__ import annotations


class NARIError(Exception):
    status_code = 500
    default_detail = "An unexpected error occurred"

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.default_detail
        super().__init__(self.detail)


AarogyaError = NARIError


class InvalidDocumentError(NARIError):
    status_code = 400
    default_detail = "The uploaded file is not a supported PDF or image"


class ParserServiceError(NARIError):
    status_code = 502
    default_detail = "Parser service failed to process the document"


class ReportNotFoundError(NARIError):
    status_code = 404
    default_detail = "Report not found"


class DatabaseOperationError(NARIError):
    status_code = 500
    default_detail = "Database operation failed"


class VoiceServiceError(NARIError):
    status_code = 502
    default_detail = "Voice pipeline failed to process the request"


class EmptyTranscriptError(NARIError):
    status_code = 400
    default_detail = "No speech was detected in that recording"