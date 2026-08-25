const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "nari_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

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

/** Text chat -> LangGraph multi-agent orchestrator */
export async function sendChatMessage(message, history = [], profile = null, patientId = null) {
  const res = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ message, history, profile, patient_id: patientId }),
  });
  return handleJson(res);
}

// BUG FIX: the recorded filename was always hard-coded to "utterance.webm"
// regardless of what container the browser's MediaRecorder actually
// produced. Chrome/Firefox do record webm, but Safari/iOS's MediaRecorder
// doesn't support audio/webm at all and silently records audio/mp4
// instead (see App.jsx's toggleListening, which already reads back
// recorder.mimeType correctly onto the Blob - this just wasn't being used
// here). Uploading mp4 bytes under a ".webm" name misleads the backend's
// extension-based temp file (see api/voice.py's _transcribe_upload),
// which is a real "the platform doesn't understand what I say" cause on
// Safari/iOS specifically. Derive the extension from the Blob's actual type.
function _audioFilename(blob) {
  const type = (blob && blob.type) || "";
  if (type.includes("mp4")) return "utterance.mp4";
  if (type.includes("ogg")) return "utterance.ogg";
  if (type.includes("wav")) return "utterance.wav";
  return "utterance.webm";
}

/** Voice converse round trip */
export async function voiceConverse({ audioBlob, transcript, history = [], language = null }) {
  const form = new FormData();
  if (audioBlob) form.append("audio", audioBlob, _audioFilename(audioBlob));
  if (transcript) form.append("transcript", transcript);
  form.append("history_json", JSON.stringify(history));
  // BUG FIX: language was never sent, so the backend always force-decoded
  // speech as English (see api/voice.py) and never told the LLM which
  // language to reply in for voice turns.
  if (language) form.append("language", language);

  const res = await fetch(`${API_BASE}/api/v1/voice/converse`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return handleJson(res);
}

export async function getVoiceStatus() {
  const res = await fetch(`${API_BASE}/api/v1/voice/status`);
  return handleJson(res);
}

/** Report upload & management (with user isolation) */
export async function uploadReport(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/reports/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return handleJson(res);
}

export async function listReports(page = 1, pageSize = 20) {
  const res = await fetch(`${API_BASE}/api/v1/reports?page=${page}&page_size=${pageSize}`, {
    headers: authHeaders(),
  });
  return handleJson(res);
}

export async function getReport(reportId) {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}`, {
    headers: authHeaders(),
  });
  return handleJson(res);
}

export async function deleteReport(reportId) {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleJson(res);
}

/** Auth endpoints */
export async function registerUser(email, password, fullName) {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  return handleJson(res);
}

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleJson(res);
}

/** Medication reminders (requires auth) */
export async function fetchReminders() {
  const res = await fetch(`${API_BASE}/api/v1/reminders`, { headers: authHeaders() });
  return handleJson(res);
}

export async function createReminderApi(data) {
  const res = await fetch(`${API_BASE}/api/v1/reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleJson(res);
}

export async function toggleReminderApi(id) {
  const res = await fetch(`${API_BASE}/api/v1/reminders/${id}/toggle`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJson(res);
}

export async function deleteReminderApi(id) {
  const res = await fetch(`${API_BASE}/api/v1/reminders/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleJson(res);
}

/** Daily activity tracker (requires auth) */
export async function getTodayActivity() {
  const res = await fetch(`${API_BASE}/api/v1/activity/today`, { headers: authHeaders() });
  return handleJson(res);
}

export async function updateTodayActivity(patch) {
  const res = await fetch(`${API_BASE}/api/v1/activity/today`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  return handleJson(res);
}

export async function getActivityHistory(days = 7) {
  const res = await fetch(`${API_BASE}/api/v1/activity/history?days=${days}`, { headers: authHeaders() });
  return handleJson(res);
}

/** Google Fit integration */
export async function getGoogleFitAuthUrl() {
  const res = await fetch(`${API_BASE}/api/v1/googlefit/auth-url`, { headers: authHeaders() });
  return handleJson(res); // { auth_url }
}

export async function getGoogleFitStatus() {
  const res = await fetch(`${API_BASE}/api/v1/googlefit/status`, { headers: authHeaders() });
  return handleJson(res); // { connected }
}

export async function syncGoogleFit() {
  const res = await fetch(`${API_BASE}/api/v1/googlefit/sync`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJson(res); // DailyActivityLog
}

/** Secure Menstrual Cycle & Period Tracking */
export async function fetchCycles() {
  const res = await fetch(`${API_BASE}/api/v1/cycles`, { headers: authHeaders() });
  return handleJson(res);
}

export async function logCycle(data) {
  const res = await fetch(`${API_BASE}/api/v1/cycles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleJson(res);
}

export async function updateCycle(cycleId, patch) {
  const res = await fetch(`${API_BASE}/api/v1/cycles/${cycleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  return handleJson(res);
}

export async function deleteCycle(cycleId) {
  const res = await fetch(`${API_BASE}/api/v1/cycles/${cycleId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (res.status === 204) return true;
  return handleJson(res);
}

export async function getCycleAnalytics() {
  const res = await fetch(`${API_BASE}/api/v1/cycles/analytics`, { headers: authHeaders() });
  return handleJson(res);
}