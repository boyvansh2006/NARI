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
  { name: "Router", note: "Picks specialist clinical agent" },
  { name: "Clinical Knowledge / RAG", note: "Grounds response in WHO/MoHFW evidence" },
  { name: "Specialist Agent", note: "Symptom, Lab, Nutrition, Mental health" },
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
const LEVEL_LABEL = { L0: "Info", L1: "Monitor", L2: "Clinical review", L3: "Urgent", L4: "Safety stop" };

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
    text: "Hello, I am NARI. How can I help you today? You can ask about your symptoms, cycle patterns, lab reports, or nutrition.",
  },
];

const SUGGESTED_PROMPTS = [
  "Explain my latest ferritin flag",
  "Nutrition plan for luteal phase",
  "I have mild pelvic cramps today",
  "Check my medication interactions",
];

const INITIAL_NOTIFICATIONS = [];
const DEMO_PROFILE = { full_name: "Ananya", cycle_day: 18, cycle_phase: "Luteal phase" };

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

function saveSession(user) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function renderInline(text) {
  const parts = [];
  const regex = /(\*\*([^*]+)\*\*|_([^_]+)_)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={`bold-${match.index}`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={`italic-${match.index}`}>{match[3]}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

function cleanCarePlanText(summary) {
  if (!summary) return "";
  if (typeof summary !== "string") {
    try {
      return JSON.stringify(summary, null, 2);
    } catch {
      return String(summary);
    }
  }
  const lines = summary.split("\n");
  const cleaned = lines.map((l) => {
    let line = l.trim();
    if (line.startsWith("- ")) line = line.substring(2).trim();
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < 30 && !line.startsWith("###")) {
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      return `### ${key}\n${val}`;
    }
    return line;
  });
  return cleaned.join("\n\n");
}

function FormattedMessage({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="chat-bullet-list">
          {currentList.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }
    if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# ")) {
      flushList();
      const headingText = line.replace(/^#+\s*/, "");
      elements.push(
        <div key={`h-${idx}`} className="chat-section-header">
          {renderInline(headingText)}
        </div>
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
          background:linear-gradient(150deg,#0A3B31 0%,#0F5144 60%,#134E4A 100%);
          font-family:'DM Sans',-apple-system,sans-serif; padding:24px;
        }
        .guest-gate-shell *{ box-sizing:border-box; }
        .guest-gate-card{
          background:#fff; border-radius:20px; padding:36px 34px; width:100%; max-width:380px;
          box-shadow:0 20px 48px rgba(10,59,49,0.3); text-align:center; animation: guest-rise .3s ease;
          border:1px solid #E2EBE7;
        }
        @keyframes guest-rise{ from{opacity:0; transform:translateY(12px);} to{opacity:1; transform:translateY(0);} }
        .guest-gate-mark{
          width:52px; height:52px; border-radius:16px; margin:0 auto 18px;
          background:#E6F4F1; color:#0F5144; display:flex; align-items:center; justify-content:center;
        }
        .guest-gate-card h2{
          font-family:'Sora',sans-serif; font-size:22px; font-weight:800; color:#0F2922; margin:0 0 8px;
        }
        .guest-gate-card p{ color:#527068; font-size:13.5px; line-height:1.6; margin:0 0 22px; }
        .guest-gate-input{
          width:100%; border:1.5px solid #CBD5E1; border-radius:12px; padding:12px 14px;
          font-size:14px; font-family:inherit; outline:none; margin-bottom:18px; text-align:center;
          transition:border-color .2s ease, box-shadow .2s ease;
        }
        .guest-gate-input:focus{ border-color:#0F5144; box-shadow:0 0 0 3px rgba(15,81,68,0.12); }
        .guest-gate-actions{ display:flex; flex-direction:column; gap:10px; }
        .guest-gate-confirm{
          width:100%; background:#0F5144; color:#fff; border:none; border-radius:12px;
          padding:13px 0; font-family:'Sora',sans-serif; font-weight:700; font-size:14px;
          cursor:pointer; transition:all .18s ease;
        }
        .guest-gate-confirm:hover{ background:#0A3B31; transform:translateY(-1px); }
        .guest-gate-back{
          width:100%; background:none; border:none; color:#527068; font-size:13px; font-weight:600; cursor:pointer;
          padding:6px 0;
        }
      `}</style>
      <div className="guest-gate-card">
        <div className="guest-gate-mark"><HeartPulse size={24} /></div>
        <h2>What should we call you?</h2>
        <p>Guest sessions are stored locally in your browser. We'll use your name to personalize your health twin dashboard.</p>
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
          <button className="guest-gate-confirm" onClick={onConfirm}>Continue to Dashboard</button>
          <button className="guest-gate-back" onClick={onCancel}>Back to Home</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => loadSession());
  const [view, setView] = useState(() => (loadSession() ? "app" : "landing"));
  const [activePage, setActivePage] = useState("dashboard");
  const [guestNameInput, setGuestNameInput] = useState("");

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [useServerStt, setUseServerStt] = useState(false);
  const [useServerTts, setUseServerTts] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [toast, setToast] = useState(null);

  const [reportFile, setReportFile] = useState(null);
  const [scanState, setScanState] = useState("idle");
  const [scanResult, setScanResult] = useState(null);
  const [scanErrorText, setScanErrorText] = useState("");
  const [pastReports, setPastReports] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  const [sessionRiskSignals, setSessionRiskSignals] = useState([]);
  const [sessionCarePlan, setSessionCarePlan] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState("p1");

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    saveSession(user);
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    getVoiceStatus()
      .then((st) => {
        setUseServerStt(!!st.stt_available);
        setUseServerTts(!!st.tts_available);
        const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
        const hasWebSpeechRec = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        setMicSupported(st.stt_available ? hasMedia : hasWebSpeechRec);
        const hasWebSpeechSynth = typeof window !== "undefined" && "speechSynthesis" in window;
        setVoiceSupported(st.tts_available || hasWebSpeechSynth);
      })
      .catch(() => {
        const hasWebSpeechRec = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        const hasWebSpeechSynth = typeof window !== "undefined" && "speechSynthesis" in window;
        setMicSupported(hasWebSpeechRec);
        setVoiceSupported(hasWebSpeechSynth);
      });
  }, []);

  const handleSignIn = (userData) => {
    setUser(userData);
    setView("app");
  };

  const handleSignOut = () => {
    setUser(null);
    setToken(null);
    setView("landing");
    setPastReports([]);
    setMessages(INITIAL_MESSAGES);
  };

  const handleGuestConfirmed = () => {
    const trimmed = guestNameInput.trim();
    setUser({ guest: true, fullName: trimmed || "Guest", email: null });
    setView("app");
  };

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  };

  const copyMessage = (id, text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        showToast("Response copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  };

  const speak = (text) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        window.speechSynthesis.resume();
        const clean = text.replace(/[*#_`>]/g, " ").trim();
        const utt = new SpeechSynthesisUtterance(clean);
        utt.rate = 1.0;
        utt.pitch = 1.05;
        const voices = window.speechSynthesis.getVoices();
        const chosenVoice = pickFemaleVoice(voices);
        if (chosenVoice) utt.voice = chosenVoice;
        window.speechSynthesis.speak(utt);
      }, 70);
    } catch {
      /* ignore */
    }
  };

  const handleSend = async (overrideText) => {
    const msgText = (overrideText || input).trim();
    if (!msgText || isTyping) return;

    const userMsg = { id: Date.now(), sender: "user", text: msgText };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput("");
    setIsTyping(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.sender === "assistant" ? "assistant" : "user",
        content: m.text,
      }));

      const res = await sendChatMessage(msgText, historyPayload, DEMO_PROFILE, user?.id || null);
      const assistantMsg = {
        id: Date.now() + 1,
        sender: "assistant",
        agent: res.agent || "NARI",
        text: res.reply,
        urgent: !!res.urgent,
        evidence: res.evidence || [],
        riskSignal: res.risk_signal || null,
        carePlan: res.care_plan || null,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (res.risk_signal) {
        setSessionRiskSignals((prev) => [res.risk_signal, ...prev]);
      }
      if (res.care_plan) {
        setSessionCarePlan(res.care_plan);
      }
      if (speakEnabled) {
        speak(res.reply);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "assistant",
          agent: "System",
          text: "I could not process that request right now. Please verify your connection and try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: "assistant",
        agent: "NARI",
        text: "New consultation started. How can I support your health today?",
      },
    ]);
    showToast("Consultation reset");
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setReportFile(file);
    setScanState("scanning");
    setScanErrorText("");

    try {
      const data = await uploadReport(file);
      setScanResult(data);
      setScanState("done");
      showToast("Report processed successfully");

      const newRep = {
        id: data.report_id || `rep-${Date.now()}`,
        name: file.name,
        date: "Just now",
        status: deriveReportFlag(data.metrics),
        statusLabel: deriveReportFlag(data.metrics) === "flagged" ? "Flagged Markers" : "All Normal",
      };
      setPastReports((prev) => [newRep, ...prev]);
    } catch (err) {
      setScanState("error");
      setScanErrorText(err.message || "Failed to parse document. Please check the file and try again.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const resetScan = () => {
    setScanState("idle");
    setScanResult(null);
    setReportFile(null);
  };

  const goTo = (page) => (e) => {
    e?.preventDefault();
    setActivePage(page);
  };

  if (view === "landing") {
    return (
      <LandingPage
        onGetStarted={() => setView("login")}
        onSignIn={() => setView("login")}
        onGuest={() => setView("guest_gate")}
      />
    );
  }

  if (view === "guest_gate") {
    return (
      <GuestNameGate
        value={guestNameInput}
        onChange={setGuestNameInput}
        onConfirm={handleGuestConfirmed}
        onCancel={() => setView("landing")}
      />
    );
  }

  if (view === "login") {
    return (
      <LoginPage
        onSignIn={handleSignIn}
        onGuest={() => setView("guest_gate")}
        onBack={() => setView("landing")}
      />
    );
  }

  const displayName = user?.guest ? user?.fullName || "Guest" : user?.fullName || (user?.email ? user.email.split("@")[0] : "there");
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="app-shell">
      <style>{`
        :root{
          color-scheme: light;
          --forest-dark: #0A3B31;
          --deep-forest: #0F5144;
          --primary-emerald: #0F5144;
          --emerald-accent: #10B981;
          --emerald-dark: #059669;
          --mint-light: #E6F4F1;
          --mint-bg: #F0F7F4;
          --sand-bg: #F6FAF8;
          --card-white: #FFFFFF;
          --ink-primary: #0F2922;
          --ink-secondary: #1E3A34;
          --ink-muted: #527068;
          --line: #E2EBE7;
          --line-strong: #CBD5E1;
          --rose-alert: #DC2626;
          --amber-alert: #D97706;
          --font-head: 'Sora', sans-serif;
          --font-body: 'DM Sans', -apple-system, sans-serif;
          --shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 4px 14px rgba(15,81,68,0.05);
          --shadow-soft: 0 6px 24px rgba(15,81,68,0.07);
          --gradient-hero: linear-gradient(140deg, #0A3B31 0%, #0F5144 100%);
        }

        .app-shell{ color-scheme: light; }
        .app-shell button, .app-shell input, .app-shell select, .app-shell a{ color-scheme: light; }
        .app-shell *{ box-sizing:border-box; }
        .app-shell{
          display:flex; min-height:100vh; background:var(--sand-bg); color:var(--ink-secondary);
          font-family:var(--font-body); font-size:14.5px;
        }
        .app-shell h1,.app-shell h2,.app-shell h3,.app-shell h4{ font-family:var(--font-head); font-weight:700; color:var(--ink-primary); margin:0; }
        .app-shell a{ text-decoration:none; color:inherit; }
        .app-shell button{ font-family:inherit; cursor:pointer; }
        .app-shell ul{ list-style:none; margin:0; padding:0; }

        /* Sidebar */
        .sidebar{
          width:240px; flex-shrink:0; background:#fff; color:var(--ink-primary);
          display:flex; flex-direction:column; padding:24px 16px; position:fixed; top:0; bottom:0; left:0; height:100vh;
          border-right:1px solid var(--line); box-shadow:var(--shadow-card); z-index:10;
        }
        .brand{ display:flex; align-items:center; gap:10px; font-family:var(--font-head); font-weight:800; font-size:19px; padding:0 8px 26px; color:var(--deep-forest); }
        .brand-mark{
          width:28px; height:28px; border-radius:8px; background:var(--deep-forest);
          display:flex; align-items:center; justify-content:center; color:#E6F4F1; flex-shrink:0;
        }
        .sidebar-nav{ display:flex; flex-direction:column; gap:4px; flex:1; }
        .nav-item{
          display:flex; align-items:center; gap:11px; padding:10px 12px; border-radius:10px;
          font-family:var(--font-head); font-weight:600; font-size:13px; color:var(--ink-muted);
          transition:all .18s ease;
        }
        .nav-item:hover{ background:var(--mint-bg); color:var(--deep-forest); }
        .nav-item.active{ background:var(--deep-forest); color:#fff; }
        .nav-section-label{ padding:14px 12px 4px; font-size:10.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-muted); opacity:0.7; }
        .nav-item-secondary{ font-size:12.5px; padding:9px 12px; }

        .sidebar-foot{ border-top:1px solid var(--line); padding-top:16px; display:flex; flex-direction:column; gap:10px; }
        .user-chip{ display:flex; align-items:center; gap:10px; }
        .user-avatar{
          width:32px; height:32px; border-radius:50%; background:var(--deep-forest);
          display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#fff;
        }
        .user-name{ font-family:var(--font-head); font-weight:700; font-size:13px; color:var(--ink-primary); }
        .user-sub{ font-size:11px; color:var(--ink-muted); }
        .signout-btn{
          display:flex; align-items:center; gap:7px; padding:8px 10px; border-radius:8px;
          border:1px solid var(--line); background:#FAFCFB; color:var(--ink-muted); font-size:12px; font-weight:600;
          transition:all .15s ease;
        }
        .signout-btn:hover{ background:#FEE2E2; color:#991B1B; border-color:#FECACA; }

        /* Topbar & Main */
        .main-col{ flex:1; display:flex; flex-direction:column; min-width:0; margin-left:240px; }
        .topbar{
          display:flex; align-items:center; justify-content:space-between; padding:16px 36px;
          border-bottom:1px solid var(--line); background:rgba(246,250,248,0.92); backdrop-filter:blur(8px);
          position:sticky; top:0; z-index:9;
        }
        .topbar-title{ font-family:var(--font-head); font-weight:700; font-size:18px; color:var(--ink-primary); }
        .topbar-actions{ display:flex; align-items:center; gap:12px; position:relative; }
        .guest-banner{
          background:#FEF3C7; color:#92400E; font-size:12px; padding:5px 12px; border-radius:100px;
          display:flex; align-items:center; gap:8px; font-weight:600; border:1px solid #FDE68A;
        }
        .guest-banner button{
          background:#92400E; color:#fff; border:none; border-radius:100px; padding:2px 8px; font-size:11px; font-weight:700;
        }
        .icon-btn{
          position:relative; width:38px; height:38px; border-radius:10px; border:1px solid var(--line);
          background:#fff; display:flex; align-items:center; justify-content:center; color:var(--ink-primary);
          transition:all .15s ease;
        }
        .icon-btn:hover{ background:var(--mint-bg); border-color:var(--deep-forest); }
        .badge{
          position:absolute; top:-4px; right:-4px; background:var(--rose-alert); color:#fff;
          font-size:10px; font-weight:700; border-radius:100px; padding:1px 5px; font-family:var(--font-head);
        }
        .notif-panel{
          position:absolute; top:48px; right:0; width:320px; background:#fff; border:1px solid var(--line);
          border-radius:16px; box-shadow:var(--shadow-soft); z-index:21; overflow:hidden;
        }
        .notif-panel-head{ display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--line); font-family:var(--font-head); font-weight:700; font-size:13.5px; color:var(--ink-primary); }
        .notif-panel-head button{ background:none; border:none; color:var(--ink-muted); }
        .notif-panel ul{ max-height:300px; overflow-y:auto; }
        .notif-panel li{ display:flex; gap:10px; padding:12px 16px; border-bottom:1px solid var(--line); cursor:pointer; }
        .notif-panel li:last-child{ border-bottom:none; }
        .notif-panel li:hover{ background:var(--mint-bg); }
        .notif-panel li .dot{ width:7px; height:7px; border-radius:50%; background:var(--line); margin-top:5px; flex-shrink:0; }
        .notif-panel li.unread .dot{ background:var(--emerald-dark); }
        .notif-panel li strong{ display:block; font-size:12.5px; font-weight:600; color:var(--ink-primary); }
        .notif-panel li span{ font-size:11px; color:var(--ink-muted); }

        .page{ flex:1; padding:28px 36px 56px; max-width:1040px; width:100%; margin:0 auto; }
        .toast{
          position:fixed; bottom:24px; right:24px; background:var(--deep-forest); color:#fff;
          padding:12px 18px; border-radius:12px; display:flex; align-items:center; gap:8px;
          font-size:13px; font-weight:600; box-shadow:0 10px 24px rgba(10,59,49,0.3); z-index:30; animation:rise .2s ease;
        }
        @keyframes rise{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:translateY(0);} }

        /* Dashboard */
        .welcome-card{
          background:var(--gradient-hero); color:#fff; border-radius:20px; padding:28px 32px;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:20px; margin-bottom:24px;
          box-shadow:var(--shadow-card);
        }
        .eyebrow-sm{ font-family:var(--font-head); font-weight:700; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#A7F3D0; margin:0 0 4px; }
        .welcome-card h1{ color:#fff; font-size:24px; font-weight:800; }
        .muted{ color:rgba(230,244,241,0.85); font-size:13.5px; margin-top:4px; }
        .quick-actions{ display:flex; gap:10px; flex-wrap:wrap; }
        .qa-btn{
          display:inline-flex; align-items:center; gap:7px; padding:10px 16px; border-radius:10px;
          font-family:var(--font-head); font-weight:700; font-size:13px; background:#fff; color:var(--deep-forest); border:none;
          transition:all .15s ease;
        }
        .qa-btn:hover{ transform:translateY(-1px); background:var(--mint-bg); }
        .qa-btn.primary{ background:var(--emerald-accent); color:#fff; }
        .qa-btn.primary:hover{ background:var(--emerald-dark); }

        .stat-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
        .stat-card{
          background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px 20px; box-shadow:var(--shadow-card);
          transition:all .15s ease;
        }
        .stat-card:hover{ border-color:var(--emerald-accent); transform:translateY(-2px); }
        .stat-icon.purple{ color:var(--deep-forest); }
        .stat-icon.teal{ color:var(--emerald-dark); }
        .stat-icon.rose{ color:var(--amber-alert); }
        .stat-icon.violet{ color:var(--ink-primary); }
        .stat-label{ font-size:12px; font-weight:600; color:var(--ink-muted); margin-top:10px; }
        .stat-value{ font-family:var(--font-head); font-weight:800; font-size:20px; color:var(--ink-primary); margin-top:3px; }
        .stat-sub{ font-size:11.5px; color:var(--ink-muted); margin-top:3px; }

        .activity-card{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px 24px; box-shadow:var(--shadow-card); }
        .activity-card h3{ font-size:15px; margin-bottom:14px; }
        .activity-list li{ display:flex; gap:12px; padding:10px 0; border-bottom:1px dashed var(--line); align-items:flex-start; }
        .activity-list li:last-child{ border-bottom:none; }
        .activity-list .dot{ width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0; }
        .dot.rose{ background:var(--amber-alert); }
        .dot.teal{ background:var(--emerald-dark); }
        .dot.purple{ background:var(--deep-forest); }
        .activity-list strong{ display:block; font-size:13px; color:var(--ink-primary); font-weight:600; }
        .activity-list span{ font-size:11.5px; color:var(--ink-muted); }

        /* Chat Layout */
        .chat-shell{
          display:flex; flex-direction:column; height:calc(100vh - 150px); max-height:740px;
          background:#fff; border:1px solid var(--line); border-radius:20px; overflow:hidden; box-shadow:var(--shadow-card);
        }
        .chat-toolbar{
          display:flex; align-items:center; justify-content:space-between; padding:14px 20px;
          border-bottom:1px solid var(--line); background:#FAFCFB;
        }
        .chat-toolbar-left{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--deep-forest); font-weight:700; }
        .chat-toolbar-right{ display:flex; align-items:center; gap:8px; }
        .tool-btn{
          display:flex; align-items:center; gap:6px; border:1px solid var(--line); background:#fff; border-radius:8px;
          padding:6px 12px; font-size:12px; font-weight:600; color:var(--ink-muted); transition:all .15s ease;
        }
        .tool-btn:hover{ background:var(--mint-bg); color:var(--deep-forest); }
        .tool-btn.on{ background:var(--mint-light); color:var(--deep-forest); border-color:var(--emerald-accent); }

        .chat-window{ flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; background:#FAFCFB; }
        .msg-row{ display:flex; flex-direction:column; max-width:80%; }
        .msg-row.user{ align-self:flex-end; align-items:flex-end; }
        .msg-row.assistant{ align-self:flex-start; align-items:flex-start; }
        .agent-tag{ font-family:var(--font-head); font-weight:700; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:var(--deep-forest); margin-bottom:5px; padding-left:4px; }
        .bubble{ padding:14px 18px; border-radius:16px; font-size:14px; line-height:1.6; position:relative; }
        .bubble.user{ background:var(--deep-forest); color:#fff; border-bottom-right-radius:4px; white-space:pre-wrap; }
        .bubble.assistant{ background:#FFFFFF; color:var(--ink-primary); border:1px solid var(--line); border-bottom-left-radius:4px; box-shadow:var(--shadow-card); }
        .bubble.assistant.urgent{ background:#FEF2F2; color:#991B1B; border:1.5px solid #F87171; }

        .chat-formatted-body{ display:flex; flex-direction:column; gap:8px; }
        .chat-paragraph{ margin:0; font-size:14px; line-height:1.6; }
        .chat-section-header{ font-size:13.5px; font-weight:800; color:var(--ink-primary); margin:8px 0 2px; }
        .chat-bullet-list{ margin:3px 0 6px; padding-left:18px; display:flex; flex-direction:column; gap:4px; list-style:disc; }
        .chat-bullet-list li{ font-size:13.5px; line-height:1.55; }

        .msg-footer{ display:flex; align-items:center; gap:8px; margin-top:8px; padding-top:6px; border-top:1px dashed var(--line); }
        .msg-action-btn{
          display:inline-flex; align-items:center; gap:5px; border:none; background:none; color:var(--ink-muted);
          font-size:11.5px; font-weight:600; padding:3px 6px; border-radius:6px; cursor:pointer; transition:all .15s ease;
        }
        .msg-action-btn:hover{ background:var(--mint-light); color:var(--deep-forest); }

        .bubble.typing{ display:flex; gap:5px; padding:12px 16px; }
        .bubble.typing span{ width:6px; height:6px; border-radius:50%; background:var(--ink-muted); opacity:0.5; animation:blink 1.2s infinite ease-in-out; }
        .bubble.typing span:nth-child(2){ animation-delay:0.2s; } .bubble.typing span:nth-child(3){ animation-delay:0.4s; }
        @keyframes blink{ 0%,80%,100%{opacity:0.25;} 40%{opacity:0.9;} }

        .risk-flag{ display:flex; align-items:flex-start; gap:7px; margin-top:8px; padding:8px 12px; border-radius:10px; font-size:12px; line-height:1.45; background:#FEF3C7; color:#92400E; border:1px solid #FDE68A; }
        .risk-flag svg{ flex-shrink:0; margin-top:2px; }
        .risk-flag.risk-l2, .risk-flag.risk-l3{ background:#FEF2F2; color:#991B1B; border-color:#FECACA; }

        .expand-panel{ margin-top:8px; border:1px solid var(--line); border-radius:10px; background:#FAFCFB; }
        .expand-panel summary{ list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 11px; font-size:11.5px; font-weight:700; color:var(--deep-forest); }
        .expand-panel summary::-webkit-details-marker{ display:none; }
        .expand-panel summary::after{ content:"+"; font-size:13px; font-weight:700; color:var(--ink-muted); }
        .expand-panel[open] summary::after{ content:"−"; }
        .expand-panel .expand-body{ padding:0 11px 8px; font-size:11.5px; color:var(--ink-muted); line-height:1.5; }
        .expand-panel .expand-body ul{ margin:0; padding-left:14px; }

        .chat-disclaimer{ display:flex; align-items:center; gap:6px; padding:6px 20px; font-size:11px; color:var(--ink-muted); background:#F0F7F4; border-top:1px solid var(--line); }
        .chat-disclaimer svg{ flex-shrink:0; color:var(--deep-forest); }
        .chip-row{ display:flex; flex-wrap:wrap; gap:8px; padding:0 20px 12px; }
        .chip{ border:1px solid var(--line); background:#fff; border-radius:100px; padding:7px 14px; font-size:12px; color:var(--deep-forest); font-weight:600; transition:all .15s ease; }
        .chip:hover{ background:var(--mint-bg); border-color:var(--deep-forest); }

        .chat-input-row{ display:flex; align-items:center; gap:10px; padding:14px 20px; border-top:1px solid var(--line); background:#fff; }
        .mic-btn{ width:40px; height:40px; border-radius:50%; border:1px solid var(--line); background:#FAFCFB; display:flex; align-items:center; justify-content:center; color:var(--deep-forest); flex-shrink:0; transition:all .15s ease; }
        .mic-btn.listening{ background:var(--rose-alert); color:#fff; border-color:transparent; }
        .mic-btn.disabled{ opacity:0.4; cursor:not-allowed; }
        .mic-btn:hover{ background:var(--mint-bg); }
        .chat-input{ flex:1; border:1.5px solid var(--line); border-radius:100px; padding:10px 18px; font-size:14px; font-family:var(--font-body); outline:none; transition:all .15s ease; }
        .chat-input:focus{ border-color:var(--deep-forest); box-shadow:0 0 0 3px rgba(15,81,68,0.1); }
        .send-btn{ width:40px; height:40px; border-radius:50%; background:var(--deep-forest); color:#fff; border:none; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .15s ease; }
        .send-btn:hover{ background:var(--forest-dark); transform:translateY(-1px); }

        /* Reports */
        .reports-shell{ display:flex; flex-direction:column; gap:20px; }
        .dropzone{
          border:2px dashed var(--line-strong); border-radius:20px; background:#fff; padding:40px 20px;
          display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; color:var(--ink-muted); cursor:pointer;
          transition:all .18s ease;
        }
        .dropzone:hover, .dropzone.active{ border-color:var(--deep-forest); background:var(--mint-bg); }
        .dropzone svg{ color:var(--deep-forest); }
        .dropzone strong{ color:var(--ink-primary); }
        .scan-card{ background:#fff; border:1px solid var(--line); border-radius:18px; padding:22px; box-shadow:var(--shadow-card); }
        .scan-card-head{ display:flex; align-items:center; gap:8px; font-family:var(--font-head); font-weight:700; font-size:14px; color:var(--ink-primary); margin-bottom:10px; }
        .spin{ animation:spin 1s linear infinite; color:var(--deep-forest); }
        .ok{ color:var(--emerald-dark); }
        .err{ color:var(--rose-alert); }
        .marker-table{ width:100%; border-collapse:collapse; margin:14px 0; font-size:13.5px; }
        .marker-table th{ text-align:left; font-family:var(--font-head); font-size:11.5px; text-transform:uppercase; letter-spacing:0.05em; color:var(--ink-muted); padding:8px 6px; border-bottom:1px solid var(--line); }
        .marker-table td{ padding:10px 6px; border-bottom:1px solid var(--line); color:var(--ink-primary); }
        .flag-pill{ font-family:var(--font-head); font-weight:700; font-size:11px; padding:3px 9px; border-radius:100px; }
        .flag-pill.low{ background:#FEF3C7; color:#92400E; }
        .flag-pill.high{ background:#FEE2E2; color:#991B1B; }
        .flag-pill.normal{ background:#D1FAE5; color:#065F46; }
        .flag-pill.flagged{ background:#FEF3C7; color:#92400E; }
        .past-reports{ background:#fff; border:1px solid var(--line); border-radius:18px; padding:22px; box-shadow:var(--shadow-card); }
        .past-reports h3{ font-size:14.5px; margin-bottom:12px; }
        .past-reports li{ display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px dashed var(--line); }
        .past-reports li:last-child{ border-bottom:none; }
        .past-reports li svg{ color:var(--deep-forest); flex-shrink:0; }
        .past-reports li > div{ flex:1; }
        .past-reports li strong{ display:block; font-size:13px; color:var(--ink-primary); font-weight:600; }
        .past-reports li span{ font-size:11.5px; color:var(--ink-muted); }

        /* Pipeline Visual */
        .pipeline-card{ background:#fff; border:1px solid var(--line); border-radius:18px; padding:22px 24px; margin-bottom:24px; box-shadow:var(--shadow-card); }
        .pipeline-head{ display:flex; align-items:center; gap:8px; color:var(--deep-forest); }
        .pipeline-head h3{ font-size:14px; margin:0; color:var(--ink-primary); font-weight:700; }
        .pipeline-row{ display:flex; align-items:stretch; gap:4px; overflow-x:auto; margin-top:14px; padding-bottom:4px; }
        .pipeline-step{ display:flex; align-items:center; flex-shrink:0; }
        .pipeline-step-inner{
          display:flex; align-items:center; gap:9px; background:var(--sand-bg); border:1px solid var(--line); border-radius:12px; padding:9px 12px; min-width:148px;
        }
        .pipeline-index{
          width:20px; height:20px; border-radius:50%; background:var(--deep-forest);
          color:#fff; font-family:var(--font-head); font-weight:700; font-size:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .pipeline-step-inner strong{ display:block; font-size:11.5px; color:var(--ink-primary); font-weight:700; }
        .pipeline-step-inner span{ font-size:10.5px; color:var(--ink-muted); }
        .pipeline-arrow{ color:var(--line-strong); flex-shrink:0; margin:0 2px; }

        /* Digital Health Twin */
        .twin-shell{ display:flex; flex-direction:column; gap:20px; }
        .twin-profile-card{ display:flex; align-items:center; gap:16px; background:var(--gradient-hero); border-radius:20px; padding:22px 26px; color:#fff; }
        .twin-avatar{ width:42px; height:42px; border-radius:50%; background:rgba(255,255,255,0.16); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .twin-profile-info h2{ color:#fff; font-size:17px; }
        .twin-profile-info .muted-sm{ color:rgba(230,244,241,0.85); margin-top:3px; }
        .twin-badge{ margin-left:auto; display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.16); border-radius:100px; padding:6px 12px; font-size:11.5px; font-weight:700; flex-shrink:0; }
        .twin-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .twin-card{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:20px 22px; box-shadow:var(--shadow-card); }
        .twin-card-wide{ grid-column:1 / -1; }
        .twin-card-head{ display:flex; align-items:center; gap:8px; color:var(--deep-forest); margin-bottom:10px; }
        .twin-card-head h3{ font-size:14px; margin:0; color:var(--ink-primary); font-weight:700; }
        .twin-timeline{ display:flex; flex-direction:column; gap:10px; }
        .twin-timeline li{ display:flex; align-items:flex-start; gap:10px; }
        .twin-timeline li strong{ display:block; font-size:12.5px; color:var(--ink-primary); font-weight:600; }
        .twin-timeline li span{ font-size:11px; color:var(--ink-muted); }
        .twin-tag{ flex-shrink:0; font-family:var(--font-head); font-weight:700; font-size:10px; padding:2px 7px; border-radius:6px; }
        .twin-tag-symptom{ background:#FEF2F2; color:#991B1B; }
        .twin-tag-lab{ background:#D1FAE5; color:#065F46; }
        .twin-tag-lifestyle{ background:#F0F7F4; color:var(--deep-forest); }

        .risk-card{ border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin-bottom:10px; background:#fff; }
        .risk-card:last-child{ margin-bottom:0; }
        .risk-card-head{ display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .risk-card-head strong{ font-family:var(--font-head); color:var(--ink-primary); font-size:13.5px; }
        .example-tag{ margin-left:auto; font-size:10px; font-weight:700; color:var(--ink-muted); border:1px solid var(--line); border-radius:100px; padding:2px 8px; }
        .level-pill{ font-family:var(--font-head); font-weight:700; font-size:10.5px; padding:3px 9px; border-radius:100px; flex-shrink:0; }
        .level-l0{ background:#D1FAE5; color:#065F46; } .level-l1{ background:#FEF3C7; color:#92400E; }
        .level-l2{ background:#FEE2E2; color:#991B1B; } .level-l3{ background:#991B1B; color:#fff; }
        .risk-card-l0{ border-left:4px solid var(--emerald-dark); } .risk-card-l1{ border-left:4px solid var(--amber-alert); }
        .risk-card-l2{ border-left:4px solid var(--rose-alert); } .risk-card-l3{ border-left:4px solid #991B1B; }
        .factor-list{ margin:0 0 8px; padding-left:16px; font-size:12.5px; color:var(--ink-secondary); }
        .factor-list li{ margin-bottom:3px; }
        .risk-next{ display:flex; align-items:flex-start; gap:6px; font-size:12.5px; color:var(--ink-muted); margin-top:6px; line-height:1.5; }
        .risk-next svg{ flex-shrink:0; margin-top:2px; color:var(--deep-forest); }

        /* Clinician Portal */
        .clinician-banner{ display:flex; align-items:flex-start; gap:8px; background:#F0F7F4; color:var(--ink-muted); border:1px solid #D1FAE5; border-radius:14px; padding:12px 16px; font-size:12.5px; line-height:1.5; margin-bottom:18px; }
        .clinician-banner svg{ flex-shrink:0; margin-top:2px; color:var(--deep-forest); }
        .clinician-grid{ display:grid; grid-template-columns:300px 1fr; gap:18px; align-items:start; }
        .roster-card{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px; box-shadow:var(--shadow-card); }
        .roster-list{ display:flex; flex-direction:column; gap:4px; margin-top:8px; }
        .roster-list li{ display:flex; align-items:center; gap:8px; padding:10px 8px; border-radius:10px; cursor:pointer; transition:all .15s ease; }
        .roster-list li:hover{ background:var(--mint-bg); }
        .roster-list li.selected{ background:var(--mint-light); border-left:3px solid var(--deep-forest); }
        .roster-info{ flex:1; min-width:0; }
        .roster-info strong{ display:block; font-size:13px; color:var(--ink-primary); font-weight:600; }
        .roster-info span{ font-size:11px; color:var(--ink-muted); }
        .roster-meta{ display:flex; flex-direction:column; align-items:flex-end; gap:3px; flex-shrink:0; }
        .patient-detail-card{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px 24px; box-shadow:var(--shadow-card); }
        .patient-detail-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--line); }
        .patient-detail-head h3{ font-size:16px; }
        .patient-detail-card h4{ display:flex; align-items:center; gap:6px; font-family:var(--font-head); font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:var(--ink-muted); margin:18px 0 10px; }
        .patient-detail-card h4:first-of-type{ margin-top:0; }
        .event-log{ display:flex; flex-direction:column; gap:8px; }
        .event-log li{ display:flex; align-items:center; gap:8px; font-size:12px; padding:8px 0; border-bottom:1px dashed var(--line); }
        .event-log li:last-child{ border-bottom:none; }
        .event-time{ font-family:var(--font-head); font-weight:700; color:var(--deep-forest); font-size:11px; width:38px; flex-shrink:0; }
        .event-log li strong{ color:var(--ink-primary); width:160px; flex-shrink:0; }
        .event-log li span:last-child{ color:var(--ink-muted); }

        @media (max-width:900px){
          .sidebar{ width:68px; padding:16px 8px; }
          .main-col{ margin-left:68px; }
          .brand span:last-child, .nav-item span, .user-name, .user-sub, .signout-btn span{ display:none; }
          .nav-section-label{ display:none; }
          .brand{ justify-content:center; padding-bottom:18px; }
          .nav-item{ justify-content:center; }
          .user-chip{ justify-content:center; }
          .stat-grid{ grid-template-columns:repeat(2,1fr); }
          .page{ padding:20px 16px 40px; }
          .twin-grid{ grid-template-columns:1fr; }
          .clinician-grid{ grid-template-columns:1fr; }
          .guest-banner span{ display:none; }
        }
      `}</style>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><HeartPulse size={16} /></span>
          <span>NARI</span>
        </div>
        <nav className="sidebar-nav">
          <a href="#dashboard" onClick={goTo("dashboard")} className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}>
            <Home size={17} /><span>Dashboard</span>
          </a>
          <a href="#assistant" onClick={goTo("assistant")} className={`nav-item ${activePage === "assistant" ? "active" : ""}`}>
            <MessageCircle size={17} /><span>Ask NARI</span>
          </a>
          <a href="#reports" onClick={goTo("reports")} className={`nav-item ${activePage === "reports" ? "active" : ""}`}>
            <FileText size={17} /><span>Reports</span>
          </a>
          <a href="#twin" onClick={goTo("twin")} className={`nav-item ${activePage === "twin" ? "active" : ""}`}>
            <HeartPulse size={17} /><span>Health Twin</span>
          </a>

          <div className="nav-section-label"><span>Lifestyle &amp; Clinic</span></div>
          <a href="#reminders" onClick={goTo("reminders")} className={`nav-item nav-item-secondary ${activePage === "reminders" ? "active" : ""}`}>
            <Pill size={17} /><span>Reminders</span>
          </a>
          <a href="#activity" onClick={goTo("activity")} className={`nav-item nav-item-secondary ${activePage === "activity" ? "active" : ""}`}>
            <Activity size={17} /><span>Daily Activity</span>
          </a>
          <a href="#clinician" onClick={goTo("clinician")} className={`nav-item nav-item-secondary ${activePage === "clinician" ? "active" : ""}`}>
            <Stethoscope size={17} /><span>Clinician Portal</span>
          </a>
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="user-avatar">{user?.guest ? <UserRound size={15} color="#fff" /> : <User size={15} color="#fff" />}</span>
            <div>
              <div className="user-name">{displayName}</div>
              <div className="user-sub">{user?.guest ? "Guest session" : "Health twin synced"}</div>
            </div>
          </div>
          <button className="signout-btn" onClick={handleSignOut}>
            <LogOut size={13} /><span>{user?.guest ? "Exit guest mode" : "Sign out"}</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="main-col">
        <header className="topbar">
          <div className="topbar-title">{PAGE_TITLES[activePage]}</div>
          <div className="topbar-actions">
            {user?.guest && (
              <div className="guest-banner">
                <span>Guest mode — data stored locally</span>
                <button onClick={() => setView("login")}>Sign in</button>
              </div>
            )}
            <button className="icon-btn" onClick={() => setShowNotifPanel((v) => !v)} aria-label="Notifications">
              <Bell size={17} />
              {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>
            {showNotifPanel && (
              <>
                <div className="notif-backdrop" onClick={() => setShowNotifPanel(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
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
                          <strong>All caught up</strong>
                          <span>Health alerts and medication nudges will appear here.</span>
                        </div>
                      </li>
                    )}
                    {notifications.map((n) => (
                      <li key={n.id} className={n.unread ? "unread" : ""}>
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
                  <p className="eyebrow-sm">Overview</p>
                  <h1>Welcome back, {displayName}</h1>
                  <p className="muted">Here is your continuous health twin status today.</p>
                </div>
                <div className="quick-actions">
                  <a href="#assistant" onClick={goTo("assistant")} className="qa-btn primary"><MessageCircle size={14} />Consult Assistant</a>
                  <a href="#reports" onClick={goTo("reports")} className="qa-btn"><Upload size={14} />Scan Lab Report</a>
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
                        <div className="stat-label">Consultations</div>
                        <div className="stat-value">{userTurns}</div>
                        <div className="stat-sub">{userTurns === 0 ? "Ask your first question" : "This session"}</div>
                      </div>
                      <div className="stat-card">
                        <TrendingDown size={18} className="stat-icon teal" />
                        <div className="stat-label">Latest Lab Status</div>
                        <div className="stat-value">{latestReport ? latestReport.statusLabel : "None yet"}</div>
                        <div className="stat-sub">{latestReport ? latestReport.name : "Upload a PDF or photo report"}</div>
                      </div>
                      <div className="stat-card">
                        <AlertTriangle size={18} className="stat-icon rose" />
                        <div className="stat-label">Clinical Risk Signals</div>
                        <div className="stat-value">{sessionRiskSignals.length}</div>
                        <div className="stat-sub">{latestRisk ? `${latestRisk.domain} (${latestRisk.level})` : "None flagged this session"}</div>
                      </div>
                      <div className="stat-card">
                        <FileText size={18} className="stat-icon violet" />
                        <div className="stat-label">Reports on Record</div>
                        <div className="stat-value">{pastReports.length}</div>
                        <div className="stat-sub">{pastReports.length === 0 ? "Nothing uploaded yet" : "In current record"}</div>
                      </div>
                    </>
                  );
                })()}
              </section>

              <section className="pipeline-card">
                <div className="pipeline-head">
                  <Network size={15} />
                  <h3>Clinical Multi-Agent Reasoning Pipeline</h3>
                </div>
                <p className="muted-sm" style={{ margin: "4px 0 0", color: "var(--ink-muted)", fontSize: "12px" }}>
                  Every consultation is processed through a deterministic safety check, specialty routing, and evidence retrieval.
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
                      {i < AGENT_PIPELINE.length - 1 && <ChevronRight size={14} className="pipeline-arrow" />}
                    </div>
                  ))}
                </div>
              </section>

              <section className="activity-card">
                <h3>Recent Activity &amp; Logs</h3>
                {(() => {
                  const items = [];
                  sessionRiskSignals.slice(0, 3).forEach((r, i) => {
                    items.push({
                      key: `risk-${i}`,
                      dot: "rose",
                      title: `${r.domain} clinical pattern flagged (${r.level})`,
                      when: "This session",
                    });
                  });
                  pastReports.slice(0, 3).forEach((r, i) => {
                    items.push({
                      key: `report-${i}`,
                      dot: "teal",
                      title: `Pathology report scanned — ${r.name}`,
                      when: r.date,
                    });
                  });
                  if (messages.filter((m) => m.sender === "user").length > 0) {
                    items.push({
                      key: "chat",
                      dot: "purple",
                      title: "Consulted NARI care assistant",
                      when: "This session",
                    });
                  }
                  if (items.length === 0) {
                    return (
                      <p className="muted-sm" style={{ color: "var(--ink-muted)", fontSize: "12.5px" }}>
                        No activity logged yet — ask the assistant a health question or upload a lab report to populate this feed.
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
                  <span>Clinical Care Consultation</span>
                </div>
                <div className="chat-toolbar-right">
                  <button className="tool-btn" onClick={clearChat} title="Reset consultation">
                    <RotateCcw size={13} />
                    <span>New Consultation</span>
                  </button>
                  <button className={`tool-btn ${speakEnabled ? "on" : ""}`} onClick={() => setSpeakEnabled((v) => !v)}>
                    {speakEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    <span>{speakEnabled ? "Voice Enabled" : "Voice Muted"}</span>
                  </button>
                </div>
              </div>

              <div className="chat-disclaimer">
                <Info size={12} />
                <span>Educational guidance grounded in clinical literature. Not a substitute for emergency care or medical diagnosis.</span>
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
                          <span>{LEVEL_LABEL[m.riskSignal.level] || "Observation"} — {m.riskSignal.next_step}</span>
                        </div>
                      )}

                      {m.riskSignal && m.riskSignal.factors && m.riskSignal.factors.length > 0 && (
                        <details className="expand-panel">
                          <summary>View Clinical Risk Factors</summary>
                          <div className="expand-body">
                            <ul>
                              {m.riskSignal.factors.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </div>
                        </details>
                      )}

                      {m.evidence && m.evidence.length > 0 && (
                        <details className="expand-panel">
                          <summary>Referenced Medical Protocols ({m.evidence.length})</summary>
                          <div className="expand-body">
                            <ul>
                              {m.evidence.slice(0, 3).map((e) => (
                                <li key={e.chunk_id}>
                                  {e.source_url ? (
                                    <a href={e.source_url} target="_blank" rel="noreferrer" style={{ color: "var(--deep-forest)", textDecoration: "underline" }}>{e.source_title}</a>
                                  ) : (
                                    e.source_title
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </details>
                      )}

                      {m.sender === "assistant" && (
                        <div className="msg-footer">
                          <button className="msg-action-btn" onClick={() => copyMessage(m.id, m.text)}>
                            {copiedId === m.id ? <Check size={12} color="#059669" /> : <Copy size={12} />}
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

              {voiceError && <div className="voice-error" style={{ color: "#DC2626", fontSize: "12px", padding: "0 20px 8px" }}>{voiceError}</div>}

              <div className="chat-input-row">
                <button
                  className={`mic-btn ${isListening ? "listening" : ""} ${!micSupported ? "disabled" : ""}`}
                  onClick={toggleListening}
                  aria-label="Voice input"
                  title={micSupported ? "Voice input" : "Microphone unavailable"}
                >
                  {micSupported ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  placeholder={isListening ? "Listening…" : "Ask about symptoms, lab results, medications, or cycle phases…"}
                  className="chat-input"
                />
                <button className="send-btn" onClick={() => handleSend()} aria-label="Send"><Send size={15} /></button>
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
                <p><strong>Click to upload</strong> or drag pathology report here</p>
                <span className="muted-sm">Accepts scanned PDF or image photo (PNG, JPG) · Parsed via Tesseract &amp; Clinical OCR</span>
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
                    <span>{reportFile ? reportFile.name : "Report"}</span>
                    {scanState === "scanning" && <Loader2 size={14} className="spin" />}
                    {scanState === "done" && <CheckCircle2 size={14} className="ok" />}
                    {scanState === "error" && <AlertTriangle size={14} className="err" />}
                  </div>

                  {scanState === "scanning" && (
                    <p className="muted-sm" style={{ color: "var(--ink-muted)", fontSize: "12.5px" }}>
                      Extracting text layers, performing OCR analysis, and standardizing medical biomarker values…
                    </p>
                  )}

                  {scanState === "error" && <p className="muted-sm" style={{ color: "var(--rose-alert)", fontSize: "12.5px" }}>{scanErrorText}</p>}

                  {scanState === "done" && scanResult && (
                    <>
                      <LabReportChart metrics={scanResult.metrics} />
                      <table className="marker-table">
                        <thead><tr><th>Biomarker</th><th>Value</th><th>Unit</th><th>Reference Status</th></tr></thead>
                        <tbody>
                          {scanResult.metrics.map((m, i) => (
                            <tr key={`${m.biomarker_name}-${i}`}>
                              <td><strong>{m.biomarker_name}</strong>{m.extracted_abbreviation ? ` (${m.extracted_abbreviation})` : ""}</td>
                              <td>{m.value}</td>
                              <td>{m.unit || "—"}</td>
                              <td><span className={`flag-pill ${(STATUS_TO_FLAG[m.status] || "flagged").toLowerCase()}`}>{STATUS_TO_FLAG[m.status] || "Flagged"}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button className="qa-btn" onClick={resetScan} style={{ border: "1px solid var(--line)", marginTop: "8px" }}>
                        Scan another document <ChevronRight size={13} />
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="past-reports">
                <h3>Uploaded Pathology Records</h3>
                <ul>
                  {pastReports.length === 0 && <li><span className="muted-sm" style={{ color: "var(--ink-muted)", fontSize: "12.5px" }}>No previous lab records uploaded yet.</span></li>}
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
                <div className="twin-avatar"><User size={20} color="#fff" /></div>
                <div className="twin-profile-info">
                  <h2>{displayName}'s Digital Health Twin</h2>
                  <p className="muted-sm">Cycle day 18 · Luteal phase · Hormonal &amp; metabolic parameters active</p>
                </div>
                <span className="twin-badge"><HeartPulse size={13} />Twin Active</span>
              </section>

              <div className="twin-grid">
                <section className="twin-card">
                  <div className="twin-card-head"><Droplets size={15} /><h3>Menstrual Cycle Dynamics</h3></div>
                  <p className="muted-sm" style={{ color: "var(--ink-muted)", fontSize: "12px" }}>Cycle length variation (days) across recent cycles.</p>
                  <CycleRing lengths={DEMO_CYCLE_LENGTHS} />
                  <p className="muted-sm" style={{ color: "var(--ink-muted)", fontSize: "12px", marginTop: "8px" }}>
                    Variance of 11 days observed across recent cycles — factored into longitudinal risk calculations.
                  </p>
                </section>

                <section className="twin-card">
                  <div className="twin-card-head"><Activity size={15} /><h3>Logged Clinical Signals</h3></div>
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
                  <div className="twin-card-head"><FileText size={15} /><h3>Recent Pathology Markers</h3></div>
                  {scanResult ? (
                    <>
                      <LabReportChart metrics={scanResult.metrics} />
                      <table className="marker-table">
                        <thead><tr><th>Biomarker</th><th>Value</th><th>Status</th></tr></thead>
                        <tbody>
                          {scanResult.metrics.slice(0, 5).map((m, i) => (
                            <tr key={`${m.biomarker_name}-${i}`}>
                              <td>{m.biomarker_name}</td>
                              <td>{m.value} {m.unit || ""}</td>
                              <td><span className={`flag-pill ${(STATUS_TO_FLAG[m.status] || "flagged").toLowerCase()}`}>{STATUS_TO_FLAG[m.status] || "Flagged"}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p className="muted-sm" style={{ color: "var(--ink-muted)", fontSize: "12.5px" }}>
                      No recent lab data scanned in this session. <a href="#reports" onClick={goTo("reports")} style={{ color: "var(--deep-forest)", fontWeight: 700, textDecoration: "underline" }}>Scan a lab report</a> to import values into your twin.
                    </p>
                  )}
                </section>

                <section className="twin-card twin-card-wide">
                  <div className="twin-card-head"><ShieldCheck size={15} /><h3>Explainable Risk Signals</h3></div>
                  <p className="muted-sm" style={{ color: "var(--ink-muted)", fontSize: "12px" }}>
                    {sessionRiskSignals.length > 0
                      ? "Generated by the Risk Prediction agent based on verified clinical heuristics and guideline criteria."
                      : "Example risk signals based on active profile criteria. Consult the assistant to generate live signals."}
                  </p>
                  {(sessionRiskSignals.length > 0 ? sessionRiskSignals : DEMO_RISK_SIGNALS).map((r, i) => (
                    <div className={`risk-card risk-card-${(r.level || "L0").toLowerCase()}`} key={i}>
                      <div className="risk-card-head">
                        <span className={`level-pill level-${(r.level || "L0").toLowerCase()}`}>{r.level} · {LEVEL_LABEL[r.level] || "Flag"}</span>
                        <strong>{r.domain} Pattern</strong>
                        {r.example && <span className="example-tag">Demonstration</span>}
                      </div>
                      <ul className="factor-list">
                        {(r.factors || []).map((f, fi) => <li key={fi}>{f}</li>)}
                      </ul>
                      <p className="muted-sm" style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}><em>{r.confidence_note}</em></p>
                      {r.next_step && <p className="risk-next"><Target size={13} />{r.next_step}</p>}
                      {r.when_to_seek_care && <p className="risk-next"><AlertTriangle size={13} />Clinical action: {r.when_to_seek_care}</p>}
                    </div>
                  ))}
                </section>

                <section className="twin-card twin-card-wide">
                  <div className="twin-card-head"><ClipboardCheck size={15} /><h3>Coordinated Care Plan</h3></div>
                  {sessionCarePlan ? (
                    <>
                      <FormattedMessage text={cleanCarePlanText(sessionCarePlan.summary)} />
                      {sessionCarePlan.next_step && <p className="risk-next"><Target size={13} />{sessionCarePlan.next_step}</p>}
                      {(sessionCarePlan.evidence || []).length > 0 && (
                        <div className="evidence-list" style={{ marginTop: "10px" }}>
                          {sessionCarePlan.evidence.map((e, i) => (
                            <div key={i} className="evidence-item" style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}><BookOpen size={12} /> {e.source}</div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="muted-sm" style={{ color: "var(--ink-muted)", fontSize: "12.5px" }}>
                      Care plans are automatically composed during consultations when risk factors and clinical evidence align. Ask the assistant a health question to generate an active plan.
                    </p>
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
                <span>Clinician Oversight Portal: Review longitudinal patient cohorts, risk stratifications, and audited event traces.</span>
              </div>

              <div className="clinician-grid">
                <section className="roster-card">
                  <div className="twin-card-head"><Users size={15} /><h3>Patient Roster</h3></div>
                  <ul className="roster-list">
                    {DEMO_PATIENTS.map((p) => (
                      <li
                        key={p.id}
                        className={selectedPatientId === p.id ? "selected" : ""}
                        onClick={() => setSelectedPatientId(p.id)}
                      >
                        <div className="roster-info">
                          <strong>{p.name}</strong>
                          <span>{p.age} yrs · {p.concern}</span>
                        </div>
                        <div className="roster-meta">
                          <span className={`level-pill level-${p.level.toLowerCase()}`}>{p.level}</span>
                          <span className="muted-sm" style={{ fontSize: "10.5px", color: "var(--ink-muted)" }}>{p.adherence}% adhr</span>
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
                            <p className="muted-sm" style={{ fontSize: "12px", color: "var(--ink-muted)", marginTop: "2px" }}>{patient.age} yrs · {patient.concern} · Last active {patient.lastActive}</p>
                          </div>
                          <span className={`level-pill level-${patient.level.toLowerCase()}`}>{patient.level} · {LEVEL_LABEL[patient.level]}</span>
                        </div>

                        {detail ? (
                          <>
                            <h4><ShieldCheck size={13} />Clinical Risk Signals</h4>
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

                            <h4><ClipboardCheck size={13} />Structured Care Plan</h4>
                            <FormattedMessage text={cleanCarePlanText(detail.carePlan.summary)} />
                            <p className="risk-next"><Target size={13} />{detail.carePlan.next_step}</p>

                            <h4><Brain size={13} />Agent Execution Audit Log</h4>
                            <ul className="event-log">
                              {detail.eventLog.map((e, i) => (
                                <li key={i}><span className="event-time">{e.time}</span><strong>{e.agent}</strong><span>{e.note}</span></li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p className="muted-sm" style={{ color: "var(--ink-muted)", fontSize: "12px" }}>No longitudinal data recorded for this patient yet.</p>
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