import React, { useState, useEffect, useRef } from "react";
import {
  Home, MessageCircle, FileText, Bell, Mic, MicOff, Send, Upload,
  Volume2, VolumeX, X, AlertTriangle, CheckCircle2, Activity, Calendar,
  TrendingDown, Droplets, Sparkles, ChevronRight, User, Loader2,
  HeartPulse, Stethoscope, Network, ShieldCheck, ClipboardCheck, BookOpen,
  Users, Brain, Target, Info, LogOut, Pill, UserRound, Copy, Check, RotateCcw,
  Globe
} from "lucide-react";
import { sendChatMessage, voiceConverse, getVoiceStatus, uploadReport, listReports, setToken } from "./api.js";
import { SUPPORTED_LANGUAGES, getTranslation } from "./i18n.js";
import LandingPage from "./LandingPage.jsx";
import LoginPage from "./LoginPage.jsx";
import LabReportChart from "./LabReportChart.jsx";
import CycleRing from "./CycleRing.jsx";
import RemindersPage from "./RemindersPage.jsx";
import ActivityTrackerPage from "./ActivityTrackerPage.jsx";
import PeriodTrackerPage from "./PeriodTrackerPage.jsx";
import GuestGate from "./GuestGate.jsx";

const AGENT_PIPELINE = [
  { name: "Safety & Emergency", note: "Immediate clinical safety assessment" },
  { name: "Clinical Router", note: "Directs query to specialized domain node" },
  { name: "Knowledge & RAG", note: "Retrieves certified WHO/MoHFW protocols" },
  { name: "Specialist Care Node", note: "Analyzes symptoms, labs, cycles, nutrition" },
  { name: "Risk Assessment", note: "Transparent, explainable clinical pattern matcher" },
  { name: "Care Plan Composer", note: "Synthesizes supportive, actionable steps" },
  { name: "Follow-up Continuity", note: "Schedules proactive care check-ins" },
];

const DEMO_CYCLE_LENGTHS = [26, 31, 24, 33, 27, 35];
const DEMO_SYMPTOM_TIMELINE = [
  { id: 1, date: "Today", text: "Mild cramps noted, aligned with luteal phase", tag: "Symptom" },
  { id: 2, date: "Yesterday", text: "Ferritin flagged lower than reference range on lab report", tag: "Lab" },
  { id: 3, date: "3 days ago", text: "Reported acne flare & cycle variance during check-in", tag: "Symptom" },
  { id: 4, date: "6 days ago", text: "Logged 5.5 hrs sleep, elevated stress score", tag: "Lifestyle" },
];
const DEMO_RISK_SIGNALS = [
  {
    domain: "Hormonal & PCOS Context",
    signal_type: "pattern_flag",
    level: "L2",
    factors: ["Cycle length spread of 11 days across recent cycles", "Reported symptoms: persistent acne", "Reported symptoms: hair thinning"],
    confidence_note: "Rule-based pattern heuristic designed to support clinical discussion, not a standalone diagnosis.",
    next_step: "This combination of cycle variance and physical signs is worth discussing gently with your gynecologist or endocrinologist.",
    when_to_seek_care: "If cycles pause for over 90 days, or if you experience sudden pelvic pain.",
    example: true,
  },
  {
    domain: "Iron & Energy Metabolism",
    signal_type: "trend_flag",
    level: "L1",
    factors: ["Serum Ferritin: 9 ng/mL (Lower than standard reference range)"],
    confidence_note: "Based on uploaded pathology parameters.",
    next_step: "Share this lab sheet with your physician to discuss dietary iron rich foods or gentle oral supplementation.",
    when_to_seek_care: "If you experience dizziness, shortness of breath on exertion, or profound fatigue.",
    example: true,
  },
];
const LEVEL_LABEL = { L0: "Information", L1: "Supportive Monitor", L2: "Clinician Discussion", L3: "Prompt Medical Care", L4: "Emergency Care" };

const DEMO_PATIENTS = [
  { id: "p1", name: "Ananya Sharma", age: 27, concern: "Hormonal pattern review", level: "L2", adherence: 86, lastActive: "Just now" },
  { id: "p2", name: "Riya Kapoor", age: 24, concern: "Pelvic comfort & endometriosis", level: "L2", adherence: 74, lastActive: "2h ago" },
  { id: "p3", name: "Meera Nair", age: 31, concern: "Postpartum wellbeing", level: "L1", adherence: 91, lastActive: "5h ago" },
  { id: "p4", name: "Sanya Verma", age: 45, concern: "Perimenopause transition", level: "L1", adherence: 68, lastActive: "1d ago" },
  { id: "p5", name: "Kavya Iyer", age: 29, concern: "Routine cycle wellness", level: "L0", adherence: 95, lastActive: "2d ago" },
];
const DEMO_PATIENT_DETAIL = {
  p1: {
    riskSignals: DEMO_RISK_SIGNALS,
    carePlan: {
      summary: "Observation of cycle variance with acne and lower ferritin on recent lab report.",
      next_step: "Schedule a routine consultation with gynecology; incorporate iron-supportive meals and gentle stress-reducing movement.",
      evidence: [{ source: "WHO — Global guidelines on women's hormonal health" }, { source: "MoHFW — National guidelines on nutritional anaemia" }],
    },
    eventLog: [
      { agent: "Safety & Emergency", note: "No acute distress triggers identified", time: "09:14" },
      { agent: "Clinical Router", note: "Routed to Hormonal Health agent", time: "09:14" },
      { agent: "Knowledge & RAG", note: "2 evidence protocols retrieved", time: "09:14" },
      { agent: "Risk Assessment", note: "Hormonal pattern heuristic categorized at L2", time: "09:14" },
      { agent: "Care Plan Composer", note: "Drafted explainable care recommendation", time: "09:15" },
      { agent: "Follow-up Continuity", note: "Continuous check-in queued in 7 days", time: "09:15" },
    ],
  },
};

const INITIAL_NOTIFICATIONS = [];
const DEMO_PROFILE = { full_name: "Ananya", cycle_day: 18, cycle_phase: "Luteal phase" };

const KNOWN_FEMALE_VOICE_NAMES = [
  "zira", "samantha", "victoria", "karen", "moira", "tessa", "fiona", "susan",
  "google us english", "google uk english female", "kathy", "veena", "lekha",
  "aria", "jenny", "libby", "emma", "heera", "kalpana", "geeta",
];

function pickVoiceForLanguage(voices, lang = "en") {
  const targetPrefix = lang.toLowerCase();
  const matchingLang = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(targetPrefix));
  const pool = matchingLang.length > 0 ? matchingLang : voices.filter((v) => v.lang && (v.lang.toLowerCase().includes("in") || v.lang.toLowerCase().startsWith("en")));
  
  const explicitlyFemale = pool.find((v) => /female/i.test(v.name));
  if (explicitlyFemale) return explicitlyFemale;
  
  const knownFemale = pool.find((v) =>
    KNOWN_FEMALE_VOICE_NAMES.some((name) => v.name.toLowerCase().includes(name))
  );
  if (knownFemale) return knownFemale;
  
  return pool[0] || voices[0] || null;
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

