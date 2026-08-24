import React, { useState, useEffect, useRef } from "react";
import {
  Home, MessageCircle, FileText, Bell, Mic, MicOff, Send, Upload,
  Volume2, VolumeX, X, AlertTriangle, CheckCircle2, Activity, Calendar,
  TrendingDown, Droplets, Sparkles, ChevronRight, User, Loader2,
  HeartPulse, Stethoscope, Network, ShieldCheck, ClipboardCheck, BookOpen,
  Users, Brain, Target, Info, LogOut, Pill, UserRound, Copy, Check, RotateCcw
} from "lucide-react";
import { sendChatMessage, voiceConverse, getVoiceStatus, uploadReport, listReports, setToken } from "./api.js";
import LandingPage from "./LandingPage.jsx";
import LoginPage from "./LoginPage.jsx";
import LabReportChart from "./LabReportChart.jsx";
import CycleRing from "./CycleRing.jsx";
import RemindersPage from "./RemindersPage.jsx";
import ActivityTrackerPage from "./ActivityTrackerPage.jsx";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  assistant: "Ask NARI",
  reports: "Reports",
  twin: "Digital Health Twin",
  reminders: "Medicine Reminders",
  activity: "Daily Activity",
  clinician: "Clinician Portal",
};

const AGENT_PIPELINE = [
  { name: "Emergency Escalation", note: "Always-first safety check" },
  { name: "Router", note: "Picks one specialist agent" },
  { name: "Clinical Knowledge / RAG", note: "Grounds the turn in evidence" },
  { name: "Specialist Agent", note: "Symptom, Lab, Nutrition, Mental, …" },
  { name: "Risk Prediction", note: "Transparent pattern heuristic" },
  { name: "Care Plan", note: "Combines reply + risk + evidence" },
  { name: "Follow-up Care", note: "Schedules continuity check-ins" },
];

const DEMO_CYCLE_LENGTHS = [26, 31, 24, 33, 27, 35];
const DEMO_SYMPTOM_TIMELINE = [
  { id: 1, date: "Today", text: "Mild cramps, linked to cycle", tag: "Symptom" },
  { id: 2, date: "Yesterday", text: "Ferritin flagged low on uploaded report", tag: "Lab" },
  { id: 3, date: "3 days ago", text: "Reported acne + irregular cycle in chat", tag: "Symptom" },
  { id: 4, date: "6 days ago", text: "Logged 5.5 hrs sleep, high stress (8/10)", tag: "Lifestyle" },
];
const DEMO_RISK_SIGNALS = [
  {
    domain: "PCOS",
    signal_type: "pattern_flag",
    level: "L2",
    factors: ["Cycle length varied by 11 days across recent logged cycles", "Reported symptom: acne", "Reported symptom: hair thinning"],
    confidence_note: "Rule-based pattern flag, not a validated diagnostic or ML model.",
    next_step: "This combination of irregular cycles and reported symptoms is worth discussing with a gynecologist or endocrinologist.",
    when_to_seek_care: "Sooner if periods stop entirely, or if you notice rapid weight change or worsening symptoms.",
    example: true,
  },
  {
    domain: "Laboratory",
    signal_type: "trend_flag",
    level: "L1",
    factors: ["Ferritin: 9 ng/mL (LOW)"],
    confidence_note: "Rule-based pattern flag, not a validated diagnostic or ML model.",
    next_step: "Share this report with your clinician for interpretation in context of your full history.",
    when_to_seek_care: "Sooner if these values come with symptoms like severe fatigue, dizziness, or bleeding.",
    example: true,
  },
];
const LEVEL_LABEL = { L0: "Info", L1: "Monitor", L2: "Clinical consultation", L3: "Urgent", L4: "Safety stop" };

const DEMO_PATIENTS = [
  { id: "p1", name: "Ananya Sharma", age: 27, concern: "PCOS pattern", level: "L2", adherence: 86, lastActive: "Just now" },
  { id: "p2", name: "Riya Kapoor", age: 24, concern: "Endometriosis - pelvic pain", level: "L2", adherence: 74, lastActive: "2h ago" },
  { id: "p3", name: "Meera Nair", age: 31, concern: "Postpartum recovery", level: "L1", adherence: 91, lastActive: "5h ago" },
  { id: "p4", name: "Sanya Verma", age: 45, concern: "Perimenopause symptoms", level: "L1", adherence: 68, lastActive: "1d ago" },
  { id: "p5", name: "Kavya Iyer", age: 29, concern: "Routine cycle tracking", level: "L0", adherence: 95, lastActive: "2d ago" },
];
const DEMO_PATIENT_DETAIL = {
  p1: {
    riskSignals: DEMO_RISK_SIGNALS,
    carePlan: {
      summary: "Irregular cycles with acne and hair thinning, consistent with a PCOS pattern; ferritin also flagged low on the latest report.",
      next_step: "Refer to gynecology/endocrinology; recommend iron-rich diet plan and a follow-up CBC in 4-6 weeks.",
      evidence: [{ source: "WHO — PCOS management guidance" }, { source: "MoHFW — Anaemia in women of reproductive age" }],
    },
    eventLog: [
      { agent: "Emergency Escalation", note: "No red flag matched", time: "09:14" },
      { agent: "Router", note: "Routed to Risk Prediction", time: "09:14" },
      { agent: "Clinical Knowledge / RAG", note: "2 evidence items retrieved", time: "09:14" },
      { agent: "Risk Prediction", note: "PCOS pattern flag fired at L2", time: "09:14" },
      { agent: "Care Plan", note: "Composed explainable care-plan card", time: "09:15" },
      { agent: "Follow-up Care", note: "Follow-up scheduled in 7 days", time: "09:15" },
    ],
  },
};

const INITIAL_MESSAGES = [
  {
    id: 1,
    sender: "assistant",
    agent: "NARI",
    text: "Hi, I'm your NARI assistant. Ask me about your symptoms, labs, nutrition, or anything else — I'll provide direct, clear, and comprehensive guidance.",
  },
];

const SUGGESTED_PROMPTS = [
  "Explain my last lab flag",
  "What should I eat this week?",
  "I have cramps today",
  "Book a doctor appointment",
];

const INITIAL_NOTIFICATIONS = [];

const DEMO_PROFILE = { full_name: "Ananya", cycle_day: 18, cycle_phase: "Luteal phase" };

// NARI is built for women's health, so the assistant's spoken voice should
// read as female whenever server-side Piper TTS isn't configured and the
// browser's own speechSynthesis is used instead. The previous logic just
// grabbed the first "en" voice the platform reported, which - depending on
// OS/browser voice ordering - often ended up male (e.g. "Microsoft David",
// "Google UK English Male", "Daniel"). SpeechSynthesisVoice doesn't expose
// a real gender field, so this uses known voice names as a heuristic:
// prefer an explicitly female-labelled voice, then a well-known female
// voice by name, then fall back to any English voice that isn't a
// well-known male voice, before finally giving up and letting the browser
// use its own default.
const KNOWN_FEMALE_VOICE_NAMES = [
  "zira", "samantha", "victoria", "karen", "moira", "tessa", "fiona", "susan",
  "google us english", "google uk english female", "kathy", "veena", "lekha",
  "aria", "jenny", "libby", "emma",
];
const KNOWN_MALE_VOICE_NAMES = [
  "david", "mark", "guy", "daniel", "alex", "fred", "google uk english male",
  "james", "ravi", "arthur", "eric", "george",
];

function pickFemaleVoice(voices) {
  const englishVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  const explicitlyFemale = pool.find((v) => /female/i.test(v.name));
  if (explicitlyFemale) return explicitlyFemale;

  const knownFemale = pool.find((v) =>
    KNOWN_FEMALE_VOICE_NAMES.some((name) => v.name.toLowerCase().includes(name))
  );
  if (knownFemale) return knownFemale;

  const notKnownMale = pool.find(
    (v) =>
      !/male/i.test(v.name) &&
      !KNOWN_MALE_VOICE_NAMES.some((name) => v.name.toLowerCase().includes(name))
  );
  return notKnownMale || pool[0] || voices[0] || null;
}

const STATUS_TO_FLAG = { NORMAL: "normal", HIGH: "high", LOW: "low", UNSPECIFIED: "flagged" };

const SESSION_KEY = "nari_session_user";

