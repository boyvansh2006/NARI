const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function handleJson(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore - not JSON */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

/** Text chat -> the real multi-agent LangGraph orchestrator (Emergency
 * check -> Router -> Clinical Knowledge/RAG -> specialist agent -> Risk
 * Prediction -> Care Plan -> Follow-up; see backend/app/agents/graph.py),
 * using whichever LLM provider is configured server-side (Gemini/OpenAI/
 * Groq, or an offline deterministic mock if none is set). Falls back to
 * NARI's older single-call router if the graph itself fails. Pass
 * `patientId` once real accounts exist to enable longitudinal risk
 * signals (see backend/app/services/dht_service.py); safe to omit. */
export async function sendChatMessage(message, history = [], profile = null, patientId = null) {
  const res = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, profile, patient_id: patientId }),
  });
  return handleJson(res); // { agent, reply, urgent, evidence, risk_signal, care_plan, follow_up, router_reason }
}

/** Voice-to-voice round trip. Pass either `audioBlob` (recorded audio -
 * used if the server has faster-whisper configured) or `transcript`
 * (already-transcribed text, e.g. from the browser's own
 * SpeechRecognition, used as a fallback / when no audio is given). */
export async function voiceConverse({ audioBlob, transcript, history = [] }) {
  const form = new FormData();
  if (audioBlob) form.append("audio", audioBlob, "utterance.webm");
  if (transcript) form.append("transcript", transcript);
  form.append("history_json", JSON.stringify(history));

  const res = await fetch(`${API_BASE}/api/v1/voice/converse`, {
    method: "POST",
    body: form,
  });
  return handleJson(res); // { transcript, agent, reply, urgent, audio_base64, tts_available, stt_available }
}

export async function getVoiceStatus() {
  const res = await fetch(`${API_BASE}/api/v1/voice/status`);
  return handleJson(res); // { stt_available, tts_available }
}

/** Report upload -> Vitalis's OCR + PDF/image parsing pipeline. */
export async function uploadReport(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/reports/upload`, {
    method: "POST",
    body: form,
  });
  return handleJson(res); // { message, report: { id, original_filename, uploaded_at, report_json, ... } }
}

export async function listReports(page = 1, pageSize = 20) {
  const res = await fetch(`${API_BASE}/api/v1/reports?page=${page}&page_size=${pageSize}`);
  return handleJson(res); // { items, pagination }
}

export async function deleteReport(reportId) {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}`, { method: "DELETE" });
  return handleJson(res);
}