function GuestNameGate({ value, onChange, onConfirm, onCancel, lang }) {
  return (
    <div className="guest-gate-shell">
      <style>{`
        .guest-gate-shell{
          min-height:100vh; display:flex; align-items:center; justify-content:center;
          background:linear-gradient(150deg,#144D42 0%,#1B5E50 60%,#236D5E 100%);
          font-family:'Plus Jakarta Sans','DM Sans',-apple-system,sans-serif; padding:24px;
        }
        .guest-gate-shell *{ box-sizing:border-box; }
        .guest-gate-card{
          background:#fff; border-radius:24px; padding:38px 36px; width:100%; max-width:400px;
          box-shadow:0 16px 40px rgba(20,77,66,0.25); text-align:center; animation: guest-rise .3s ease;
          border:1px solid #E0EAE5;
        }
        @keyframes guest-rise{ from{opacity:0; transform:translateY(12px);} to{opacity:1; transform:translateY(0);} }
        .guest-gate-mark{
          width:56px; height:56px; border-radius:18px; margin:0 auto 20px;
          background:#D6EDE5; color:#06332A; display:flex; align-items:center; justify-content:center;
        }
        .guest-gate-card h2{
          font-family:'Sora',sans-serif; font-size:23px; font-weight:800; color:#0D2C24; margin:0 0 8px;
        }
        .guest-gate-card p{ color:#4E6D64; font-size:14px; line-height:1.65; margin:0 0 24px; }
        .guest-gate-input{
          width:100%; border:1.5px solid #D5E2DC; border-radius:999px; padding:13px 18px;
          font-size:14px; font-family:inherit; outline:none; margin-bottom:20px; text-align:center;
          background:#FBFDFB; transition:border-color .2s ease, box-shadow .2s ease;
        }
        .guest-gate-input:focus{ border-color:#1B5E50; background:#fff; box-shadow:0 0 0 3px rgba(27,94,80,0.12); }
        .guest-gate-actions{ display:flex; flex-direction:column; gap:10px; }
        .guest-gate-confirm{
          width:100%; background:#1B5E50; color:#fff; border:none; border-radius:999px;
          padding:14px 0; font-family:'Sora',sans-serif; font-weight:700; font-size:14.5px;
          cursor:pointer; transition:all .18s ease; box-shadow:0 2px 10px rgba(27,94,80,0.2);
        }
        .guest-gate-confirm:hover{ background:#144D42; transform:translateY(-1px); }
        .guest-gate-back{
          width:100%; background:none; border:none; color:#4E6D64; font-size:13px; font-weight:600; cursor:pointer;
          padding:6px 0;
        }
      `}</style>
      <div className="guest-gate-card">
        <div className="guest-gate-mark"><HeartPulse size={26} /></div>
        <h2>What should we call you?</h2>
        <p>Guest sessions are stored privately on this device. We will use your preferred name to personalize your health twin dashboard.</p>
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
  const [lang, setLang] = useState(() => localStorage.getItem("nari_lang") || "en");

  const t = (key) => getTranslation(lang, key);

  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      sender: "assistant",
      agent: "NARI",
      text: getTranslation(lang, "initial_assistant_greeting"),
    },
  ]);
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
  const inputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("nari_lang", lang);
  }, [lang]);

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

  useEffect(() => {
    if (user && !user.guest) {
      listReports()
        .then((res) => {
          if (res && Array.isArray(res.items)) {
            const formatted = res.items.map((r) => {
              const metrics = r.report_json?.metrics || [];
              const flag = deriveReportFlag(metrics);
              return {
                id: r.id,
                name: r.original_filename,
                date: r.uploaded_at ? formatDate(r.uploaded_at) : "Recently",
                status: flag,
                statusLabel: flag === "flagged" ? "Observation Markers" : "All Normal Range",
                metrics: metrics,
              };
            });
            setPastReports(formatted);
          }
        })
        .catch(() => {});
    } else {
      setPastReports([]);
    }
  }, [user]);

  const handleSignIn = (userData) => {
    setUser(userData);
    setView("app");
  };

  const handleSignOut = () => {
    setUser(null);
    setToken(null);
    saveSession(null);
    setView("landing");
    setPastReports([]);
    setSessionRiskSignals([]);
    setSessionCarePlan(null);
    setScanResult(null);
    setReportFile(null);
    setScanState("idle");
    setMessages([
      {
        id: Date.now(),
        sender: "assistant",
        agent: "NARI",
        text: getTranslation(lang, "initial_assistant_greeting"),
      },
    ]);
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
        showToast(t("copied"));
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
        utt.rate = 0.96;
        utt.pitch = 1.02;
        const voices = window.speechSynthesis.getVoices();
        const chosenVoice = pickVoiceForLanguage(voices, lang);
        if (chosenVoice) {
          utt.voice = chosenVoice;
          utt.lang = chosenVoice.lang;
        } else {
          const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
          if (currentLangObj) utt.lang = currentLangObj.speechCode;
        }
        window.speechSynthesis.speak(utt);
      }, 70);
    } catch {
      /* ignore */
    }
  };

  const handleSend = async (overrideText) => {
    const msgText = (overrideText || input).trim();
    if (!msgText || isTyping) return;

    const guestTurns = messages.filter((m) => m.sender === "user").length;
    if (user?.guest && guestTurns >= 4) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: "user", text: msgText },
        {
          id: Date.now() + 1,
          sender: "assistant",
          agent: "NARI",
          isGuestLimit: true,
          text: "You have completed your 4 free consultation questions in guest mode. To continue asking unlimited questions, save your conversation history, and access all health trackers, please sign in or create a free account.",
        },
      ]);
      if (!overrideText) setInput("");
      return;
    }

    const userMsg = { id: Date.now(), sender: "user", text: msgText };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput("");
    setIsTyping(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.sender === "assistant" ? "assistant" : "user",
        content: m.text,
      }));

      const activeProfile = {
        ...DEMO_PROFILE,
        language_preference: lang,
      };

      const res = await sendChatMessage(msgText, historyPayload, activeProfile, user?.id || null);
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
          text: "I am taking a moment to reconnect with the clinical engine. Please try asking your question again.",
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
        text: t("initial_assistant_greeting"),
      },
    ]);
    showToast(t("new_chat"));
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
      const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
      rec.lang = currentLangObj ? currentLangObj.speechCode : "en-IN";
      
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
    if (user?.guest && pastReports.length >= 1) {
      showToast("Guest preview limit: 1 report. Please sign in.");
      setScanState("error");
      setScanErrorText("You have already scanned a pathology report in guest preview mode. To upload unlimited lab documents and securely save them in your health twin, please create a free account.");
      return;
    }
    setReportFile(file);
    setScanState("scanning");
    setScanErrorText("");

    try {
      const data = await uploadReport(file);
      setScanResult(data);
      setScanState("done");
      showToast("Report parsed successfully");

      const newRep = {
        id: data.report_id || `rep-${Date.now()}`,
        name: file.name,
        date: "Just now",
        status: deriveReportFlag(data.metrics),
        statusLabel: deriveReportFlag(data.metrics) === "flagged" ? "Observation Markers" : "All Normal Range",
        metrics: data.metrics || [],
      };
      setPastReports((prev) => [newRep, ...prev]);
    } catch (err) {
      setScanState("error");
      setScanErrorText(err.message || "Unable to read the document clearly. Please try re-uploading a sharp photo or PDF.");
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
        lang={lang}
        onLangChange={setLang}
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
        lang={lang}
      />
    );
  }

  if (view === "login") {
    return (
      <LoginPage
        onSignIn={handleSignIn}
        onGuest={() => setView("guest_gate")}
        onBack={() => setView("landing")}
        lang={lang}
        onLangChange={setLang}
      />
    );
  }

  const displayName = user?.guest ? user?.fullName || "Guest" : user?.fullName || (user?.email ? user.email.split("@")[0] : "there");
  const unreadCount = notifications.filter((n) => n.unread).length;
  const suggestedList = getTranslation(lang, "suggested_prompts") || [];

  return (
    <div className="app-shell">
      <style>{`
        :root{
          color-scheme: light;
          --md-primary: #1B5E50;
          --md-primary-dark: #144D42;
          --md-primary-container: #D6EDE5;
          --md-on-primary-container: #06332A;
          --md-surface: #F7FAF8;
          --md-surface-container: #FFFFFF;
          --md-surface-container-high: #EDF5F1;
          --md-ink-primary: #0D2C24;
          --md-ink-secondary: #1E3A34;
          --md-ink-muted: #4E6D64;
          --md-outline: #E0EAE5;
          --md-outline-strong: #D5E2DC;
          --md-amber-container: #FFFBEB;
          --md-amber-on-container: #92400E;
          --md-amber-border: #FDE68A;
          --font-head: 'Sora', sans-serif;
          --font-body: 'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif;
          --shadow-card: 0 1px 3px rgba(0,0,0,0.03), 0 4px 14px rgba(27,94,80,0.05);
          --shadow-soft: 0 6px 22px rgba(27,94,80,0.07);
        }

        .app-shell{ color-scheme: light; }
        .app-shell button, .app-shell input, .app-shell select, .app-shell a{ color-scheme: light; }
        .app-shell *{ box-sizing:border-box; }
        .app-shell{
          display:flex; min-height:100vh; background:var(--md-surface); color:var(--md-ink-secondary);
          font-family:var(--font-body); font-size:14.5px;
        }
        .app-shell h1,.app-shell h2,.app-shell h3,.app-shell h4{ font-family:var(--font-head); font-weight:700; color:var(--md-ink-primary); margin:0; }
        .app-shell a{ text-decoration:none; color:inherit; }
        .app-shell button{ font-family:inherit; cursor:pointer; }
        .app-shell ul{ list-style:none; margin:0; padding:0; }

        /* Sidebar */
        .sidebar{
          width:240px; flex-shrink:0; background:#fff; color:var(--md-ink-primary);
          display:flex; flex-direction:column; padding:24px 16px; position:fixed; top:0; bottom:0; left:0; height:100vh;
          border-right:1px solid var(--md-outline); box-shadow:var(--shadow-card); z-index:10;
        }
        .brand{ display:flex; align-items:center; gap:10px; font-family:var(--font-head); font-weight:800; font-size:19px; padding:0 8px 26px; color:var(--md-primary); }
        .brand-mark{
          width:30px; height:30px; border-radius:10px; background:var(--md-primary);
          display:flex; align-items:center; justify-content:center; color:#E8F4F0; flex-shrink:0;
        }
        .sidebar-nav{ display:flex; flex-direction:column; gap:4px; flex:1; }
        .nav-item{
          display:flex; align-items:center; gap:11px; padding:10px 14px; border-radius:999px;
          font-family:var(--font-body); font-weight:600; font-size:13.5px; color:var(--md-ink-muted);
          transition:all .18s ease;
        }
        .nav-item:hover{ background:var(--md-surface-container-high); color:var(--md-primary); }
        .nav-item.active{ background:var(--md-primary); color:#fff; box-shadow:0 2px 8px rgba(27,94,80,0.2); }
        .nav-section-label{ padding:16px 14px 4px; font-size:10.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--md-ink-muted); opacity:0.75; }
        .nav-item-secondary{ font-size:13px; padding:9px 14px; }

        .sidebar-foot{ border-top:1px solid var(--md-outline); padding-top:16px; display:flex; flex-direction:column; gap:10px; }
        .user-chip{ display:flex; align-items:center; gap:10px; }
        .user-avatar{
          width:34px; height:34px; border-radius:50%; background:var(--md-primary-container); color:var(--md-on-primary-container);
          display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:700;
        }
        .user-name{ font-family:var(--font-body); font-weight:700; font-size:13.5px; color:var(--md-ink-primary); }
        .user-sub{ font-size:11.5px; color:var(--md-ink-muted); }
        .signout-btn{
          display:flex; align-items:center; gap:7px; padding:8px 12px; border-radius:999px;
          border:1px solid var(--md-outline); background:#FAFCFB; color:var(--md-ink-muted); font-size:12px; font-weight:600;
          transition:all .15s ease;
        }
        .signout-btn:hover{ background:#FDF2F2; color:#991B1B; border-color:#F9D5D5; }

        /* Topbar */
        .main-col{ flex:1; display:flex; flex-direction:column; min-width:0; margin-left:240px; }
        .topbar{
          display:flex; align-items:center; justify-content:space-between; padding:16px 36px;
          border-bottom:1px solid var(--md-outline); background:rgba(247,250,248,0.92); backdrop-filter:blur(8px);
          position:sticky; top:0; z-index:9;
        }
        .topbar-title{ font-family:var(--font-head); font-weight:700; font-size:18px; color:var(--md-ink-primary); }
        .topbar-actions{ display:flex; align-items:center; gap:12px; position:relative; }

        /* Material 3 Language Selector Pill */
        .lang-pill-container{
          display:flex; align-items:center; gap:6px; background:#fff; border:1px solid var(--md-outline-strong);
          border-radius:999px; padding:4px 12px; font-size:12.5px; color:var(--md-primary); font-weight:600;
          transition:all .18s ease;
        }
        .lang-pill-container:hover{ background:var(--md-surface-container-high); border-color:var(--md-primary); }
        .lang-pill-container select{
          border:none; outline:none; background:transparent; font-family:inherit; font-weight:700;
          font-size:12.5px; color:var(--md-primary); cursor:pointer; padding:2px 0;
        }

        .guest-banner{
          background:var(--md-amber-container); color:var(--md-amber-on-container); font-size:12px; padding:6px 14px; border-radius:999px;
          display:flex; align-items:center; gap:8px; font-weight:600; border:1px solid var(--md-amber-border);
        }
        .guest-banner button{
          background:var(--md-amber-on-container); color:#fff; border:none; border-radius:999px; padding:2px 9px; font-size:11px; font-weight:700;
        }
        .icon-btn{
          position:relative; width:40px; height:40px; border-radius:50%; border:1px solid var(--md-outline);
          background:#fff; display:flex; align-items:center; justify-content:center; color:var(--md-ink-primary);
          transition:all .15s ease;
        }
        .icon-btn:hover{ background:var(--md-surface-container-high); border-color:var(--md-primary); }
        .badge{
          position:absolute; top:-3px; right:-3px; background:#C74D4D; color:#fff;
          font-size:10px; font-weight:700; border-radius:999px; padding:1px 5px; font-family:var(--font-head);
        }
        .notif-panel{
          position:absolute; top:50px; right:0; width:330px; background:#fff; border:1px solid var(--md-outline);
          border-radius:20px; box-shadow:var(--shadow-soft); z-index:21; overflow:hidden;
        }
        .notif-panel-head{ display:flex; align-items:center; justify-content:space-between; padding:15px 18px; border-bottom:1px solid var(--md-outline); font-family:var(--font-head); font-weight:700; font-size:13.5px; color:var(--md-ink-primary); }
        .notif-panel-head button{ background:none; border:none; color:var(--md-ink-muted); }
        .notif-panel ul{ max-height:300px; overflow-y:auto; }
        .notif-panel li{ display:flex; gap:10px; padding:12px 18px; border-bottom:1px solid var(--md-outline); cursor:pointer; }
        .notif-panel li:last-child{ border-bottom:none; }
        .notif-panel li:hover{ background:var(--md-surface-container-high); }
        .notif-panel li .dot{ width:7px; height:7px; border-radius:50%; background:var(--md-outline-strong); margin-top:6px; flex-shrink:0; }
        .notif-panel li.unread .dot{ background:var(--md-primary); }
        .notif-panel li strong{ display:block; font-size:13px; font-weight:600; color:var(--md-ink-primary); }
        .notif-panel li span{ font-size:11.5px; color:var(--md-ink-muted); }

        .page{ flex:1; padding:28px 36px 56px; max-width:1040px; width:100%; margin:0 auto; }
        .toast{
          position:fixed; bottom:24px; right:24px; background:var(--md-primary-dark); color:#fff;
          padding:12px 20px; border-radius:999px; display:flex; align-items:center; gap:8px;
          font-size:13px; font-weight:600; box-shadow:0 8px 24px rgba(20,77,66,0.3); z-index:30; animation:rise .2s ease;
        }
        @keyframes rise{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:translateY(0);} }

        /* Dashboard Overview Card */
        .welcome-card{
          background:linear-gradient(150deg, #144D42 0%, #1B5E50 100%); color:#fff; border-radius:24px; padding:30px 34px;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:20px; margin-bottom:26px;
          box-shadow:var(--shadow-card);
        }
        .eyebrow-sm{ font-family:var(--font-head); font-weight:700; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#A7D9C9; margin:0 0 4px; }
        .welcome-card h1{ color:#fff; font-size:25px; font-weight:800; }
        .muted{ color:rgba(235,246,242,0.9); font-size:14px; margin-top:5px; }
        .quick-actions{ display:flex; gap:10px; flex-wrap:wrap; }
        .qa-btn{
          display:inline-flex; align-items:center; gap:8px; padding:11px 18px; border-radius:999px;
          font-weight:700; font-size:13px; background:#fff; color:var(--md-primary); border:none;
          transition:all .18s ease;
        }
        .qa-btn:hover{ transform:translateY(-1px); background:var(--md-surface-container-high); }
        .qa-btn.primary{ background:var(--md-primary-container); color:var(--md-on-primary-container); }
        .qa-btn.primary:hover{ background:#fff; }

        .stat-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:26px; }
        .stat-card{
          background:#fff; border:1px solid var(--md-outline); border-radius:20px; padding:20px; box-shadow:var(--shadow-card);
          transition:all .18s ease;
        }
        .stat-card:hover{ border-color:var(--md-primary); transform:translateY(-2px); box-shadow:var(--shadow-soft); }
        .stat-icon.purple{ color:var(--md-primary); }
        .stat-icon.teal{ color:#2A856A; }
        .stat-icon.rose{ color:#C27B2B; }
        .stat-icon.violet{ color:var(--md-ink-primary); }
        .stat-label{ font-size:12.5px; font-weight:600; color:var(--md-ink-muted); margin-top:10px; }
        .stat-value{ font-family:var(--font-head); font-weight:800; font-size:20px; color:var(--md-ink-primary); margin-top:3px; }
        .stat-sub{ font-size:12px; color:var(--md-ink-muted); margin-top:3px; }

        .activity-card{ background:#fff; border:1px solid var(--md-outline); border-radius:20px; padding:24px 26px; box-shadow:var(--shadow-card); }
        .activity-card h3{ font-size:15px; margin-bottom:14px; }
        .activity-list li{ display:flex; gap:12px; padding:11px 0; border-bottom:1px dashed var(--md-outline); align-items:flex-start; }
        .activity-list li:last-child{ border-bottom:none; }
        .activity-list .dot{ width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0; }
        .dot.rose{ background:#C27B2B; }
        .dot.teal{ background:#2A856A; }
        .dot.purple{ background:var(--md-primary); }
        .activity-list strong{ display:block; font-size:13.5px; color:var(--md-ink-primary); font-weight:600; }
        .activity-list span{ font-size:12px; color:var(--md-ink-muted); }

        /* Chat Consultation Layout */
        .chat-shell{
          display:flex; flex-direction:column; height:calc(100vh - 150px); max-height:740px;
          background:#fff; border:1px solid var(--md-outline); border-radius:24px; overflow:hidden; box-shadow:var(--shadow-card);
        }
        .chat-toolbar{
          display:flex; align-items:center; justify-content:space-between; padding:14px 22px;
          border-bottom:1px solid var(--md-outline); background:#FBFDFB;
        }
        .chat-toolbar-left{ display:flex; align-items:center; gap:8px; font-size:13.5px; color:var(--md-primary); font-weight:700; }
        .chat-toolbar-right{ display:flex; align-items:center; gap:8px; }
        .tool-btn{
          display:flex; align-items:center; gap:6px; border:1px solid var(--md-outline); background:#fff; border-radius:999px;
          padding:7px 14px; font-size:12px; font-weight:600; color:var(--md-ink-muted); transition:all .18s ease;
        }
        .tool-btn:hover{ background:var(--md-surface-container-high); color:var(--md-primary); }
        .tool-btn.on{ background:var(--md-primary-container); color:var(--md-on-primary-container); border-color:transparent; }

        .chat-window{ flex:1; overflow-y:auto; padding:22px; display:flex; flex-direction:column; gap:16px; background:#FBFDFB; }
        .msg-row{ display:flex; flex-direction:column; max-width:80%; }
        .msg-row.user{ align-self:flex-end; align-items:flex-end; }
        .msg-row.assistant{ align-self:flex-start; align-items:flex-start; }
        .agent-tag{ font-weight:700; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:var(--md-primary); margin-bottom:5px; padding-left:4px; }
        .bubble{ padding:15px 20px; border-radius:20px; font-size:14.5px; line-height:1.65; position:relative; }
        .bubble.user{ background:var(--md-primary); color:#fff; border-bottom-right-radius:4px; white-space:pre-wrap; }
        .bubble.assistant{ background:#FFFFFF; color:var(--md-ink-primary); border:1px solid var(--md-outline); border-bottom-left-radius:4px; box-shadow:0 1px 4px rgba(0,0,0,0.03); }
        .bubble.assistant.urgent{ background:#FDF2F2; color:#991B1B; border:1.5px solid #F9D5D5; }

        .chat-formatted-body{ display:flex; flex-direction:column; gap:9px; }
        .chat-paragraph{ margin:0; font-size:14.5px; line-height:1.65; }
        .chat-section-header{ font-size:14px; font-weight:800; color:var(--md-ink-primary); margin:8px 0 2px; }
        .chat-bullet-list{ margin:3px 0 6px; padding-left:18px; display:flex; flex-direction:column; gap:5px; list-style:disc; }
        .chat-bullet-list li{ font-size:14px; line-height:1.6; }

        .msg-footer{ display:flex; align-items:center; gap:8px; margin-top:10px; padding-top:8px; border-top:1px dashed var(--md-outline); }
        .msg-action-btn{
          display:inline-flex; align-items:center; gap:5px; border:none; background:none; color:var(--md-ink-muted);
          font-size:12px; font-weight:600; padding:4px 8px; border-radius:6px; cursor:pointer; transition:all .15s ease;
        }
        .msg-action-btn:hover{ background:var(--md-primary-container); color:var(--md-on-primary-container); }

        .bubble.typing{ display:flex; gap:6px; padding:14px 18px; }
        .bubble.typing span{ width:7px; height:7px; border-radius:50%; background:var(--md-ink-muted); opacity:0.5; animation:blink 1.2s infinite ease-in-out; }
        .bubble.typing span:nth-child(2){ animation-delay:0.2s; } .bubble.typing span:nth-child(3){ animation-delay:0.4s; }
        @keyframes blink{ 0%,80%,100%{opacity:0.25;} 40%{opacity:0.9;} }

        .risk-flag{ display:flex; align-items:flex-start; gap:8px; margin-top:10px; padding:10px 14px; border-radius:12px; font-size:12.5px; line-height:1.5; background:var(--md-amber-container); color:var(--md-amber-on-container); border:1px solid var(--md-amber-border); }
        .risk-flag svg{ flex-shrink:0; margin-top:2px; }
        .risk-flag.risk-l2, .risk-flag.risk-l3{ background:#FDF2F2; color:#991B1B; border-color:#F9D5D5; }

        .expand-panel{ margin-top:8px; border:1px solid var(--md-outline); border-radius:12px; background:#FAFCFB; }
        .expand-panel summary{ list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px; font-size:12px; font-weight:700; color:var(--md-primary); }
        .expand-panel summary::-webkit-details-marker{ display:none; }
        .expand-panel summary::after{ content:"+"; font-size:14px; font-weight:700; color:var(--md-ink-muted); }
        .expand-panel[open] summary::after{ content:"−"; }
        .expand-panel .expand-body{ padding:0 12px 10px; font-size:12px; color:var(--md-ink-muted); line-height:1.55; }
        .expand-panel .expand-body ul{ margin:0; padding-left:16px; }

        .chat-disclaimer{ display:flex; align-items:center; gap:7px; padding:7px 22px; font-size:11.5px; color:var(--md-ink-muted); background:var(--md-surface-container-high); border-top:1px solid var(--md-outline); }
        .chat-disclaimer svg{ flex-shrink:0; color:var(--md-primary); }
        .chip-row{ display:flex; flex-wrap:wrap; gap:8px; padding:0 22px 14px; }
        .chip{ border:1.5px solid var(--md-outline); background:#fff; border-radius:999px; padding:8px 16px; font-size:12.5px; color:var(--md-primary); font-weight:600; transition:all .18s ease; }
        .chip:hover{ background:var(--md-primary-container); border-color:var(--md-primary); }

        .chat-input-row{ display:flex; align-items:center; gap:10px; padding:14px 22px; border-top:1px solid var(--md-outline); background:#fff; }
        .mic-btn{ width:42px; height:42px; border-radius:50%; border:1.5px solid var(--md-outline); background:#FAFCFB; display:flex; align-items:center; justify-content:center; color:var(--md-primary); flex-shrink:0; transition:all .18s ease; }
        .mic-btn.listening{ background:#C74D4D; color:#fff; border-color:transparent; }
        .mic-btn.disabled{ opacity:0.4; cursor:not-allowed; }
        .mic-btn:hover{ background:var(--md-surface-container-high); }
        .chat-input{ flex:1; border:1.5px solid var(--md-outline-strong); border-radius:999px; padding:12px 20px; font-size:14px; font-family:var(--font-body); outline:none; background:#FBFDFB; transition:all .18s ease; }
        .chat-input:focus{ border-color:var(--md-primary); background:#fff; box-shadow:0 0 0 3px rgba(27,94,80,0.1); }
        .send-btn{ width:42px; height:42px; border-radius:50%; background:var(--md-primary); color:#fff; border:none; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .18s ease; box-shadow:0 2px 8px rgba(27,94,80,0.2); }
        .send-btn:hover{ background:var(--md-primary-dark); transform:translateY(-1px); }

        /* Reports */
        .reports-shell{ display:flex; flex-direction:column; gap:22px; }
        .dropzone{
          border:2px dashed var(--md-outline-strong); border-radius:24px; background:#fff; padding:44px 24px;
          display:flex; flex-direction:column; align-items:center; text-align:center; gap:9px; color:var(--md-ink-muted); cursor:pointer;
          transition:all .18s ease;
        }
        .dropzone:hover, .dropzone.active{ border-color:var(--md-primary); background:var(--md-surface-container-high); }
        .dropzone svg{ color:var(--md-primary); }
        .dropzone strong{ color:var(--md-ink-primary); }
        .scan-card{ background:#fff; border:1px solid var(--md-outline); border-radius:20px; padding:24px; box-shadow:var(--shadow-card); }
        .scan-card-head{ display:flex; align-items:center; gap:9px; font-family:var(--font-head); font-weight:700; font-size:14px; color:var(--md-ink-primary); margin-bottom:12px; }
        .spin{ animation:spin 1s linear infinite; color:var(--md-primary); }
        .ok{ color:#2A856A; }
        .err{ color:#C74D4D; }
        .marker-table{ width:100%; border-collapse:collapse; margin:16px 0; font-size:13.5px; }
        .marker-table th{ text-align:left; font-size:11.5px; text-transform:uppercase; letter-spacing:0.06em; color:var(--md-ink-muted); padding:9px 8px; border-bottom:1px solid var(--md-outline); }
        .marker-table td{ padding:11px 8px; border-bottom:1px solid var(--md-outline); color:var(--md-ink-primary); }
        .flag-pill{ font-weight:700; font-size:11px; padding:3px 10px; border-radius:999px; }
        .flag-pill.low{ background:var(--md-amber-container); color:var(--md-amber-on-container); }
        .flag-pill.high{ background:#FDF2F2; color:#991B1B; }
        .flag-pill.normal{ background:#D6EDE5; color:#06332A; }
        .flag-pill.flagged{ background:var(--md-amber-container); color:var(--md-amber-on-container); }
        .past-reports{ background:#fff; border:1px solid var(--md-outline); border-radius:20px; padding:24px; box-shadow:var(--shadow-card); }
        .past-reports h3{ font-size:15px; margin-bottom:14px; }
        .past-reports li{ display:flex; align-items:center; gap:12px; padding:11px 0; border-bottom:1px dashed var(--md-outline); }
        .past-reports li:last-child{ border-bottom:none; }
        .past-reports li svg{ color:var(--md-primary); flex-shrink:0; }
        .past-reports li > div{ flex:1; }
        .past-reports li strong{ display:block; font-size:13.5px; color:var(--md-ink-primary); font-weight:600; }
        .past-reports li span{ font-size:12px; color:var(--md-ink-muted); }

        /* Pipeline Visual */
        .pipeline-card{ background:#fff; border:1px solid var(--md-outline); border-radius:20px; padding:24px 26px; margin-bottom:26px; box-shadow:var(--shadow-card); }
        .pipeline-head{ display:flex; align-items:center; gap:8px; color:var(--md-primary); }
        .pipeline-head h3{ font-size:14.5px; margin:0; color:var(--md-ink-primary); font-weight:700; }
        .pipeline-row{ display:flex; align-items:stretch; gap:6px; overflow-x:auto; margin-top:16px; padding-bottom:4px; }
        .pipeline-step{ display:flex; align-items:center; flex-shrink:0; }
        .pipeline-step-inner{
          display:flex; align-items:center; gap:9px; background:var(--md-surface); border:1px solid var(--md-outline); border-radius:14px; padding:10px 14px; min-width:150px;
        }
        .pipeline-index{
          width:22px; height:22px; border-radius:50%; background:var(--md-primary);
          color:#fff; font-family:var(--font-head); font-weight:700; font-size:10.5px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .pipeline-step-inner strong{ display:block; font-size:12px; color:var(--md-ink-primary); font-weight:700; }
        .pipeline-step-inner span{ font-size:10.5px; color:var(--md-ink-muted); }
        .pipeline-arrow{ color:var(--md-outline-strong); flex-shrink:0; margin:0 3px; }

        /* Digital Health Twin */
        .twin-shell{ display:flex; flex-direction:column; gap:22px; }
        .twin-profile-card{ display:flex; align-items:center; gap:18px; background:linear-gradient(150deg, #144D42 0%, #1B5E50 100%); border-radius:24px; padding:24px 28px; color:#fff; }
        .twin-avatar{ width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.14); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .twin-profile-info h2{ color:#fff; font-size:18px; }
        .twin-profile-info .muted-sm{ color:rgba(235,246,242,0.9); margin-top:3px; }
        .twin-badge{ margin-left:auto; display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.14); border-radius:999px; padding:6px 14px; font-size:12px; font-weight:700; flex-shrink:0; }
        .twin-grid{ display:grid; grid-template-columns:1fr 1fr; gap:18px; }
        .twin-card{ background:#fff; border:1px solid var(--md-outline); border-radius:20px; padding:22px 24px; box-shadow:var(--shadow-card); }
        .twin-card-wide{ grid-column:1 / -1; }
        .twin-card-head{ display:flex; align-items:center; gap:8px; color:var(--md-primary); margin-bottom:12px; }
        .twin-card-head h3{ font-size:14.5px; margin:0; color:var(--md-ink-primary); font-weight:700; }
        .twin-timeline{ display:flex; flex-direction:column; gap:10px; }
        .twin-timeline li{ display:flex; align-items:flex-start; gap:10px; }
        .twin-timeline li strong{ display:block; font-size:13px; color:var(--md-ink-primary); font-weight:600; }
        .twin-timeline li span{ font-size:11.5px; color:var(--md-ink-muted); }
        .twin-tag{ flex-shrink:0; font-weight:700; font-size:10px; padding:3px 8px; border-radius:999px; }
        .twin-tag-symptom{ background:#FDF2F2; color:#991B1B; }
        .twin-tag-lab{ background:#D6EDE5; color:#06332A; }
        .twin-tag-lifestyle{ background:var(--md-surface-container-high); color:var(--md-primary); }

        .risk-card{ border:1px solid var(--md-outline); border-radius:16px; padding:18px 20px; margin-bottom:12px; background:#fff; }
        .risk-card:last-child{ margin-bottom:0; }
        .risk-card-head{ display:flex; align-items:center; gap:9px; margin-bottom:8px; }
        .risk-card-head strong{ color:var(--md-ink-primary); font-size:14px; }
        .example-tag{ margin-left:auto; font-size:10.5px; font-weight:700; color:var(--md-ink-muted); border:1px solid var(--md-outline); border-radius:999px; padding:2px 9px; }
        .level-pill{ font-weight:700; font-size:10.5px; padding:3px 10px; border-radius:999px; flex-shrink:0; }
        .level-l0{ background:#D6EDE5; color:#06332A; } .level-l1{ background:var(--md-amber-container); color:var(--md-amber-on-container); }
        .level-l2{ background:#FDF2F2; color:#991B1B; } .level-l3{ background:#991B1B; color:#fff; }
        .risk-card-l0{ border-left:4px solid #2A856A; } .risk-card-l1{ border-left:4px solid #C27B2B; }
        .risk-card-l2{ border-left:4px solid #C74D4D; } .risk-card-l3{ border-left:4px solid #991B1B; }
        .factor-list{ margin:0 0 8px; padding-left:16px; font-size:13px; color:var(--md-ink-secondary); }
        .factor-list li{ margin-bottom:4px; }
        .risk-next{ display:flex; align-items:flex-start; gap:7px; font-size:13px; color:var(--md-ink-muted); margin-top:8px; line-height:1.5; }
        .risk-next svg{ flex-shrink:0; margin-top:2px; color:var(--md-primary); }

        /* Clinician Portal */
        .clinician-banner{ display:flex; align-items:flex-start; gap:9px; background:var(--md-surface-container-high); color:var(--md-ink-muted); border:1px solid #D6EDE5; border-radius:16px; padding:14px 18px; font-size:13px; line-height:1.55; margin-bottom:20px; }
        .clinician-banner svg{ flex-shrink:0; margin-top:2px; color:var(--md-primary); }
        .clinician-grid{ display:grid; grid-template-columns:310px 1fr; gap:20px; align-items:start; }
        .roster-card{ background:#fff; border:1px solid var(--md-outline); border-radius:20px; padding:20px; box-shadow:var(--shadow-card); }
        .roster-list{ display:flex; flex-direction:column; gap:5px; margin-top:10px; }
        .roster-list li{ display:flex; align-items:center; gap:10px; padding:11px 12px; border-radius:12px; cursor:pointer; transition:all .18s ease; }
        .roster-list li:hover{ background:var(--md-surface-container-high); }
        .roster-list li.selected{ background:var(--md-primary-container); border-left:3px solid var(--md-primary); }
        .roster-info{ flex:1; min-width:0; }
        .roster-info strong{ display:block; font-size:13.5px; color:var(--md-ink-primary); font-weight:600; }
        .roster-info span{ font-size:11.5px; color:var(--md-ink-muted); }
        .roster-meta{ display:flex; flex-direction:column; align-items:flex-end; gap:3px; flex-shrink:0; }
        .patient-detail-card{ background:#fff; border:1px solid var(--md-outline); border-radius:20px; padding:24px 26px; box-shadow:var(--shadow-card); }
        .patient-detail-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--md-outline); }
        .patient-detail-head h3{ font-size:17px; }
        .patient-detail-card h4{ display:flex; align-items:center; gap:6px; font-size:12.5px; text-transform:uppercase; letter-spacing:0.06em; color:var(--md-ink-muted); margin:20px 0 12px; }
        .patient-detail-card h4:first-of-type{ margin-top:0; }
        .event-log{ display:flex; flex-direction:column; gap:9px; }
        .event-log li{ display:flex; align-items:center; gap:10px; font-size:12.5px; padding:9px 0; border-bottom:1px dashed var(--md-outline); }
        .event-log li:last-child{ border-bottom:none; }
        .event-time{ font-family:var(--font-head); font-weight:700; color:var(--md-primary); font-size:11px; width:40px; flex-shrink:0; }
        .event-log li strong{ color:var(--md-ink-primary); width:170px; flex-shrink:0; }
        .event-log li span:last-child{ color:var(--md-ink-muted); }

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
          <span className="brand-mark"><HeartPulse size={17} /></span>
          <span>NARI</span>
        </div>
        <nav className="sidebar-nav">
          <a href="#dashboard" onClick={goTo("dashboard")} className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}>
            <Home size={17} /><span>{t("dashboard")}</span>
          </a>
          <a href="#assistant" onClick={goTo("assistant")} className={`nav-item ${activePage === "assistant" ? "active" : ""}`}>
            <MessageCircle size={17} /><span>{t("assistant")}</span>
          </a>
          <a href="#reports" onClick={goTo("reports")} className={`nav-item ${activePage === "reports" ? "active" : ""}`}>
            <FileText size={17} /><span>{t("reports")}</span>
          </a>
          <a href="#periods" onClick={goTo("periods")} className={`nav-item ${activePage === "periods" ? "active" : ""}`}>
            <Droplets size={17} /><span>{t("periods")}</span>
          </a>
          <a href="#twin" onClick={goTo("twin")} className={`nav-item ${activePage === "twin" ? "active" : ""}`}>
            <HeartPulse size={17} /><span>{t("twin")}</span>
          </a>

          <div className="nav-section-label"><span>Lifestyle &amp; Clinic</span></div>
          <a href="#reminders" onClick={goTo("reminders")} className={`nav-item nav-item-secondary ${activePage === "reminders" ? "active" : ""}`}>
            <Pill size={17} /><span>{t("reminders")}</span>
          </a>
          <a href="#activity" onClick={goTo("activity")} className={`nav-item nav-item-secondary ${activePage === "activity" ? "active" : ""}`}>
            <Activity size={17} /><span>{t("activity")}</span>
          </a>
          <a href="#clinician" onClick={goTo("clinician")} className={`nav-item nav-item-secondary ${activePage === "clinician" ? "active" : ""}`}>
            <Stethoscope size={17} /><span>{t("clinician")}</span>
          </a>
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="user-avatar">{user?.guest ? <UserRound size={15} /> : <User size={15} />}</span>
            <div>
              <div className="user-name">{displayName}</div>
              <div className="user-sub">{user?.guest ? "Guest session" : "Health twin synced"}</div>
            </div>
          </div>
          <button className="signout-btn" onClick={handleSignOut}>
            <LogOut size={13} /><span>{user?.guest ? t("exit_guest") : t("sign_out")}</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="main-col">
        <header className="topbar">
          <div className="topbar-title">{t(activePage) || activePage}</div>
          <div className="topbar-actions">
            {/* Multilingual Selector */}
            <div className="lang-pill-container" title="Select Indian Language">
              <Globe size={15} />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                aria-label="Language Selector"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native} ({l.name})
                  </option>
                ))}
              </select>
            </div>

            {user?.guest && (
              <div className="guest-banner">
                <span>{t("guest_banner")}</span>
                <button onClick={() => setView("login")}>{t("sign_in")}</button>
              </div>
            )}
            <button className="icon-btn" onClick={() => setShowNotifPanel((v) => !v)} aria-label="Notifications">
              <Bell size={18} />
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
                          <strong>All peaceful &amp; up-to-date</strong>
                          <span>Medication reminders and lab observations will appear here.</span>
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
                  <p className="eyebrow-sm">{t("dashboard_overview")}</p>
                  <h1>{t("welcome_back")}, {displayName}</h1>
                  <p className="muted">{t("dashboard_sub")}</p>
                </div>
                <div className="quick-actions">
                  <a href="#assistant" onClick={goTo("assistant")} className="qa-btn primary"><MessageCircle size={14} />{t("consult_assistant")}</a>
                  <a href="#periods" onClick={goTo("periods")} className="qa-btn"><Droplets size={14} />{t("track_periods")}</a>
                  <a href="#reports" onClick={goTo("reports")} className="qa-btn"><Upload size={14} />{t("scan_report")}</a>
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
                        <div className="stat-label">{t("consultations")}</div>
                        <div className="stat-value">{userTurns}</div>
                        <div className="stat-sub">{userTurns === 0 ? "Ask your first question" : "This session"}</div>
                      </div>
                      <div className="stat-card">
                        <TrendingDown size={18} className="stat-icon teal" />
                        <div className="stat-label">{t("latest_lab_status")}</div>
                        <div className="stat-value">{latestReport ? latestReport.statusLabel : "None yet"}</div>
                        <div className="stat-sub">{latestReport ? latestReport.name : "Upload a PDF or photo report"}</div>
                      </div>
                      <div className="stat-card">
                        <AlertTriangle size={18} className="stat-icon rose" />
                        <div className="stat-label">{t("clinical_observations")}</div>
                        <div className="stat-value">{sessionRiskSignals.length}</div>
                        <div className="stat-sub">{latestRisk ? `${latestRisk.domain} (${latestRisk.level})` : "None flagged this session"}</div>
                      </div>
                      <div className="stat-card">
                        <FileText size={18} className="stat-icon violet" />
                        <div className="stat-label">{t("reports_on_record")}</div>
                        <div className="stat-value">{pastReports.length}</div>
                        <div className="stat-sub">{pastReports.length === 0 ? "Nothing uploaded yet" : "In current session"}</div>
                      </div>
                    </>
                  );
                })()}
              </section>

              <section className="pipeline-card">
                <div className="pipeline-head">
                  <Network size={15} />
                  <h3>{t("pipeline_title")}</h3>
                </div>
                <p className="muted-sm" style={{ margin: "4px 0 0", color: "var(--md-ink-muted)", fontSize: "12px" }}>
                  {t("pipeline_sub")}
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
                <h3>{t("recent_activity")}</h3>
                {(() => {
                  const items = [];
                  sessionRiskSignals.slice(0, 3).forEach((r, i) => {
                    items.push({
                      key: `risk-${i}`,
                      dot: "rose",
                      title: `${r.domain} pattern observed (${r.level})`,
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
                      <p className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "13px" }}>
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
                    <span>{t("new_chat")}</span>
                  </button>
                  <button className={`tool-btn ${speakEnabled ? "on" : ""}`} onClick={() => setSpeakEnabled((v) => !v)}>
                    {speakEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    <span>{speakEnabled ? t("voice_on") : t("voice_off")}</span>
                  </button>
                </div>
              </div>

              <div className="chat-disclaimer">
                <Info size={12} />
                <span>{t("chat_disclaimer")}</span>
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
                          <summary>View Contributory Health Factors</summary>
                          <div className="expand-body">
                            <ul>
                              {m.riskSignal.factors.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </div>
                        </details>
                      )}

                      {m.evidence && m.evidence.length > 0 && (
                        <details className="expand-panel">
                          <summary>Referenced Clinical Protocols ({m.evidence.length})</summary>
                          <div className="expand-body">
                            <ul>
                              {m.evidence.slice(0, 3).map((e) => (
                                <li key={e.chunk_id}>
                                  {e.source_url ? (
                                    <a href={e.source_url} target="_blank" rel="noreferrer" style={{ color: "var(--md-primary)", textDecoration: "underline" }}>{e.source_title}</a>
                                  ) : (
                                    e.source_title
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </details>
                      )}

                      {m.isGuestLimit && (
                        <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #D5E2DC" }}>
                          <button
                            onClick={() => setView("login")}
                            className="qa-btn primary"
                            style={{
                              background: "var(--md-primary)",
                              color: "#fff",
                              padding: "10px 18px",
                              fontSize: "13px",
                              fontWeight: "700",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              boxShadow: "0 2px 8px rgba(27,94,80,0.25)",
                              borderRadius: "999px",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            Create Free Account / Sign In <ChevronRight size={14} />
                          </button>
                        </div>
                      )}

                      {m.sender === "assistant" && (
                        <div className="msg-footer">
                          <button className="msg-action-btn" onClick={() => copyMessage(m.id, m.text)}>
                            {copiedId === m.id ? <Check size={12} color="#2A856A" /> : <Copy size={12} />}
                            <span>{copiedId === m.id ? t("copied") : t("copy")}</span>
                          </button>
                          <button className="msg-action-btn" onClick={() => speak(m.text)}>
                            <Volume2 size={12} />
                            <span>{t("listen")}</span>
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
                  {suggestedList.map((p) => (
                    <button key={p} className="chip" onClick={() => handleSend(p)}>{p}</button>
                  ))}
                </div>
              )}

              {voiceError && <div className="voice-error" style={{ color: "#C74D4D", fontSize: "12px", padding: "0 22px 8px" }}>{voiceError}</div>}

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
                  placeholder={isListening ? t("listening") : t("ask_nari_placeholder")}
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
                <span className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "12.5px" }}>Scanned PDF or photo (PNG, JPG) · Parsed via Tesseract &amp; Clinical OCR</span>
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
                    <p className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "13px" }}>
                      Extracting text layers, performing OCR analysis, and translating medical biomarker parameters into clear explanations…
                    </p>
                  )}

                  {scanState === "error" && <p className="muted-sm" style={{ color: "#C74D4D", fontSize: "13px" }}>{scanErrorText}</p>}

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
                              <td><span className={`flag-pill ${(STATUS_TO_FLAG[m.status] || "flagged").toLowerCase()}`}>{STATUS_TO_FLAG[m.status] || "Observation"}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button className="qa-btn" onClick={resetScan} style={{ border: "1px solid var(--md-outline)", marginTop: "10px" }}>
                        Scan another document <ChevronRight size={13} />
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="past-reports">
                <h3>Uploaded Pathology Records</h3>
                <ul>
                  {pastReports.length === 0 && <li><span className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "13px" }}>No previous lab records uploaded yet.</span></li>}
                  {pastReports.map((r) => (
                    <li
                      key={r.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        if (r.metrics && r.metrics.length > 0) {
                          setScanResult({ report_id: r.id, metrics: r.metrics });
                          setReportFile({ name: r.name });
                          setScanState("done");
                          showToast(`Loaded ${r.name}`);
                        }
                      }}
                      title="Click to view biomarker chart"
                    >
                      <FileText size={15} />
                      <div><strong>{r.name}</strong><span>{r.date} · Click to inspect</span></div>
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
                  <p className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "12.5px" }}>Cycle length variance (days) across recent cycles.</p>
                  <CycleRing lengths={DEMO_CYCLE_LENGTHS} />
                  <p className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "12.5px", marginTop: "10px" }}>
                    Variance of 11 days observed across recent cycles — factored into longitudinal risk calculations.
                  </p>
                </section>

                <section className="twin-card">
                  <div className="twin-card-head"><Activity size={15} /><h3>Logged Physical &amp; Mood Signals</h3></div>
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
                              <td><span className={`flag-pill ${(STATUS_TO_FLAG[m.status] || "flagged").toLowerCase()}`}>{STATUS_TO_FLAG[m.status] || "Observation"}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "13px" }}>
                      No recent lab data scanned in this session. <a href="#reports" onClick={goTo("reports")} style={{ color: "var(--md-primary)", fontWeight: 700, textDecoration: "underline" }}>Scan a lab report</a> to import values into your twin.
                    </p>
                  )}
                </section>

                <section className="twin-card twin-card-wide">
                  <div className="twin-card-head"><ShieldCheck size={15} /><h3>Explainable Risk Signals</h3></div>
                  <p className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "12.5px" }}>
                    {sessionRiskSignals.length > 0
                      ? "Generated by the Risk Assessment agent based on verified clinical criteria and guidelines."
                      : "Example risk signals based on active profile criteria. Consult the assistant to generate live signals."}
                  </p>
                  {(sessionRiskSignals.length > 0 ? sessionRiskSignals : DEMO_RISK_SIGNALS).map((r, i) => (
                    <div className={`risk-card risk-card-${(r.level || "L0").toLowerCase()}`} key={i}>
                      <div className="risk-card-head">
                        <span className={`level-pill level-${(r.level || "L0").toLowerCase()}`}>{r.level} · {LEVEL_LABEL[r.level] || "Observation"}</span>
                        <strong>{r.domain}</strong>
                        {r.example && <span className="example-tag">Demonstration</span>}
                      </div>
                      <ul className="factor-list">
                        {(r.factors || []).map((f, fi) => <li key={fi}>{f}</li>)}
                      </ul>
                      <p className="muted-sm" style={{ fontSize: "12px", color: "var(--md-ink-muted)" }}><em>{r.confidence_note}</em></p>
                      {r.next_step && <p className="risk-next"><Target size={13} />{r.next_step}</p>}
                      {r.when_to_seek_care && <p className="risk-next"><AlertTriangle size={13} />Clinical care: {r.when_to_seek_care}</p>}
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
                        <div className="evidence-list" style={{ marginTop: "12px" }}>
                          {sessionCarePlan.evidence.map((e, i) => (
                            <div key={i} className="evidence-item" style={{ fontSize: "12px", color: "var(--md-ink-muted)" }}><BookOpen size={12} /> {e.source}</div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "13px" }}>
                      Care plans are automatically composed during consultations when symptoms, risk factors, and clinical guidelines align. Ask the assistant a health question to generate an active plan.
                    </p>
                  )}
                </section>
              </div>
            </div>
          )}

          {activePage === "periods" && (
            user?.guest ? (
              <GuestGate
                featureTitle="Secure Menstrual & Period Tracker"
                featureDescription="Tracking your continuous period dates, flow intensity, and hormonal cycle variations requires an authenticated account to keep your reproductive data private and encrypted."
                benefits={[
                  "End-to-end user-isolated storage — never shared or leaked",
                  "Automated cycle phase predictions & fertile window calculation",
                  "Cycle variance analysis that powers NARI's clinical risk engine",
                ]}
                onSignIn={() => setView("login")}
                onGoToChat={() => setActivePage("assistant")}
              />
            ) : (
              <PeriodTrackerPage isGuest={false} />
            )
          )}

          {activePage === "reminders" && (
            user?.guest ? (
              <GuestGate
                featureTitle="Medicine & Prescription Reminders"
                featureDescription="Managing your medication schedules, tracking daily taken logs, and receiving browser notifications requires a secure account to keep your health routines synchronized."
                benefits={[
                  "Encrypted medication schedule & dosage tracking",
                  "Daily taken/missed adherence logs preserved across sessions",
                  "Automated safety interaction checks when adding new medicines",
                ]}
                onSignIn={() => setView("login")}
                onGoToChat={() => setActivePage("assistant")}
              />
            ) : (
              <RemindersPage isGuest={false} />
            )
          )}

          {activePage === "activity" && (
            user?.guest ? (
              <GuestGate
                featureTitle="Daily Activity & Wellness Tracker"
                featureDescription="Logging daily water intake, sleep hours, exercise minutes, and syncing with Google Fit wearable sensors requires an account to maintain longitudinal wellness records."
                benefits={[
                  "Longitudinal hydration, sleep, exercise, and mood logs",
                  "Seamless Google Fit & Health Connect wearable integration",
                  "Trend analysis incorporated directly into your Digital Health Twin",
                ]}
                onSignIn={() => setView("login")}
                onGoToChat={() => setActivePage("assistant")}
              />
            ) : (
              <ActivityTrackerPage isGuest={false} />
            )
          )}

          {activePage === "clinician" && (
            user?.guest ? (
              <GuestGate
                featureTitle="Clinician Oversight Portal"
                featureDescription="Access to multi-patient clinical rosters, risk stratifications, and audit event traces is restricted to registered clinical accounts."
                benefits={[
                  "Multi-patient cohort longitudinal risk stratification",
                  "Verified explainable evidence logs and guideline references",
                  "Structured clinical handoff and care continuity tracking",
                ]}
                onSignIn={() => setView("login")}
                onGoToChat={() => setActivePage("assistant")}
              />
            ) : (
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
                            <span className="muted-sm" style={{ fontSize: "11px", color: "var(--md-ink-muted)" }}>{p.adherence}% adhr</span>
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
                              <p className="muted-sm" style={{ fontSize: "12.5px", color: "var(--md-ink-muted)", marginTop: "2px" }}>{patient.age} yrs · {patient.concern} · Last active {patient.lastActive}</p>
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
                            <p className="muted-sm" style={{ color: "var(--md-ink-muted)", fontSize: "12.5px" }}>No longitudinal data recorded for this patient yet.</p>
                          )}
                        </>
                      );
                    })()}
                  </section>
                </div>
              </div>
            )
          )}
        </main>
      </div>

      {toast && (
        <div className="toast"><CheckCircle2 size={15} /><span>{toast}</span></div>
      )}
    </div>
  );
}