function deriveReportFlag(metrics) {
  if (!metrics || metrics.length === 0) return "flagged";
  return metrics.some((m) => m.status === "HIGH" || m.status === "LOW") ? "flagged" : "normal";
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Defensive safety net for care-plan text. The symptom/lab/nutrition agents are
 * instructed to always reply in plain markdown, but if a model ever slips and
 * returns a stringified Python-style dict (e.g. "{'gastrointestinal': ['...', '...'],
 * 'gynecological': [...]}") instead of prose, this converts it into clean
 * markdown headers + bullets instead of dumping the raw braces/quotes on screen.
 * Anything that isn't recognizably dict-like is returned unchanged.
 */
function cleanCarePlanText(text) {
  if (!text) return text;
  const trimmed = text.trim();
  const looksLikeStringifiedDict = /^\{[\s\S]*\}$/.test(trimmed) && /'[^']+'\s*:\s*\[/.test(trimmed);
  if (!looksLikeStringifiedDict) return text;

  try {
    // Normalize Python-dict syntax (single quotes) into JSON so it can be parsed safely.
    const asJson = trimmed
      .replace(/'/g, '"')
      .replace(/"(s|d)"/g, "'$1'"); // guard against breaking contractions like it's/don't (rare in this content)
    const parsed = JSON.parse(asJson);
    const titleCase = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const lines = [];
    Object.entries(parsed).forEach(([section, items]) => {
      lines.push(`## ${titleCase(section)}`);
      (Array.isArray(items) ? items : [items]).forEach((item) => lines.push(`- ${item}`));
    });
    return lines.join("\n");
  } catch {
    // If parsing fails for any reason, fall back to the original text rather than erroring.
    return text;
  }
}

/** Formats structured assistant text (markdown headers, bolding, bullet points) cleanly. */
function FormattedMessage({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="chat-bullet-list">
          {currentList.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const renderInline = (str) => {
    const parts = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;
    let keyIdx = 0;
    while ((match = boldRegex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index));
      }
      parts.push(<strong key={`b-${keyIdx++}`}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < str.length) {
      parts.push(str.slice(lastIndex));
    }
    return parts.length > 0 ? parts : str;
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }

    if (line.startsWith("### ") || line.startsWith("## ")) {
      flushList();
      const title = line.replace(/^#{2,3}\s+/, "");
      elements.push(
        <h4 key={`h-${idx}`} className="chat-section-header">
          {renderInline(title)}
        </h4>
      );
    } else if (line.startsWith("* ") || line.startsWith("- ") || line.startsWith("• ")) {
      const itemText = line.replace(/^[\*\-•]\s+/, "");
      currentList.push(itemText);
    } else {
      flushList();
      elements.push(
        <p key={`p-${idx}`} className="chat-paragraph">
          {renderInline(line)}
        </p>
      );
    }
  });

  flushList();
  return <div className="chat-formatted-body">{elements}</div>;
}

function GuestNameGate({ value, onChange, onConfirm, onCancel }) {
  return (
    <div className="guest-gate-shell">
      <style>{`
        .guest-gate-shell{
          min-height:100vh; display:flex; align-items:center; justify-content:center;
          background:linear-gradient(160deg,#34205F 0%,#694CD0 65%,#E1C3FF 130%);
          font-family:'DM Sans',-apple-system,sans-serif; padding:24px;
        }
        /* box-sizing:border-box was missing here, so width:100% + padding on
           .guest-gate-input pushed it past the card's edge while the
           buttons below (padding:14px 0, no horizontal padding) stayed
           flush — that's what read as "off-center" / boundary overflow. */
        .guest-gate-shell *{ box-sizing:border-box; }
        .guest-gate-card{
          background:#fff; border-radius:20px; padding:36px 34px; width:100%; max-width:380px;
          box-shadow:0 30px 60px rgba(19,14,45,0.45); text-align:center; animation: guest-rise .35s ease;
          border:1.5px solid rgba(52,31,96,0.06);
        }
        @keyframes guest-rise{ from{opacity:0; transform:translateY(14px);} to{opacity:1; transform:translateY(0);} }
        .guest-gate-mark{
          width:56px;height:56px;border-radius:50%; margin:0 auto 18px;
          background:radial-gradient(circle at 35% 30%,#fff,#E7A1A8 60%,#694CD0);
          box-shadow:0 0 0 8px rgba(105,76,208,0.1);
        }
        .guest-gate-card h2{
          font-family:'Sora',sans-serif; font-size:24px; font-weight:800; color:#34205F; margin:0 0 8px;
        }
        .guest-gate-card p{ color:#6B5A8E; font-size:13.5px; line-height:1.6; margin:0 0 22px; }
        .guest-gate-input{
          width:100%; border:1.5px solid rgba(52,31,96,0.14); border-radius:12px; padding:13px 15px;
          font-size:14px; font-family:inherit; outline:none; margin-bottom:18px; text-align:center;
          transition:border-color .2s ease, box-shadow .2s ease;
        }
        .guest-gate-input:focus{ border-color:#694CD0; box-shadow:0 0 0 4px rgba(105,76,208,0.12); }
        .guest-gate-actions{ display:flex; flex-direction:column; gap:10px; }
        .guest-gate-confirm{
          width:100%; background:linear-gradient(120deg,#694CD0,#34205F); color:#fff; border:none; border-radius:12px;
          padding:14px 0; font-family:'Sora',sans-serif; font-weight:800; font-size:15.5px;
          cursor:pointer; transition:transform .15s ease, box-shadow .15s ease;
        }
        .guest-gate-confirm:hover{ transform:translateY(-2px); box-shadow:0 14px 28px rgba(105,76,208,0.32); }
        .guest-gate-back{
          width:100%; background:none; border:none; color:#8578AE; font-size:13px; font-weight:600; cursor:pointer;
          padding:6px 0;
        }
        .guest-gate-note{ font-size:11.5px; color:#A89BD2; margin-top:16px; }
      `}</style>
      <div className="guest-gate-card">
        <div className="guest-gate-mark" />
        <h2>What should we call you?</h2>
        <p>Guest sessions aren't saved to an account, but we'll still use this to personalize your dashboard.</p>
        <input
          className="guest-gate-input"
          placeholder="e.g. Priya (optional)"
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm()}
          maxLength={40}
        />
        <div className="guest-gate-actions">
          <button className="guest-gate-confirm" onClick={onConfirm}>Continue to dashboard</button>
          <button className="guest-gate-back" onClick={onCancel}>Back</button>
        </div>
        <p className="guest-gate-note">Nothing you enter here is sent anywhere or saved once you close this tab.</p>
      </div>
    </div>
  );
}

