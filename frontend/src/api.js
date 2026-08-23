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

/** Voice converse round trip */
export async function voiceConverse({ audioBlob, transcript, history = [] }) {
  const form = new FormData();
  if (audioBlob) form.append("audio", audioBlob, "utterance.webm");
  if (transcript) form.append("transcript", transcript);
  form.append("history_json", JSON.stringify(history));

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