export default function NARIApp() {
  const [view, setView] = useState(() => (loadSession() ? "dashboard" : "landing"));
  const [user, setUser] = useState(() => loadSession());
  const [activePage, setActivePage] = useState("dashboard");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const [sttAvailable, setSttAvailable] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const useServerStt = sttAvailable;
  const micSupported = sttAvailable || voiceSupported;

  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [reportFile, setReportFile] = useState(null);
  const [scanState, setScanState] = useState("idle");
  const [scanResult, setScanResult] = useState(null);
  const [scanErrorText, setScanErrorText] = useState("");
  const [pastReports, setPastReports] = useState([]);

  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [toast, setToast] = useState(null);
  const unreadCount = notifications.filter((n) => n.unread).length;

  const [sessionRiskSignals, setSessionRiskSignals] = useState([]);
  const [sessionCarePlan, setSessionCarePlan] = useState(null);

  const [selectedPatientId, setSelectedPatientId] = useState("p1");

  // Guest mode used to drop straight into the dashboard as an anonymous
  // "Guest" with no way to personalize the session. Both entry points
  // (landing page + login page) now route through this small name-capture
  // gate first, so the dashboard can greet the person by name and label
  // their own session's data instead of always saying "Guest".
  const [pendingGuestEntry, setPendingGuestEntry] = useState(false);
  const [guestNameDraft, setGuestNameDraft] = useState("");

  const confirmGuestEntry = () => {
    const name = guestNameDraft.trim();
    enterDashboard({ guest: true, fullName: name || "Guest" });
    setPendingGuestEntry(false);
    setGuestNameDraft("");
  };

  useEffect(() => {
    if (view !== "dashboard") return;
    getVoiceStatus()
      .then((s) => {
        setSttAvailable(!!s.stt_available);
        setTtsAvailable(!!s.tts_available);
      })
      .catch(() => {
        setSttAvailable(false);
        setTtsAvailable(false);
      });
  }, [view]);

  useEffect(() => {
    if (view !== "dashboard") return;
    listReports()
      .then((data) => {
        const items = (data.items || []).map((r) => ({
          id: r.id,
          name: r.original_filename,
          date: formatDate(r.uploaded_at),
          status: deriveReportFlag(r.metrics),
          statusLabel: deriveReportFlag(r.metrics),
        }));
        setPastReports(items);
      })
      .catch(() => {});
  }, [view]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setVoiceSupported(true);
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setIsListening(false);
        if (transcript) {
          handleVoiceTurn({ transcript });
        }
      };
      rec.onerror = (e) => {
        setIsListening(false);
        if (e.error !== "no-speech") {
          setVoiceError(`Voice error: ${e.error}`);
        }
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      const clean = text
        .replace(/[*_#`•\-]/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .slice(0, 350)
        .trim();
      if (!clean) return;

      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(clean);
        u.rate = 1.0;
        u.pitch = 1.0;
        const voices = window.speechSynthesis.getVoices() || [];
        const preferredVoice = pickFemaleVoice(voices);
        if (preferredVoice) {
          u.voice = preferredVoice;
        }
        u.onerror = (e) => {
          console.warn("Speech synthesis warning:", e);
        };
        window.speechSynthesis.speak(u);
      }, 70);
    } catch (err) {
      console.warn("TTS error:", err);
    }
  };

  const copyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setToast("Response copied to clipboard");
    setTimeout(() => {
      setCopiedId(null);
      setToast(null);
    }, 2500);
  };

  const clearChat = () => {
    setMessages(INITIAL_MESSAGES);
    setToast("Started a new consultation");
    setTimeout(() => setToast(null), 2500);
  };

  const startRecordingAudio = async () => {
    setVoiceError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setIsListening(false);
        if (blob.size > 0) {
          handleVoiceTurn({ audioBlob: blob });
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsListening(true);
    } catch {
      setVoiceError("Microphone access was denied or not available.");
      setIsListening(false);
    }
  };

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (useServerStt) stopRecordingAudio();
      else recognitionRef.current?.stop();
    } else {
      if (useServerStt) startRecordingAudio();
      else {
        setVoiceError("");
        try {
          recognitionRef.current?.start();
          setIsListening(true);
        } catch {
          setIsListening(false);
        }
      }
    }
  };

  const addNotification = (text, time = "just now") => {
    setNotifications((prev) => [{ id: Date.now(), text, time, unread: true }, ...prev]);
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 4000);
  };

  const markRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const recentHistoryPayload = () =>
    messages
      .filter((m) => m.sender === "user" || m.sender === "assistant")
      .slice(-8)
      .map((m) => ({ role: m.sender, content: m.text }));

  const handleSend = async (overrideText) => {
    const text = (typeof overrideText === "string" ? overrideText : input).trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: Date.now(), sender: "user", text }]);
    setInput("");
    setIsTyping(true);
    try {
      const res = await sendChatMessage(text, recentHistoryPayload(), { ...DEMO_PROFILE, full_name: displayName });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "assistant",
          agent: res.agent,
          text: res.reply,
          urgent: res.urgent,
          evidence: res.evidence,
          riskSignal: res.risk_signal,
        },
      ]);
      if (speakEnabled) speak(res.reply);
      if (res.urgent) addNotification("Urgent symptom flagged in your assistant chat", "just now");
      if (res.risk_signal) setSessionRiskSignals((prev) => [res.risk_signal, ...prev].slice(0, 6));
      if (res.care_plan) setSessionCarePlan(res.care_plan);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: "assistant",
          agent: "NARI",
          text: `Sorry, I couldn't reach the assistant backend (${err.message}). Is the FastAPI server running?`,
        },
      ]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleVoiceTurn = async ({ audioBlob, transcript }) => {
    const placeholderId = Date.now();
    setMessages((prev) => [
      ...prev,
      transcript
        ? { id: placeholderId, sender: "user", text: transcript }
        : { id: placeholderId, sender: "user", text: "🎙️ Transcribing…", pending: true },
    ]);
    setIsTyping(true);

    try {
      const res = await voiceConverse({ audioBlob, transcript, history: recentHistoryPayload() });

      setMessages((prev) => {
        const withTranscript = prev.map((m) =>
          m.id === placeholderId ? { ...m, text: res.transcript, pending: false } : m
        );
        return [
          ...withTranscript,
          {
            id: Date.now() + 1,
            sender: "assistant",
            agent: res.agent,
            text: res.reply,
            urgent: res.urgent,
            evidence: res.evidence,
            riskSignal: res.risk_signal,
          },
        ];
      });

      if (res.urgent) addNotification("Urgent symptom flagged in your assistant chat", "just now");
      if (res.risk_signal) setSessionRiskSignals((prev) => [res.risk_signal, ...prev].slice(0, 6));
      if (res.care_plan) setSessionCarePlan(res.care_plan);

      if (res.audio_base64) {
        const audio = new Audio(`data:audio/${res.audio_format || "wav"};base64,${res.audio_base64}`);
        audio.play().catch(() => {});
      } else {
        speak(res.reply);
      }
    } catch (err) {
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== placeholderId || transcript)
          .map((m) => (m.id === placeholderId ? { ...m, text: transcript || m.text, pending: false } : m))
          .concat({
            id: Date.now() + 2,
            sender: "assistant",
            agent: "NARI",
            text: `Sorry, the voice pipeline hit an error: ${err.message}`,
          })
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleFile = async (file) => {
    setReportFile(file);
    setScanState("scanning");
    setScanResult(null);
    setScanErrorText("");
    try {
      const res = await uploadReport(file);
      const reportJson = res.report.report_json;
      setScanResult({
        patientDemographicsFound: reportJson.patient_demographics_found,
        metrics: reportJson.metrics,
      });
      setScanState("done");
      setPastReports((prev) => [
        {
          id: res.report.id,
          name: res.report.original_filename,
          date: "Just now",
          status: deriveReportFlag(reportJson.metrics),
          statusLabel: deriveReportFlag(reportJson.metrics),
        },
        ...prev,
      ]);
      addNotification(`Report analyzed — ${reportJson.metrics.length} value(s) extracted`, "just now");
    } catch (err) {
      setScanState("error");
      setScanErrorText(err.message || "Something went wrong while analyzing this report.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const resetScan = () => {
    setScanState("idle");
    setScanResult(null);
    setScanErrorText("");
    setReportFile(null);
  };

  const goTo = (page) => (e) => {
    if (e) e.preventDefault();
    setActivePage(page);
    if (window.location.hash !== `#${page}`) {
      window.history.pushState(null, "", `#${page}`);
    }
  };

  const enterDashboard = (u) => {
    setUser(u);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    } catch {
      /* ignore */
    }
    setView("dashboard");
    setActivePage("dashboard");
  };

  const handleSignOut = () => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setView("landing");
  };

  if (pendingGuestEntry) {
    return (
      <GuestNameGate
        value={guestNameDraft}
        onChange={setGuestNameDraft}
        onConfirm={confirmGuestEntry}
        onCancel={() => setPendingGuestEntry(false)}
      />
    );
  }

  if (view === "landing") {
    return (
      <LandingPage
        onGetStarted={() => setView("login")}
        onSignIn={() => setView("login")}
        onGuest={() => setPendingGuestEntry(true)}
      />
    );
  }

  if (view === "login") {
    return (
      <LoginPage
        onSignIn={(u) => enterDashboard(u)}
        onGuest={() => setPendingGuestEntry(true)}
        onBack={() => setView("landing")}
      />
    );
  }

  const displayName = user?.guest ? user?.fullName || "Guest" : user?.fullName || (user?.email ? user.email.split("@")[0] : "there");

  return (
    <div className="app-shell">
      <style>{`
        :root{
          color-scheme: light;
          --deep-violet:#34205F;
          --primary-purple:#694CD0;
          --lavender:#E1C3FF;
          --warm-cream:#FFF9EF;
          --health-teal:#3F8F87;
          --soft-rose:#FFD9E4;
          --rose:#E7A1A8;
          --gold:#F4CE45;
          --ink:#22163F;
          --ink-soft:#6B5A8E;
          --line:rgba(52,32,95,0.1);
          --panel:#ffffff;
          --font-head:'Sora',sans-serif;
          --font-body:'DM Sans',-apple-system,sans-serif;
          --shadow-soft: 0 16px 40px rgba(52,32,95,0.12);
          --shadow-card: 0 4px 18px rgba(52,32,95,0.06);
          --gradient-hero: linear-gradient(135deg, var(--deep-violet) 0%, var(--primary-purple) 100%);
          --gradient-blush: linear-gradient(135deg, #FFF9EF 0%, #FEEBF1 50%, #F0E9FF 100%);
          --mint: var(--health-teal);
        }
        .app-shell{ color-scheme: light; }
        .app-shell button, .app-shell input, .app-shell select, .app-shell a{ color-scheme: light; }
        .app-shell *{box-sizing:border-box;}
        .app-shell{
          display:flex; min-height:100vh; background:var(--warm-cream); color:var(--ink);
          font-family:var(--font-body); font-size:15px;
        }
        .app-shell h1,.app-shell h2,.app-shell h3,.app-shell h4{font-family:var(--font-head);font-weight:800;letter-spacing:-0.01em;color:var(--deep-violet);margin:0;}
        .app-shell a{text-decoration:none;color:inherit;}
        .app-shell button{font-family:inherit;cursor:pointer;}
        .app-shell ul{list-style:none;margin:0;padding:0;}

        .sidebar{
          width:240px; flex-shrink:0; background:#fff; color:var(--ink);
          display:flex; flex-direction:column; padding:26px 18px; position:fixed; top:0; bottom:0; left:0; height:100vh;
          border-right:1px solid var(--line); box-shadow:var(--shadow-card); z-index:10;
        }
        .brand{display:flex;align-items:center;gap:11px;font-family:var(--font-head);font-weight:800;font-size:20px;padding:0 8px 30px;color:var(--deep-violet);}
        .brand-mark{
          width:28px;height:28px;border-radius:50%;
          background:radial-gradient(circle at 35% 30%,#fff,#E7A1A8 55%,#694CD0);
          box-shadow:0 0 0 4px rgba(245,166,194,0.3);flex-shrink:0;
        }
        .sidebar-nav{display:flex;flex-direction:column;gap:5px;flex:1;}
        .nav-item{
          display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;
          font-family:var(--font-head);font-weight:600;font-size:13.5px;color:var(--ink-soft);
          transition:all .2s cubic-bezier(.2,.8,.2,1);
        }
        .nav-item:hover{background:var(--warm-cream);color:var(--deep-violet);transform:translateX(3px);}
        .nav-item.active{background:linear-gradient(120deg,#694CD0,#34205F);color:#fff;box-shadow:0 8px 20px rgba(105,76,208,0.28);}
        .nav-section-label{padding:14px 14px 4px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);opacity:0.6;}
        .nav-item-secondary{font-size:12.5px;padding:9px 14px;opacity:0.85;}
        .sidebar-foot{border-top:1px solid var(--line);padding-top:18px;margin-top:12px;display:flex;flex-direction:column;gap:12px;}
        .user-chip{display:flex;align-items:center;gap:11px;}
        .user-avatar{
          width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--rose),var(--primary-purple));
          display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 10px rgba(105,76,208,0.25);
        }
        .user-name{font-family:var(--font-head);font-weight:700;font-size:13.5px;color:var(--deep-violet);}
        .user-sub{font-size:11.5px;color:var(--ink-soft);}
        .signout-btn{
          display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;
          border:none;background:var(--warm-cream);color:var(--ink-soft);font-size:12px;font-weight:600;
          transition:background .2s ease,color .2s ease;
        }
        .signout-btn:hover{background:#FBE0E5;color:#6b1f27;}

        .main-col{flex:1;display:flex;flex-direction:column;min-width:0;margin-left:240px;}
        .topbar{
          display:flex;align-items:center;justify-content:space-between;padding:18px 36px;
          border-bottom:1px solid var(--line);background:rgba(255,247,240,0.85);backdrop-filter:blur(10px);
          position:sticky;top:0;z-index:9;
        }
        .topbar-title{font-family:var(--font-head);font-weight:700;font-size:19px;color:var(--deep-violet);}
        .topbar-actions{display:flex;align-items:center;gap:12px;position:relative;}
        .guest-banner{
          background:#FFF0D6;color:#7A4B00;font-size:12px;padding:6px 12px;border-radius:100px;
          display:flex;align-items:center;gap:8px;font-weight:600;
        }
        .guest-banner button{
          background:#7A4B00;color:#fff;border:none;border-radius:100px;padding:2px 9px;
          font-size:11px;font-weight:700;
        }
        .icon-btn{
          position:relative;width:40px;height:40px;border-radius:50%;border:none;
          background:#fff;display:flex;align-items:center;justify-content:center;color:var(--deep-violet);
          box-shadow:var(--shadow-card);transition:transform .18s ease;
        }
        .icon-btn:hover{transform:scale(1.06);}
        .badge{
          position:absolute;top:-3px;right:-3px;background:var(--rose);color:#4a1f27;
          font-size:10px;font-weight:700;border-radius:100px;padding:2px 6px;font-family:var(--font-head);
        }
        .notif-backdrop{position:fixed;inset:0;z-index:20;}
        .notif-panel{
          position:absolute;top:50px;right:0;width:330px;background:#fff;border:none;
          border-radius:20px;box-shadow:0 22px 50px rgba(52,31,96,0.18);z-index:21;overflow:hidden;
        }
        .notif-panel-head{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--line);font-family:var(--font-head);font-weight:700;font-size:14px;color:var(--deep-violet);}
        .notif-panel-head button{background:none;border:none;color:var(--ink-soft);}
        .notif-panel ul{max-height:320px;overflow-y:auto;}
        .notif-panel li{display:flex;gap:11px;padding:14px 18px;border-bottom:1px solid var(--line);cursor:pointer;}
        .notif-panel li:last-child{border-bottom:none;}
        .notif-panel li:hover{background:var(--warm-cream);}
        .notif-panel li .dot{width:8px;height:8px;border-radius:50%;background:var(--line);margin-top:6px;flex-shrink:0;}
        .notif-panel li.unread .dot{background:var(--primary-purple);}
        .notif-panel li strong{display:block;font-size:13px;font-weight:600;color:var(--deep-violet);line-height:1.4;}
        .notif-panel li span{font-size:11.5px;color:var(--ink-soft);}

        .page{flex:1;padding:32px 36px 56px;max-width:1040px;width:100%;margin:0 auto;}

        .toast{
          position:fixed;bottom:26px;right:26px;background:var(--deep-violet);color:#fff;
          padding:14px 20px;border-radius:14px;display:flex;align-items:center;gap:10px;
          font-size:13.5px;box-shadow:0 18px 40px rgba(52,31,96,0.32);z-index:30;animation:rise .25s ease;
        }
        @keyframes rise{ from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:translateY(0);} }

        .welcome-card{
          background:
            radial-gradient(circle at 85% 15%, rgba(245,166,194,0.35), transparent 55%),
            radial-gradient(circle at 8% 90%, rgba(143,214,196,0.22), transparent 50%),
            var(--gradient-hero);
          color:#fff;border-radius:24px;
          padding:34px 38px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:22px;margin-bottom:28px;
          box-shadow:var(--shadow-soft);position:relative;overflow:hidden;
        }
        .welcome-card::before{
          content:''; position:absolute; right:-60px; top:-70px; width:260px; height:260px; border-radius:50%;
          background:radial-gradient(circle,#E7A1A8 0%,transparent 70%); opacity:0.3; pointer-events:none; filter:blur(6px);
        }
        .welcome-card::after{
          content:''; position:absolute; left:-40px; bottom:-60px; width:200px; height:200px; border-radius:50%;
          background:radial-gradient(circle,#3F8F87 0%,transparent 72%); opacity:0.22; pointer-events:none; filter:blur(6px);
        }
        .eyebrow-sm{font-family:var(--font-head);font-weight:700;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--lavender);margin:0 0 6px;}
        .welcome-card h1{color:#fff;font-size:26px;font-weight:800;position:relative;z-index:1;}
        .muted{color:rgba(255,247,240,0.82);font-size:14px;margin-top:6px;}
        .quick-actions{display:flex;gap:10px;flex-wrap:wrap;position:relative;z-index:1;}
        .qa-btn{
          display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:100px;
          font-family:var(--font-head);font-weight:700;font-size:13.5px;background:#fff;color:var(--deep-violet);border:none;
          box-shadow:0 4px 14px rgba(0,0,0,0.08);transition:transform .18s ease, box-shadow .18s ease;
        }
        .qa-btn:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,0.14);}
        .qa-btn.primary{background:linear-gradient(135deg,#E7A1A8,#F4CE45);color:#34205F;}

        .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:28px;}
        .stat-card{
          background:#fff;border:none;border-radius:20px;padding:22px;box-shadow:var(--shadow-card);
          transition:transform .2s ease, box-shadow .2s ease;
        }
        .stat-card:hover{ transform:translateY(-3px); box-shadow:var(--shadow-soft); }
        .stat-icon.rose{color:var(--rose);} .stat-icon.teal{color:var(--health-teal);}
        .stat-icon.purple{color:var(--primary-purple);} .stat-icon.violet{color:var(--deep-violet);}
        .stat-label{font-size:12px;font-weight:600;color:var(--ink-soft);margin-top:14px;}
        .stat-value{font-family:var(--font-head);font-weight:800;font-size:20px;color:var(--deep-violet);margin-top:4px;}
        .stat-sub{font-size:12px;color:var(--ink-soft);margin-top:4px;}

        .activity-card{background:#fff;border:none;border-radius:20px;padding:26px 28px;box-shadow:var(--shadow-card);}
        .activity-card h3{font-size:16px;margin-bottom:18px;}
        .activity-list li{display:flex;gap:14px;padding:12px 0;border-bottom:1px dashed var(--line);align-items:flex-start;}
        .activity-list li:last-child{border-bottom:none;}
        .activity-list .dot{width:10px;height:10px;border-radius:50%;margin-top:5px;flex-shrink:0;}
        .dot.rose{background:var(--rose);} .dot.teal{background:var(--health-teal);}
        .dot.purple{background:var(--primary-purple);} .dot.violet{background:var(--deep-violet);}
        .activity-list strong{display:block;font-size:13.5px;color:var(--deep-violet);font-weight:600;}
        .activity-list span{font-size:11.5px;color:var(--ink-soft);}

        /* Chat Layout & Formatted Markdown */
        .chat-shell{display:flex;flex-direction:column;height:calc(100vh - 160px);max-height:760px;background:#fff;border:none;border-radius:24px;overflow:hidden;box-shadow:var(--shadow-soft);}
        .chat-toolbar{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid var(--line);background:#FAFAFE;}
        .chat-toolbar-left{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--ink-soft);font-weight:600;}
        .chat-toolbar-right{display:flex;align-items:center;gap:10px;}
        .tool-btn{display:flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:100px;padding:7px 13px;font-size:12px;font-weight:600;color:var(--ink-soft);transition:all .18s ease;}
        .tool-btn:hover{background:var(--warm-cream);color:var(--deep-violet);}
        .tool-btn.on{background:var(--lavender);color:var(--deep-violet);border-color:transparent;}
        
        .chat-window{flex:1;overflow-y:auto;padding:24px 22px;display:flex;flex-direction:column;gap:18px;}
        .msg-row{display:flex;flex-direction:column;max-width:78%;}
        .msg-row.user{align-self:flex-end;align-items:flex-end;}
        .msg-row.assistant{align-self:flex-start;align-items:flex-start;}
        .agent-tag{font-family:var(--font-head);font-weight:700;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:var(--primary-purple);margin-bottom:6px;padding-left:4px;}
        .bubble{padding:14px 18px;border-radius:20px;font-size:14.5px;line-height:1.65; animation: bubble-in .25s ease; position:relative;}
        @keyframes bubble-in{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:translateY(0);} }
        .bubble.user{background:linear-gradient(135deg,var(--primary-purple),#34205F);color:#fff;border-bottom-right-radius:6px;white-space:pre-wrap;}
        .bubble.assistant{background:var(--gradient-blush);color:var(--ink);border-bottom-left-radius:6px;}
        .bubble.assistant.urgent{background:#FBE0E5;color:#6b1f27;border:1.5px solid var(--rose);}
        
        .chat-formatted-body{display:flex;flex-direction:column;gap:10px;}
        .chat-paragraph{margin:0;font-size:14.5px;line-height:1.65;}
        .chat-section-header{font-size:14px;font-weight:800;color:var(--deep-violet);margin:10px 0 3px;display:flex;align-items:center;gap:6px;}
        .chat-bullet-list{margin:4px 0 8px;padding-left:18px;display:flex;flex-direction:column;gap:6px;list-style:disc;}
        .chat-bullet-list li{font-size:14px;line-height:1.6;}
        
        .msg-footer{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:8px;border-top:1px dashed rgba(52,31,96,0.12);}
        .msg-action-btn{display:inline-flex;align-items:center;gap:5px;border:none;background:none;color:var(--ink-soft);font-size:11.5px;font-weight:600;padding:3px 7px;border-radius:6px;cursor:pointer;transition:all .15s ease;}
        .msg-action-btn:hover{background:rgba(105,76,208,0.12);color:var(--deep-violet);}
        
        .bubble.typing{display:flex;gap:5px;padding:14px 18px;}
        .bubble.typing span{width:7px;height:7px;border-radius:50%;background:var(--ink-soft);opacity:0.5;animation:blink 1.2s infinite ease-in-out;}
        .bubble.typing span:nth-child(2){animation-delay:0.2s;} .bubble.typing span:nth-child(3){animation-delay:0.4s;}
        @keyframes blink{0%,80%,100%{opacity:0.25;} 40%{opacity:0.9;}}
        
        .risk-flag{display:flex;align-items:flex-start;gap:7px;margin-top:10px;padding:9px 12px;border-radius:12px;font-size:12.5px;line-height:1.45;background:#FFF4E0;color:#7A4B00;border:1px solid var(--gold);}
        .risk-flag svg{flex-shrink:0;margin-top:2px;}
        .risk-flag.risk-l2,.risk-flag.risk-l3{background:#FBE0E5;color:#6b1f27;border-color:var(--rose);}
        
        .evidence-list{margin-top:8px;display:flex;flex-direction:column;gap:3px;}
        .evidence-item{font-size:11.5px;color:var(--ink-soft);}
        .evidence-item a{color:var(--primary-purple);text-decoration:underline;}

        .expand-panel{margin-top:8px;border:1px solid var(--line);border-radius:10px;background:#FAFAFC;}
        .expand-panel summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;font-size:12px;font-weight:600;color:var(--deep-violet);}
        .expand-panel summary::-webkit-details-marker{display:none;}
        .expand-panel summary::after{content:"+";font-size:14px;font-weight:700;color:var(--ink-soft);}
        .expand-panel[open] summary::after{content:"−";}
        .expand-panel .expand-body{padding:0 12px 10px;font-size:12px;color:var(--ink-soft);line-height:1.5;}
        .expand-panel .expand-body ul{margin:0;padding-left:16px;}
        .expand-panel + .expand-panel{margin-top:6px;}

        .chat-disclaimer{display:flex;align-items:center;gap:6px;padding:6px 22px;font-size:11px;color:var(--ink-soft);background:var(--warm-cream);border-top:1px solid var(--line);}
        .chat-disclaimer svg{flex-shrink:0;}
        
        .chip-row{display:flex;flex-wrap:wrap;gap:8px;padding:0 22px 14px;}
        .chip{border:none;background:#fff;border-radius:100px;padding:9px 15px;font-size:12.5px;color:var(--deep-violet);font-weight:600;box-shadow:var(--shadow-soft);transition:transform .18s ease, background .18s ease;}
        .chip:hover{background:var(--lavender);transform:translateY(-2px);}
        .voice-error{display:flex;align-items:center;gap:7px;padding:0 22px 10px;color:#8a4a30;font-size:12px;}
        
        .chat-input-row{display:flex;align-items:center;gap:10px;padding:16px 22px;border-top:1px solid var(--line);background:#fff;}
        .mic-btn{width:42px;height:42px;border-radius:50%;border:none;background:var(--warm-cream);display:flex;align-items:center;justify-content:center;color:var(--deep-violet);flex-shrink:0;transition:transform .18s ease;}
        .mic-btn.listening{background:var(--rose);color:#fff;border-color:transparent;animation:mic-pulse 1.4s infinite;}
        .mic-btn.disabled{opacity:0.4;cursor:not-allowed;}
        .mic-btn:hover{transform:scale(1.08);}
        @keyframes mic-pulse{0%{box-shadow:0 0 0 0 rgba(245,166,194,0.5);}100%{box-shadow:0 0 0 10px rgba(245,166,194,0);}}
        
        .chat-input{flex:1;border:1.5px solid var(--line);border-radius:100px;padding:12px 20px;font-size:14.5px;font-family:var(--font-body);outline:none;transition:border-color .2s ease, box-shadow .2s ease;}
        .chat-input:focus{border-color:var(--primary-purple); box-shadow:0 0 0 3px rgba(105,76,208,0.14);}
        .send-btn{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--primary-purple),#34205F);color:#fff;border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .18s ease;box-shadow:var(--shadow-soft);}
        .send-btn:hover{transform:scale(1.08) rotate(6deg);}

        .reports-shell{display:flex;flex-direction:column;gap:22px;}
        .dropzone{
          border:2.5px dashed var(--lavender);border-radius:24px;background:#fff;padding:46px 20px;
          display:flex;flex-direction:column;align-items:center;text-align:center;gap:9px;color:var(--ink-soft);cursor:pointer;
          transition: border-color .2s ease, background .2s ease, transform .2s ease;
        }
        .dropzone:hover{ transform:translateY(-2px); }
        .dropzone.active{border-color:var(--primary-purple);background:var(--gradient-blush);}
        .dropzone svg{color:var(--primary-purple);}
        .dropzone strong{color:var(--deep-violet);}
        .muted-sm{font-size:12px;color:var(--ink-soft);}
        .scan-card{background:#fff;border:none;border-radius:20px;padding:24px;box-shadow:var(--shadow-soft);}
        .scan-card-head{display:flex;align-items:center;gap:9px;font-family:var(--font-head);font-weight:700;font-size:14px;color:var(--deep-violet);margin-bottom:10px;}
        .spin{animation:spin 1s linear infinite;color:var(--primary-purple);}
        @keyframes spin{to{transform:rotate(360deg);}}
        .ok{color:var(--health-teal);}
        .err{color:#b23b4a;}
        .marker-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13.5px;}
        .marker-table th{text-align:left;font-family:var(--font-head);font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-soft);padding:8px 6px;border-bottom:1px solid var(--line);}
        .marker-table td{padding:10px 6px;border-bottom:1px solid var(--line);color:var(--ink);}
        .flag-pill{font-family:var(--font-head);font-weight:700;font-size:11px;padding:4px 10px;border-radius:100px;text-transform:capitalize;}
        .flag-pill.low, .flag-pill.flagged{background:#FDEBD3;color:#8a4a30;}
        .flag-pill.high{background:#FBE0E5;color:#6b1f27;}
        .flag-pill.normal{background:#DFF3ED;color:#215a52;}
        .past-reports{background:#fff;border:none;border-radius:20px;padding:24px;box-shadow:var(--shadow-soft);}
        .past-reports h3{font-size:15px;margin-bottom:14px;}
        .past-reports li{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px dashed var(--line);}
        .past-reports li:last-child{border-bottom:none;}
        .past-reports li svg{color:var(--primary-purple);flex-shrink:0;}
        .past-reports li > div{flex:1;}
        .past-reports li strong{display:block;font-size:13.5px;color:var(--deep-violet);font-weight:600;}
        .past-reports li span{font-size:11.5px;color:var(--ink-soft);}

        .pipeline-card{background:#fff;border:none;border-radius:20px;padding:26px 28px;margin-bottom:28px;box-shadow:var(--shadow-soft);}
        .pipeline-head{display:flex;align-items:center;gap:8px;color:var(--primary-purple);}
        .pipeline-head h3{font-size:14.5px;margin:0;color:var(--deep-violet);}
        .pipeline-card code{background:var(--gradient-blush);color:var(--deep-violet);padding:2px 7px;border-radius:6px;font-size:11.5px;}
        .pipeline-row{display:flex;align-items:stretch;gap:2px;overflow-x:auto;margin-top:16px;padding-bottom:4px;}
        .pipeline-step{display:flex;align-items:center;flex-shrink:0;}
        .pipeline-step-inner{
          display:flex;align-items:center;gap:10px;background:var(--warm-cream);border:1px solid var(--line);border-radius:16px;padding:10px 14px;min-width:154px;
          transition:transform .18s ease;
        }
        .pipeline-step-inner:hover{ transform:translateY(-3px); }
        .pipeline-index{
          width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--rose),var(--primary-purple));
          color:#fff;font-family:var(--font-head);font-weight:700;font-size:10.5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
        }
        .pipeline-step-inner strong{display:block;font-size:12px;color:var(--deep-violet);font-weight:700;line-height:1.3;}
        .pipeline-step-inner span{font-size:10.5px;color:var(--ink-soft);}
        .pipeline-arrow{color:var(--line);flex-shrink:0;margin:0 3px;}

        .twin-shell{display:flex;flex-direction:column;gap:20px;}
        .twin-profile-card{display:flex;align-items:center;gap:18px;background:var(--gradient-hero);border-radius:24px;padding:24px 28px;color:#fff;}
        .twin-avatar{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .twin-profile-info h2{color:#fff;font-size:18px;}
        .twin-profile-info .muted-sm{color:rgba(255,247,240,0.8);margin-top:4px;}
        .twin-badge{margin-left:auto;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.16);border-radius:100px;padding:7px 13px;font-size:12px;font-weight:600;flex-shrink:0;}
        .twin-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
        .twin-card{background:#fff;border:none;border-radius:20px;padding:22px 24px;box-shadow:var(--shadow-soft);}
        .twin-card-wide{grid-column:1 / -1;}
        .twin-card-head{display:flex;align-items:center;gap:8px;color:var(--primary-purple);margin-bottom:10px;}
        .twin-card-head h3{font-size:14px;margin:0;color:var(--deep-violet);}
        .twin-card a{color:var(--primary-purple);text-decoration:underline;}
        .twin-timeline{display:flex;flex-direction:column;gap:12px;}
        .twin-timeline li{display:flex;align-items:flex-start;gap:10px;}
        .twin-timeline li strong{display:block;font-size:13px;color:var(--deep-violet);font-weight:600;}
        .twin-timeline li span{font-size:11px;color:var(--ink-soft);}
        .twin-tag{flex-shrink:0;font-family:var(--font-head);font-weight:700;font-size:10px;padding:3px 8px;border-radius:100px;margin-top:1px;}
        .twin-tag-symptom{background:#FBE0E5;color:#6b1f27;}
        .twin-tag-lab{background:#DFF3ED;color:#215a52;}
        .twin-tag-lifestyle{background:#F0E9FF;color:var(--primary-purple);}

        .risk-card{border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:12px;background:#fff;}
        .risk-card:last-child{margin-bottom:0;}
        .risk-card-head{display:flex;align-items:center;gap:9px;margin-bottom:8px;}
        .risk-card-head strong{font-family:var(--font-head);color:var(--deep-violet);font-size:13.5px;}
        .example-tag{margin-left:auto;font-size:10px;font-weight:700;color:var(--ink-soft);border:1px solid var(--line);border-radius:100px;padding:2px 8px;}
        .level-pill{font-family:var(--font-head);font-weight:700;font-size:10.5px;padding:4px 10px;border-radius:100px;flex-shrink:0;}
        .level-l0{background:#DFF3ED;color:#215a52;} .level-l1{background:#FFF4E0;color:#7A4B00;}
        .level-l2{background:#FBE0E5;color:#6b1f27;} .level-l3{background:#6b1f27;color:#fff;}
        .risk-card-l0{border-left:4px solid var(--health-teal);} .risk-card-l1{border-left:4px solid var(--gold);}
        .risk-card-l2{border-left:4px solid var(--rose);} .risk-card-l3{border-left:4px solid #6b1f27;}
        .factor-list{margin:0 0 8px;padding-left:18px;font-size:12.5px;color:var(--ink);}
        .factor-list li{margin-bottom:3px;}
        .risk-next{display:flex;align-items:flex-start;gap:6px;font-size:12.5px;color:var(--ink-soft);margin-top:6px;line-height:1.5;}
        .risk-next svg{flex-shrink:0;margin-top:2px;color:var(--primary-purple);}

        .clinician-banner{display:flex;align-items:flex-start;gap:9px;background:#F0E9FF;color:var(--ink-soft);border:none;border-radius:16px;padding:14px 18px;font-size:12.5px;line-height:1.5;margin-bottom:20px;box-shadow:var(--shadow-card);}
        .clinician-banner svg{flex-shrink:0;margin-top:2px;color:var(--primary-purple);}
        .clinician-grid{display:grid;grid-template-columns:320px 1fr;gap:20px;align-items:start;}
        .roster-card{background:#fff;border:none;border-radius:20px;padding:22px;box-shadow:var(--shadow-soft);}
        .roster-list{display:flex;flex-direction:column;gap:5px;margin-top:10px;}
        .roster-list li{display:flex;align-items:center;gap:10px;padding:12px 10px;border-radius:12px;cursor:pointer;transition:all .18s ease;}
        .roster-list li:hover{background:var(--warm-cream);}
        .roster-list li.selected{background:var(--lavender);}
        .roster-info{flex:1;min-width:0;}
        .roster-info strong{display:block;font-size:13px;color:var(--deep-violet);font-weight:600;}
        .roster-info span{font-size:11px;color:var(--ink-soft);}
        .roster-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;}
        .level-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
        .level-dot.level-l0{background:var(--health-teal);} .level-dot.level-l1{background:var(--gold);}
        .level-dot.level-l2{background:var(--rose);} .level-dot.level-l3{background:#6b1f27;}
        .patient-detail-card{background:#fff;border:none;border-radius:20px;padding:24px 26px;box-shadow:var(--shadow-soft);}
        .patient-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid var(--line);}
        .patient-detail-head h3{font-size:17px;}
        .patient-detail-card h4{display:flex;align-items:center;gap:7px;font-family:var(--font-head);font-size:12.5px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-soft);margin:20px 0 12px;}
        .patient-detail-card h4:first-of-type{margin-top:0;}
        .event-log{display:flex;flex-direction:column;gap:9px;}
        .event-log li{display:flex;align-items:center;gap:10px;font-size:12.5px;padding:9px 0;border-bottom:1px dashed var(--line);}
        .event-log li:last-child{border-bottom:none;}
        .event-time{font-family:var(--font-head);font-weight:700;color:var(--primary-purple);font-size:11px;width:40px;flex-shrink:0;}
        .event-log li strong{color:var(--deep-violet);width:170px;flex-shrink:0;}
        .event-log li span:last-child{color:var(--ink-soft);}

        @media (max-width:900px){
          .sidebar{width:72px;padding:18px 10px;border-radius:0;}
          .main-col{margin-left:72px;}
          .brand span:last-child, .nav-item span, .user-name, .user-sub, .signout-btn span{display:none;}
          .nav-section-label{display:none;}
          .brand{justify-content:center;padding-bottom:20px;}
          .nav-item{justify-content:center;}
          .user-chip{justify-content:center;}
          .stat-grid{grid-template-columns:repeat(2,1fr);}
          .page{padding:22px 16px 40px;}
          .twin-grid{grid-template-columns:1fr;}
          .clinician-grid{grid-template-columns:1fr;}
          .pipeline-row{flex-wrap:nowrap;}
          .guest-banner span{display:none;}
        }
      `}</style>

      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"></span><span>NARI</span></div>
        <nav className="sidebar-nav">
          <a href="#dashboard" onClick={goTo("dashboard")} className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}>
            <Home size={18} /><span>Home</span>
          </a>
          <a href="#assistant" onClick={goTo("assistant")} className={`nav-item ${activePage === "assistant" ? "active" : ""}`}>
            <MessageCircle size={18} /><span>Ask NARI</span>
          </a>
          <a href="#reports" onClick={goTo("reports")} className={`nav-item ${activePage === "reports" ? "active" : ""}`}>
            <FileText size={18} /><span>Reports</span>
          </a>
          <a href="#twin" onClick={goTo("twin")} className={`nav-item ${activePage === "twin" ? "active" : ""}`}>
            <HeartPulse size={18} /><span>My Health</span>
          </a>

          <div className="nav-section-label"><span>More</span></div>
          <a href="#reminders" onClick={goTo("reminders")} className={`nav-item nav-item-secondary ${activePage === "reminders" ? "active" : ""}`}>
            <Pill size={18} /><span>Reminders</span>
          </a>
          <a href="#activity" onClick={goTo("activity")} className={`nav-item nav-item-secondary ${activePage === "activity" ? "active" : ""}`}>
            <Activity size={18} /><span>Daily Activity</span>
          </a>
          <a href="#clinician" onClick={goTo("clinician")} className={`nav-item nav-item-secondary ${activePage === "clinician" ? "active" : ""}`}>
            <Stethoscope size={18} /><span>Clinician Portal</span>
          </a>
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="user-avatar">{user?.guest ? <UserRound size={15} color="#fff" /> : <User size={15} color="#fff" />}</span>
            <div>
              <div className="user-name">{displayName}</div>
              <div className="user-sub">{user?.guest ? "Browsing as guest" : "Health twin active"}</div>
            </div>
          </div>
          <button className="signout-btn" onClick={handleSignOut}>
            <LogOut size={14} /><span>{user?.guest ? "Exit guest mode" : "Sign out"}</span>
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-title">{PAGE_TITLES[activePage]}</div>
          <div className="topbar-actions">
            {user?.guest && (
              <div className="guest-banner">
                <span>You're browsing as a guest — data won't be saved.</span>
                <button onClick={() => setView("login")}>Sign in</button>
              </div>
            )}
            <button className="icon-btn" onClick={() => setShowNotifPanel((v) => !v)} aria-label="Notifications">
              <Bell size={18} />
              {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>
            {showNotifPanel && (
              <>
                <div className="notif-backdrop" onClick={() => setShowNotifPanel(false)} />
                <div className="notif-panel">
                  <div className="notif-panel-head">
                    <span>Notifications</span>
                    <button onClick={() => setShowNotifPanel(false)}><X size={15} /></button>
                  </div>
                  <ul>
                    {notifications.length === 0 && (
                      <li style={{ cursor: "default" }}>
                        <span className="dot" style={{ background: "transparent" }}></span>
                        <div>
                          <strong>You're all caught up</strong>
                          <span>Real flags and updates will show up here as you use NARI.</span>
                        </div>
                      </li>
                    )}
                    {notifications.map((n) => (
                      <li key={n.id} className={n.unread ? "unread" : ""} onClick={() => markRead(n.id)}>
                        <span className="dot"></span>
                        <div><strong>{n.text}</strong><span>{n.time}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="page">
          {activePage === "dashboard" && (
            <>
              <section className="welcome-card">
                <div>
                  <p className="eyebrow-sm">Good to see you</p>
                  <h1>Welcome back, {displayName}</h1>
                  <p className="muted">Here's where things stand with your health twin today.</p>
                </div>
                <div className="quick-actions">
                  <a href="#assistant" onClick={goTo("assistant")} className="qa-btn primary"><MessageCircle size={15} />Ask the assistant</a>
                  <a href="#reports" onClick={goTo("reports")} className="qa-btn"><Upload size={15} />Scan a report</a>
                </div>
              </section>

              <section className="stat-grid">
                {(() => {
                  const userTurns = messages.filter((m) => m.sender === "user").length;
                  const latestRisk = sessionRiskSignals[0];
                  const latestReport = pastReports[0];
                  return (
                    <>
                      <div className="stat-card">
                        <MessageCircle size={18} className="stat-icon purple" />
                        <div className="stat-label">Assistant chats</div>
                        <div className="stat-value">{userTurns}</div>
                        <div className="stat-sub">{userTurns === 0 ? "Ask your first question" : "This session"}</div>
                      </div>
                      <div className="stat-card">
                        <TrendingDown size={18} className="stat-icon teal" />
                        <div className="stat-label">Latest report flag</div>
                        <div className="stat-value">{latestReport ? latestReport.statusLabel : "None yet"}</div>
                        <div className="stat-sub">{latestReport ? latestReport.name : "Upload a lab report to see flags"}</div>
                      </div>
                      <div className="stat-card">
                        <AlertTriangle size={18} className="stat-icon rose" />
                        <div className="stat-label">Risk signals</div>
                        <div className="stat-value">{sessionRiskSignals.length}</div>
                        <div className="stat-sub">{latestRisk ? `${latestRisk.domain} pattern (${latestRisk.level})` : "None flagged this session"}</div>
                      </div>
                      <div className="stat-card">
                        <FileText size={18} className="stat-icon violet" />
                        <div className="stat-label">Reports on file</div>
                        <div className="stat-value">{pastReports.length}</div>
                        <div className="stat-sub">{pastReports.length === 0 ? "Nothing uploaded yet" : "In this session"}</div>
                      </div>
                    </>
                  );
                })()}
              </section>

              <section className="pipeline-card">
                <div className="pipeline-head">
                  <Network size={16} />
                  <h3>How NARI thinks - the multi-agent pipeline</h3>
                </div>
                <p className="muted-sm">
                  Every chat and voice turn runs through this LangGraph orchestrator
                  (<code>backend/app/agents/graph.py</code>) before you see a reply.
                </p>
                <div className="pipeline-row">
                  {AGENT_PIPELINE.map((step, i) => (
                    <div className="pipeline-step" key={step.name}>
                      <div className="pipeline-step-inner">
                        <span className="pipeline-index">{i + 1}</span>
                        <div>
                          <strong>{step.name}</strong>
                          <span>{step.note}</span>
                        </div>
                      </div>
                      {i < AGENT_PIPELINE.length - 1 && <ChevronRight size={16} className="pipeline-arrow" />}
                    </div>
                  ))}
                </div>
              </section>

              <section className="activity-card">
                <h3>Recent activity</h3>
                {(() => {
                  const items = [];
                  sessionRiskSignals.slice(0, 3).forEach((r, i) => {
                    items.push({
                      key: `risk-${i}`,
                      dot: "rose",
                      title: `${r.domain} pattern flagged (${r.level})`,
                      when: "This session",
                    });
                  });
                  pastReports.slice(0, 3).forEach((r, i) => {
                    items.push({
                      key: `report-${i}`,
                      dot: "teal",
                      title: `Report scanned — ${r.name}`,
                      when: r.date,
                    });
                  });
                  if (messages.filter((m) => m.sender === "user").length > 0) {
                    items.push({
                      key: "chat",
                      dot: "purple",
                      title: "Talked with the NARI assistant",
                      when: "This session",
                    });
                  }
                  if (items.length === 0) {
                    return (
                      <p className="muted-sm">
                        Nothing logged yet — ask the assistant a question or upload a lab report to see activity here.
                      </p>
                    );
                  }
                  return (
                    <ul className="activity-list">
                      {items.map((it) => (
                        <li key={it.key}>
                          <span className={`dot ${it.dot}`}></span>
                          <div><strong>{it.title}</strong><span>{it.when}</span></div>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </section>
            </>
          )}

          {activePage === "assistant" && (
            <div className="chat-shell">
              <div className="chat-toolbar">
                <div className="chat-toolbar-left">
                  <Sparkles size={15} />
                  <span>Clinical multi-agent assistant</span>
                </div>
                <div className="chat-toolbar-right">
                  <button className="tool-btn" onClick={clearChat} title="Start a new consultation">
                    <RotateCcw size={13} />
                    <span>New Chat</span>
                  </button>
                  <button className={`tool-btn ${speakEnabled ? "on" : ""}`} onClick={() => setSpeakEnabled((v) => !v)}>
                    {speakEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    <span>{speakEnabled ? "Voice On" : "Voice Off"}</span>
                  </button>
                </div>
              </div>

              <div className="chat-disclaimer">
                <Info size={12} />
                <span>Educational guidance, not a diagnosis. In a medical emergency, contact local emergency services immediately.</span>
              </div>

              <div className="chat-window">
                {messages.map((m) => (
                  <div key={m.id} className={`msg-row ${m.sender}`}>
                    {m.sender === "assistant" && <span className="agent-tag">{m.agent}</span>}
                    <div className={`bubble ${m.sender} ${m.urgent ? "urgent" : ""}`}>
                      {m.sender === "assistant" ? (
                        <FormattedMessage text={m.text} />
                      ) : (
                        m.text
                      )}
                      
                      {m.riskSignal && (
                        <div className={`risk-flag risk-${(m.riskSignal.level || "").toLowerCase()}`}>
                          <AlertTriangle size={13} />
                          <span>{LEVEL_LABEL[m.riskSignal.level] || "Worth a closer look"} — {m.riskSignal.next_step}</span>
                        </div>
                      )}

                      {m.riskSignal && m.riskSignal.factors && m.riskSignal.factors.length > 0 && (
                        <details className="expand-panel">
                          <summary>Why was this flagged?</summary>
                          <div className="expand-body">
                            <ul>
                              {m.riskSignal.factors.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </div>
                        </details>
                      )}

                      {m.evidence && m.evidence.length > 0 && (
                        <details className="expand-panel">
                          <summary>Medical evidence</summary>
                          <div className="expand-body">
                            <div className="evidence-list">
                              {m.evidence.slice(0, 3).map((e) => (
                                <div key={e.chunk_id} className="evidence-item">
                                  {e.source_url ? (
                                    <a href={e.source_url} target="_blank" rel="noreferrer">{e.source_title}</a>
                                  ) : (
                                    e.source_title
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                      )}

                      {m.sender === "assistant" && (
                        <div className="msg-footer">
                          <button className="msg-action-btn" onClick={() => copyMessage(m.id, m.text)}>
                            {copiedId === m.id ? <Check size={12} color="#3F8F87" /> : <Copy size={12} />}
                            <span>{copiedId === m.id ? "Copied" : "Copy"}</span>
                          </button>
                          <button className="msg-action-btn" onClick={() => speak(m.text)}>
                            <Volume2 size={12} />
                            <span>Listen</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="msg-row assistant">
                    <span className="agent-tag">NARI</span>
                    <div className="bubble assistant typing"><span></span><span></span><span></span></div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {messages.length < 2 && (
                <div className="chip-row">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button key={p} className="chip" onClick={() => handleSend(p)}>{p}</button>
                  ))}
                </div>
              )}

              {voiceError && <div className="voice-error"><AlertTriangle size={13} />{voiceError}</div>}

              <div className="chat-input-row">
                <button
                  className={`mic-btn ${isListening ? "listening" : ""} ${!micSupported ? "disabled" : ""}`}
                  onClick={toggleListening}
                  aria-label="Voice input"
                  title={useServerStt ? "Voice via server (Whisper + Piper)" : voiceSupported ? "Voice via browser speech" : "Voice input unavailable"}
                >
                  {micSupported ? <Mic size={17} /> : <MicOff size={17} />}
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  placeholder={isListening ? "Listening…" : "Ask about symptoms, labs, nutrition, cycles…"}
                  className="chat-input"
                />
                <button className="send-btn" onClick={() => handleSend()} aria-label="Send"><Send size={16} /></button>
              </div>
            </div>
          )}

          {activePage === "reports" && (
            <div className="reports-shell">
              <div
                className={`dropzone ${dragActive ? "active" : ""}`}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <Upload size={24} />
                <p><strong>Click to upload</strong> or drag a lab report here</p>
                <span className="muted-sm">PDF or image · scanned with Document AI + OCR</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
                />
              </div>

              {scanState !== "idle" && (
                <div className="scan-card">
                  <div className="scan-card-head">
                    <FileText size={15} />
                    <span>{reportFile ? reportFile.name : "report"}</span>
                    {scanState === "scanning" && <Loader2 size={14} className="spin" />}
                    {scanState === "done" && <CheckCircle2 size={14} className="ok" />}
                    {scanState === "error" && <AlertTriangle size={14} className="err" />}
                  </div>

                  {scanState === "scanning" && (
                    <p className="muted-sm">Reading document with OCR and matching against her baseline…</p>
                  )}

                  {scanState === "error" && <p className="muted-sm">{scanErrorText}</p>}

                  {scanState === "done" && scanResult && (
                    <>
                      <LabReportChart metrics={scanResult.metrics} />
                      <table className="marker-table">
                        <thead><tr><th>Marker</th><th>Value</th><th>Unit</th><th></th></tr></thead>
                        <tbody>
                          {scanResult.metrics.map((m, i) => (
                            <tr key={`${m.biomarker_name}-${i}`}>
                              <td>{m.biomarker_name}{m.extracted_abbreviation ? ` (${m.extracted_abbreviation})` : ""}</td>
                              <td>{m.value}</td>
                              <td>{m.unit || "—"}</td>
                              <td><span className={`flag-pill ${STATUS_TO_FLAG[m.status] || "flagged"}`}>{(STATUS_TO_FLAG[m.status] || "flagged")}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button className="qa-btn" onClick={resetScan}>Scan another report <ChevronRight size={14} /></button>
                    </>
                  )}
                </div>
              )}

              <div className="past-reports">
                <h3>Previous reports</h3>
                <ul>
                  {pastReports.length === 0 && <li><span className="muted-sm">No reports uploaded yet.</span></li>}
                  {pastReports.map((r) => (
                    <li key={r.id}>
                      <FileText size={15} />
                      <div><strong>{r.name}</strong><span>{r.date}</span></div>
                      <span className={`flag-pill ${r.status}`}>{r.statusLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activePage === "twin" && (
            <div className="twin-shell">
              <section className="twin-profile-card">
                <div className="twin-avatar"><User size={22} color="#fff" /></div>
                <div className="twin-profile-info">
                  <h2>{displayName}'s Digital Health Twin</h2>
                  <p className="muted-sm">Cycle day 18 · Luteal phase · PCOS pattern &amp; iron levels being monitored</p>
                </div>
                <span className="twin-badge"><HeartPulse size={13} />Twin active</span>
              </section>

              <div className="twin-grid">
                <section className="twin-card">
                  <div className="twin-card-head"><Droplets size={15} /><h3>Reproductive context</h3></div>
                  <p className="muted-sm">Last 6 logged cycle lengths (days) visualized with petal radial ring.</p>
                  <CycleRing lengths={DEMO_CYCLE_LENGTHS} />
                  <p className="muted-sm">Spread of 11 days across recent cycles - this is one factor behind the PCOS pattern flag below.</p>
                </section>

                <section className="twin-card">
                  <div className="twin-card-head"><Activity size={15} /><h3>Symptoms &amp; events timeline</h3></div>
                  <ul className="twin-timeline">
                    {DEMO_SYMPTOM_TIMELINE.map((t) => (
                      <li key={t.id}>
                        <span className={`twin-tag twin-tag-${t.tag.toLowerCase()}`}>{t.tag}</span>
                        <div><strong>{t.text}</strong><span>{t.date}</span></div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="twin-card">
                  <div className="twin-card-head"><FileText size={15} /><h3>Latest biomarkers</h3></div>
                  {scanResult ? (
                    <>
                      <LabReportChart metrics={scanResult.metrics} />
                      <table className="marker-table">
                        <thead><tr><th>Marker</th><th>Value</th><th></th></tr></thead>
                        <tbody>
                          {scanResult.metrics.slice(0, 5).map((m, i) => (
                            <tr key={`${m.biomarker_name}-${i}`}>
                              <td>{m.biomarker_name}</td>
                              <td>{m.value} {m.unit || ""}</td>
                              <td><span className={`flag-pill ${STATUS_TO_FLAG[m.status] || "flagged"}`}>{STATUS_TO_FLAG[m.status] || "flagged"}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p className="muted-sm">No report scanned this session yet. <a href="#reports" onClick={goTo("reports")}>Scan a lab report</a> to populate this from real OCR output.</p>
                  )}
                </section>

                <section className="twin-card twin-card-wide">
                  <div className="twin-card-head"><ShieldCheck size={15} /><h3>Risk signals &amp; explainability</h3></div>
                  <p className="muted-sm">
                    {sessionRiskSignals.length > 0
                      ? "Generated by this session's Risk Prediction agent - a transparent rule-based pattern matcher, not a diagnosis."
                      : "No signal from this session yet - showing example output. Ask the assistant about symptoms or hormonal patterns to generate a real one."}
                  </p>
                  {(sessionRiskSignals.length > 0 ? sessionRiskSignals : DEMO_RISK_SIGNALS).map((r, i) => (
                    <div className={`risk-card risk-card-${(r.level || "L0").toLowerCase()}`} key={i}>
                      <div className="risk-card-head">
                        <span className={`level-pill level-${(r.level || "L0").toLowerCase()}`}>{r.level} · {LEVEL_LABEL[r.level] || "Flag"}</span>
                        <strong>{r.domain}</strong>
                        {r.example && <span className="example-tag">Example</span>}
                      </div>
                      <ul className="factor-list">
                        {(r.factors || []).map((f, fi) => <li key={fi}>{f}</li>)}
                      </ul>
                      <p className="muted-sm"><em>{r.confidence_note}</em></p>
                      {r.next_step && <p className="risk-next"><Target size={13} />{r.next_step}</p>}
                      {r.when_to_seek_care && <p className="risk-next"><AlertTriangle size={13} />Seek care: {r.when_to_seek_care}</p>}
                    </div>
                  ))}
                </section>

                <section className="twin-card twin-card-wide">
                  <div className="twin-card-head"><ClipboardCheck size={15} /><h3>Care plan</h3></div>
                  {sessionCarePlan ? (
                    <>
                      <FormattedMessage text={cleanCarePlanText(sessionCarePlan.summary)} />
                      {sessionCarePlan.next_step && <p className="risk-next"><Target size={13} />{sessionCarePlan.next_step}</p>}
                      {(sessionCarePlan.evidence || []).length > 0 && (
                        <div className="evidence-list">
                          {sessionCarePlan.evidence.map((e, i) => (
                            <div key={i} className="evidence-item"><BookOpen size={12} /> {e.source}</div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="muted-sm">Once the Care Plan agent combines a reply with risk factors and evidence, it will appear here automatically. Try asking the assistant something health-related first.</p>
                  )}
                </section>
              </div>
            </div>
          )}

          {activePage === "reminders" && (
            <RemindersPage isGuest={!!user?.guest} />
          )}

          {activePage === "activity" && (
            <ActivityTrackerPage isGuest={!!user?.guest} />
          )}

          {activePage === "clinician" && (
            <div className="clinician-shell">
              <div className="clinician-banner">
                <Info size={15} />
                <span>Preview build: patient roster below is demo data shaped to match the backend's real schema (PatientProfile / RiskSignal / CarePlan / AgentEventLog) - wiring this to real accounts just needs clinician auth on top of the existing tables.</span>
              </div>

              <div className="clinician-grid">
                <section className="roster-card">
                  <div className="twin-card-head"><Users size={15} /><h3>Patient roster</h3></div>
                  <ul className="roster-list">
                    {DEMO_PATIENTS.map((p) => (
                      <li
                        key={p.id}
                        className={selectedPatientId === p.id ? "selected" : ""}
                        onClick={() => setSelectedPatientId(p.id)}
                      >
                        <span className={`level-dot level-${p.level.toLowerCase()}`}></span>
                        <div className="roster-info">
                          <strong>{p.name}</strong>
                          <span>{p.age} yrs · {p.concern}</span>
                        </div>
                        <div className="roster-meta">
                          <span className={`level-pill level-${p.level.toLowerCase()}`}>{p.level}</span>
                          <span className="muted-sm">{p.adherence}% adherence</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="patient-detail-card">
                  {(() => {
                    const patient = DEMO_PATIENTS.find((p) => p.id === selectedPatientId);
                    const detail = DEMO_PATIENT_DETAIL[selectedPatientId];
                    if (!patient) return <p className="muted-sm">Select a patient from the roster.</p>;
                    return (
                      <>
                        <div className="patient-detail-head">
                          <div>
                            <h3>{patient.name}</h3>
                            <p className="muted-sm">{patient.age} yrs · {patient.concern} · Last active {patient.lastActive}</p>
                          </div>
                          <span className={`level-pill level-${patient.level.toLowerCase()}`}>{patient.level} · {LEVEL_LABEL[patient.level]}</span>
                        </div>

                        {detail ? (
                          <>
                            <h4><ShieldCheck size={14} />Risk signals</h4>
                            {detail.riskSignals.map((r, i) => (
                              <div className={`risk-card risk-card-${r.level.toLowerCase()}`} key={i}>
                                <div className="risk-card-head">
                                  <span className={`level-pill level-${r.level.toLowerCase()}`}>{r.level}</span>
                                  <strong>{r.domain}</strong>
                                </div>
                                <ul className="factor-list">{r.factors.map((f, fi) => <li key={fi}>{f}</li>)}</ul>
                                {r.next_step && <p className="risk-next"><Target size={13} />{r.next_step}</p>}
                              </div>
                            ))}

                            <h4><ClipboardCheck size={14} />Care plan</h4>
                            <FormattedMessage text={cleanCarePlanText(detail.carePlan.summary)} />
                            <p className="risk-next"><Target size={13} />{detail.carePlan.next_step}</p>

                            <h4><Brain size={14} />Agent event log (auditability)</h4>
                            <ul className="event-log">
                              {detail.eventLog.map((e, i) => (
                                <li key={i}><span className="event-time">{e.time}</span><strong>{e.agent}</strong><span>{e.note}</span></li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p className="muted-sm">No detailed history recorded for this demo patient yet.</p>
                        )}
                      </>
                    );
                  })()}
                </section>
              </div>
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className="toast"><CheckCircle2 size={15} /><span>{toast}</span></div>
      )}
    </div>
  );
}