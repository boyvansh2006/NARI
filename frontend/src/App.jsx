import React, { useState, useEffect, useRef } from "react";
import {
  Home, MessageCircle, FileText, Bell, Mic, MicOff, Send, Upload,
  Volume2, VolumeX, X, AlertTriangle, CheckCircle2, Activity, Calendar,
  TrendingDown, Droplets, Sparkles, ChevronRight, User, Loader2,
  HeartPulse, Stethoscope, Network, ShieldCheck, ClipboardCheck, BookOpen,
  Users, Brain, Target, Info
} from "lucide-react";
import { sendChatMessage, voiceConverse, getVoiceStatus, uploadReport, listReports } from "./api.js";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  assistant: "Ask NARI",
  reports: "Reports",
  twin: "Digital Health Twin",
  clinician: "Clinician Portal",
};

// The 7-stage LangGraph pipeline every chat/voice turn runs through
// server-side (backend/app/agents/graph.py). Shown on the dashboard so
// judges can see the multi-agent orchestration at a glance, not just its
// end result in the chat bubble.
const AGENT_PIPELINE = [
  { name: "Emergency Escalation", note: "Always-first safety check" },
  { name: "Router", note: "Picks one specialist agent" },
  { name: "Clinical Knowledge / RAG", note: "Grounds the turn in evidence" },
  { name: "Specialist Agent", note: "Symptom, Lab, Nutrition, Mental, …" },
  { name: "Risk Prediction", note: "Transparent pattern heuristic" },
  { name: "Care Plan", note: "Combines reply + risk + evidence" },
  { name: "Follow-up Care", note: "Schedules continuity check-ins" },
];

// Digital Health Twin demo context for Ananya (the same persona used across
// the dashboard/chat). Cycle + symptom history isn't wired to a real
// ingestion endpoint yet (see README "Known gaps"), so this illustrates the
// intended experience; the Risk Signals & Care Plan sections below it fill
// in with real backend output the moment a chat/voice turn produces one
// (see sessionRiskSignals/sessionCarePlan state).
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

// Clinician Portal demo roster. GGSIPU2617 asks for a "Doctor & Caregiver
// Portal" + "Clinical Decision Support Dashboard" - the backend's schema
// already has everything this view needs (PatientProfile, RiskSignal,
// CarePlan, AgentEventLog in backend/app/database/models.py), but there's
// no auth/clinician-facing API yet (see README "Known gaps"), so this is a
// UI preview over representative data, built to the same field shapes the
// real tables already use.
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
    text: "Hi, I'm your NARI assistant. Ask me about your symptoms, labs, nutrition, or anything else — I'll bring in the right specialist agent for you.",
  },
];

const SUGGESTED_PROMPTS = [
  "Explain my last lab flag",
  "What should I eat this week?",
  "I have cramps today",
  "Book a doctor appointment",
];

const INITIAL_NOTIFICATIONS = [
  { id: 1, text: "Your ferritin trend needs review", time: "2h ago", unread: true },
  { id: 2, text: "Time to log today's symptoms", time: "5h ago", unread: true },
  { id: 3, text: "Appointment reminder: Dr. Mehta tomorrow at 10:00 AM", time: "1d ago", unread: false },
];

const DEMO_PROFILE = { full_name: "Ananya", cycle_day: 18, cycle_phase: "Luteal phase" };

const STATUS_TO_FLAG = { NORMAL: "normal", HIGH: "high", LOW: "low", UNSPECIFIED: "flagged" };

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

export default function NARIApp() {
  const [activePage, setActivePage] = useState("dashboard");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false); // browser SpeechRecognition
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  // Server voice pipeline availability (faster-whisper/Piper,
  // wrapped behind /api/v1/voice). Falls back to the browser's own
  // SpeechRecognition/speechSynthesis when either isn't configured.
  const [sttAvailable, setSttAvailable] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastTranscriptRef = useRef("");
  const useServerStt = sttAvailable;
  const micSupported = sttAvailable || voiceSupported;

  // Reports state
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [reportFile, setReportFile] = useState(null);
  const [scanState, setScanState] = useState("idle"); // idle | scanning | done | error
  const [scanResult, setScanResult] = useState(null);
  const [scanErrorText, setScanErrorText] = useState("");
  const [pastReports, setPastReports] = useState([]);

  // Notifications
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [toast, setToast] = useState(null);
  const unreadCount = notifications.filter((n) => n.unread).length;

  // Digital Health Twin: real risk_signal/care_plan objects captured from
  // the LangGraph orchestrator's responses as they arrive during this
  // session (see handleSend/handleVoiceTurn), so the Health Twin page
  // shows genuine explainable AI output the moment the agent graph
  // produces one, falling back to labelled example cards until then.
  const [sessionRiskSignals, setSessionRiskSignals] = useState([]);
  const [sessionCarePlan, setSessionCarePlan] = useState(null);

  // Clinician Portal: which demo patient is currently selected for review.
  const [selectedPatientId, setSelectedPatientId] = useState("p1");

  // Load brand fonts
  useEffect(() => {
    const l1 = document.createElement("link");
    l1.rel = "preconnect";
    l1.href = "https://fonts.googleapis.com";
    const l2 = document.createElement("link");
    l2.rel = "stylesheet";
    l2.href =
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Source+Sans+3:wght@400;500;600;700&display=swap";
    document.head.appendChild(l1);
    document.head.appendChild(l2);
    return () => {
      l1.remove();
      l2.remove();
    };
  }, []);

  // Poll voice pipeline status once on mount
  useEffect(() => {
    getVoiceStatus()
      .then((s) => {
        setSttAvailable(!!s.stt_available);
        setTtsAvailable(!!s.tts_available);
      })
      .catch(() => {
        setSttAvailable(false);
        setTtsAvailable(false);
      });
  }, []);

  // Initial reports fetch
  useEffect(() => {
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
  }, []);

  // Set up browser SpeechRecognition (fallback if server STT isn't active)
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
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_#`]/g, "").slice(0, 320);
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.0;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
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
    } catch (err) {
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

  // Text chat -> LangGraph orchestrator
  const handleSend = async (overrideText) => {
    const text = (typeof overrideText === "string" ? overrideText : input).trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: Date.now(), sender: "user", text }]);
    setInput("");
    setIsTyping(true);
    try {
      const res = await sendChatMessage(text, recentHistoryPayload(), DEMO_PROFILE);
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
    }
  };

  // Voice-to-voice turn
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

  // Report upload
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

  return (
    <div className="app-shell">
      <style>{`
        :root{
          --deep-violet:#34205F; --primary-purple:#694CD0; --lavender:#E1C3FF;
          --warm-cream:#FFF9EF; --health-teal:#3F8F87; --soft-rose:#E7A1A8; --yellow:#F4CE45;
          --ink:#2B1B4D; --ink-soft:#5B4A82; --line:rgba(52,32,95,0.12); --panel:#ffffff;
          --font-head:'Plus Jakarta Sans',sans-serif; --font-body:'Source Sans 3',sans-serif;
        }
        .app-shell *{box-sizing:border-box;}
        .app-shell{
          display:flex; min-height:100vh; background:var(--warm-cream); color:var(--ink);
          font-family:var(--font-body); font-size:15px;
        }
        .app-shell h1,.app-shell h2,.app-shell h3{font-family:var(--font-head);color:var(--deep-violet);margin:0;}
        .app-shell a{text-decoration:none;color:inherit;}
        .app-shell button{font-family:inherit;cursor:pointer;}
        .app-shell ul{list-style:none;margin:0;padding:0;}

        /* Sidebar */
        .sidebar{
          width:220px; flex-shrink:0; background:var(--deep-violet); color:var(--warm-cream);
          display:flex; flex-direction:column; padding:22px 16px; position:sticky; top:0; height:100vh;
        }
        .brand{display:flex;align-items:center;gap:10px;font-family:var(--font-head);font-weight:800;font-size:18px;padding:0 8px 26px;}
        .brand-mark{width:24px;height:24px;border-radius:50%;border:2px solid var(--lavender);position:relative;flex-shrink:0;}
        .brand-mark::after{content:'';position:absolute;top:50%;left:50%;width:7px;height:7px;border-radius:50%;background:var(--soft-rose);transform:translate(-50%,-50%);}
        .sidebar-nav{display:flex;flex-direction:column;gap:4px;flex:1;}
        .nav-item{
          display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;
          font-family:var(--font-head);font-weight:600;font-size:14px;color:rgba(255,249,239,0.7);
          transition:background .2s ease,color .2s ease;
        }
        .nav-item:hover{background:rgba(255,249,239,0.08);color:#fff;}
        .nav-item.active{background:var(--primary-purple);color:#fff;}
        .sidebar-foot{border-top:1px solid rgba(255,249,239,0.14);padding-top:16px;margin-top:12px;}
        .user-chip{display:flex;align-items:center;gap:10px;}
        .user-avatar{width:30px;height:30px;border-radius:50%;background:var(--primary-purple);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .user-name{font-family:var(--font-head);font-weight:700;font-size:13px;}
        .user-sub{font-size:11.5px;color:rgba(255,249,239,0.6);}

        /* Main column */
        .main-col{flex:1;display:flex;flex-direction:column;min-width:0;}
        .topbar{
          display:flex;align-items:center;justify-content:space-between;padding:18px 32px;
          border-bottom:1px solid var(--line);background:rgba(255,249,239,0.9);position:sticky;top:0;z-index:10;
        }
        .topbar-title{font-family:var(--font-head);font-weight:700;font-size:18px;color:var(--deep-violet);}
        .topbar-actions{position:relative;}
        .icon-btn{
          position:relative;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);
          background:#fff;display:flex;align-items:center;justify-content:center;color:var(--deep-violet);
        }
        .badge{
          position:absolute;top:-4px;right:-4px;background:var(--soft-rose);color:#4a1f27;
          font-size:10px;font-weight:700;border-radius:100px;padding:1px 5px;font-family:var(--font-head);
        }
        .notif-backdrop{position:fixed;inset:0;z-index:20;}
        .notif-panel{
          position:absolute;top:48px;right:0;width:320px;background:#fff;border:1px solid var(--line);
          border-radius:16px;box-shadow:0 20px 46px rgba(52,32,95,0.18);z-index:21;overflow:hidden;
        }
        .notif-panel-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);font-family:var(--font-head);font-weight:700;font-size:13.5px;}
        .notif-panel-head button{background:none;border:none;color:var(--ink-soft);}
        .notif-panel ul{max-height:320px;overflow-y:auto;}
        .notif-panel li{display:flex;gap:10px;padding:13px 16px;border-bottom:1px solid var(--line);cursor:pointer;}
        .notif-panel li:last-child{border-bottom:none;}
        .notif-panel li:hover{background:#FCF9F2;}
        .notif-panel li .dot{width:7px;height:7px;border-radius:50%;background:var(--line);margin-top:6px;flex-shrink:0;}
        .notif-panel li.unread .dot{background:var(--primary-purple);}
        .notif-panel li strong{display:block;font-size:13px;font-weight:600;color:var(--deep-violet);line-height:1.4;}
        .notif-panel li span{font-size:11.5px;color:var(--ink-soft);}

        .page{flex:1;padding:28px 32px 48px;max-width:980px;width:100%;}

        /* Toast */
        .toast{
          position:fixed;bottom:24px;right:24px;background:var(--deep-violet);color:#fff;
          padding:13px 18px;border-radius:12px;display:flex;align-items:center;gap:9px;
          font-size:13.5px;box-shadow:0 16px 34px rgba(52,32,95,0.3);z-index:30;
        }

        /* Dashboard */
        .welcome-card{
          background:linear-gradient(120deg,var(--deep-violet),#4a2f82);color:#fff;border-radius:20px;
          padding:30px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;margin-bottom:26px;
        }
        .eyebrow-sm{font-family:var(--font-head);font-weight:700;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--lavender);margin:0 0 6px;}
        .welcome-card h1{color:#fff;font-size:24px;}
        .muted{color:rgba(255,249,239,0.75);font-size:13.5px;margin-top:6px;}
        .quick-actions{display:flex;gap:10px;flex-wrap:wrap;}
        .qa-btn{
          display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:100px;
          font-family:var(--font-head);font-weight:600;font-size:13.5px;background:#fff;color:var(--deep-violet);border:none;
        }
        .qa-btn.primary{background:var(--yellow);color:#4a3600;}
        .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:26px;}
        .stat-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;}
        .stat-icon.rose{color:var(--soft-rose);} .stat-icon.teal{color:var(--health-teal);}
        .stat-icon.purple{color:var(--primary-purple);} .stat-icon.violet{color:var(--deep-violet);}
        .stat-label{font-size:12px;color:var(--ink-soft);margin-top:12px;}
        .stat-value{font-family:var(--font-head);font-weight:700;font-size:19px;color:var(--deep-violet);margin-top:3px;}
        .stat-sub{font-size:11.5px;color:var(--ink-soft);margin-top:3px;}
        .activity-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px;}
        .activity-card h3{font-size:15px;margin-bottom:16px;}
        .activity-list li{display:flex;gap:12px;padding:11px 0;border-bottom:1px dashed var(--line);align-items:flex-start;}
        .activity-list li:last-child{border-bottom:none;}
        .activity-list .dot{width:9px;height:9px;border-radius:50%;margin-top:5px;flex-shrink:0;}
        .dot.rose{background:var(--soft-rose);} .dot.teal{background:var(--health-teal);}
        .dot.purple{background:var(--primary-purple);} .dot.violet{background:var(--deep-violet);}
        .activity-list strong{display:block;font-size:13.5px;color:var(--deep-violet);font-weight:600;}
        .activity-list span{font-size:11.5px;color:var(--ink-soft);}

        /* Chat */
        .chat-shell{display:flex;flex-direction:column;height:calc(100vh - 160px);max-height:720px;background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden;}
        .chat-toolbar{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--line);}
        .chat-toolbar-left{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink-soft);}
        .speak-toggle{display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;border-radius:100px;padding:7px 12px;font-size:12px;font-weight:600;color:var(--ink-soft);}
        .speak-toggle.on{background:var(--lavender);color:var(--deep-violet);border-color:transparent;}
        .chat-window{flex:1;overflow-y:auto;padding:22px 20px;display:flex;flex-direction:column;gap:14px;}
        .msg-row{display:flex;flex-direction:column;max-width:72%;}
        .msg-row.user{align-self:flex-end;align-items:flex-end;}
        .msg-row.assistant{align-self:flex-start;align-items:flex-start;}
        .agent-tag{font-family:var(--font-head);font-weight:700;font-size:10.5px;letter-spacing:0.05em;text-transform:uppercase;color:var(--primary-purple);margin-bottom:5px;padding-left:2px;}
        .bubble{padding:12px 15px;border-radius:16px;font-size:14px;line-height:1.55;}
        .bubble.user{background:var(--primary-purple);color:#fff;border-bottom-right-radius:4px;}
        .bubble.assistant{background:#F3EEFF;color:var(--ink);border-bottom-left-radius:4px;}
        .bubble.assistant.urgent{background:#FBE4E6;color:#6b1f27;border:1px solid var(--soft-rose);}
        .bubble.typing{display:flex;gap:4px;padding:14px 16px;}
        .bubble.typing span{width:6px;height:6px;border-radius:50%;background:var(--ink-soft);opacity:0.5;animation:blink 1.2s infinite ease-in-out;}
        .bubble.typing span:nth-child(2){animation-delay:0.2s;} .bubble.typing span:nth-child(3){animation-delay:0.4s;}
        @keyframes blink{0%,80%,100%{opacity:0.25;} 40%{opacity:0.9;}}
        .risk-flag{display:flex;align-items:flex-start;gap:6px;margin-top:9px;padding:8px 10px;border-radius:10px;font-size:12.5px;line-height:1.4;background:#FFF4E0;color:#7A4B00;border:1px solid #F4CE45;}
        .risk-flag svg{flex-shrink:0;margin-top:1px;}
        .risk-flag.risk-l2,.risk-flag.risk-l3{background:#FBE4E6;color:#6b1f27;border-color:var(--soft-rose);}
        .evidence-list{margin-top:8px;display:flex;flex-direction:column;gap:3px;}
        .evidence-item{font-size:11.5px;color:var(--ink-soft);}
        .evidence-item a{color:var(--primary-purple);text-decoration:underline;}
        .chip-row{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 14px;}
        .chip{border:1px solid var(--line);background:#fff;border-radius:100px;padding:8px 13px;font-size:12.5px;color:var(--deep-violet);font-weight:600;}
        .chip:hover{background:var(--lavender);border-color:transparent;}
        .voice-error{display:flex;align-items:center;gap:7px;padding:0 20px 10px;color:#8a4a30;font-size:12px;}
        .chat-input-row{display:flex;align-items:center;gap:10px;padding:14px 20px;border-top:1px solid var(--line);}
        .mic-btn{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center;color:var(--deep-violet);flex-shrink:0;}
        .mic-btn.listening{background:var(--soft-rose);color:#fff;border-color:transparent;animation:mic-pulse 1.4s infinite;}
        .mic-btn.disabled{opacity:0.4;cursor:not-allowed;}
        @keyframes mic-pulse{0%{box-shadow:0 0 0 0 rgba(231,161,168,0.5);}100%{box-shadow:0 0 0 10px rgba(231,161,168,0);}}
        .chat-input{flex:1;border:1px solid var(--line);border-radius:100px;padding:11px 16px;font-size:14px;font-family:var(--font-body);outline:none;}
        .chat-input:focus{border-color:var(--primary-purple);}
        .send-btn{width:38px;height:38px;border-radius:50%;background:var(--primary-purple);color:#fff;border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;}

        /* Reports */
        .reports-shell{display:flex;flex-direction:column;gap:22px;}
        .dropzone{
          border:2px dashed var(--line);border-radius:18px;background:#fff;padding:40px 20px;
          display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;color:var(--ink-soft);cursor:pointer;
        }
        .dropzone.active{border-color:var(--primary-purple);background:#F8F5FF;}
        .dropzone svg{color:var(--primary-purple);}
        .dropzone strong{color:var(--deep-violet);}
        .muted-sm{font-size:12px;color:var(--ink-soft);}
        .scan-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;}
        .scan-card-head{display:flex;align-items:center;gap:9px;font-family:var(--font-head);font-weight:700;font-size:14px;color:var(--deep-violet);margin-bottom:10px;}
        .spin{animation:spin 1s linear infinite;color:var(--primary-purple);}
        @keyframes spin{to{transform:rotate(360deg);}}
        .ok{color:var(--health-teal);}
        .err{color:#b23b4a;}
        .marker-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13.5px;}
        .marker-table th{text-align:left;font-family:var(--font-head);font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-soft);padding:8px 6px;border-bottom:1px solid var(--line);}
        .marker-table td{padding:10px 6px;border-bottom:1px solid var(--line);color:var(--ink);}
        .flag-pill{font-family:var(--font-head);font-weight:700;font-size:11px;padding:4px 10px;border-radius:100px;text-transform:capitalize;}
        .flag-pill.low, .flag-pill.flagged{background:#FBEADB;color:#8a4a30;}
        .flag-pill.high{background:#FBE4E6;color:#6b1f27;}
        .flag-pill.normal{background:#E6F2F0;color:#215a52;}
        .past-reports{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;}
        .past-reports h3{font-size:15px;margin-bottom:14px;}
        .past-reports li{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px dashed var(--line);}
        .past-reports li:last-child{border-bottom:none;}
        .past-reports li svg{color:var(--primary-purple);flex-shrink:0;}
        .past-reports li > div{flex:1;}
        .past-reports li strong{display:block;font-size:13.5px;color:var(--deep-violet);font-weight:600;}
        .past-reports li span{font-size:11.5px;color:var(--ink-soft);}

        /* Agent pipeline strip (Dashboard) */
        .pipeline-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px 24px;margin-bottom:26px;}
        .pipeline-head{display:flex;align-items:center;gap:8px;color:var(--primary-purple);}
        .pipeline-head h3{font-size:14.5px;margin:0;color:var(--deep-violet);}
        .pipeline-card code{background:#F3EEFF;color:var(--primary-purple);padding:1px 5px;border-radius:5px;font-size:11.5px;}
        .pipeline-row{display:flex;align-items:stretch;gap:2px;overflow-x:auto;margin-top:16px;padding-bottom:4px;}
        .pipeline-step{display:flex;align-items:center;flex-shrink:0;}
        .pipeline-step-inner{display:flex;align-items:center;gap:9px;background:#FCFAF5;border:1px solid var(--line);border-radius:12px;padding:9px 13px;min-width:150px;}
        .pipeline-index{width:20px;height:20px;border-radius:50%;background:var(--primary-purple);color:#fff;font-family:var(--font-head);font-weight:700;font-size:10.5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .pipeline-step-inner strong{display:block;font-size:12px;color:var(--deep-violet);font-weight:700;line-height:1.3;}
        .pipeline-step-inner span{font-size:10.5px;color:var(--ink-soft);}
        .pipeline-arrow{color:var(--line);flex-shrink:0;margin:0 3px;}

        /* Health Twin page */
        .twin-shell{display:flex;flex-direction:column;gap:20px;}
        .twin-profile-card{display:flex;align-items:center;gap:16px;background:linear-gradient(120deg,var(--deep-violet),#4a2f82);border-radius:18px;padding:22px 26px;color:#fff;}
        .twin-avatar{width:46px;height:46px;border-radius:50%;background:var(--primary-purple);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .twin-profile-info h2{color:#fff;font-size:18px;}
        .twin-profile-info .muted-sm{color:rgba(255,249,239,0.8);margin-top:4px;}
        .twin-badge{margin-left:auto;display:inline-flex;align-items:center;gap:6px;background:rgba(255,249,239,0.16);border-radius:100px;padding:7px 13px;font-size:12px;font-weight:600;flex-shrink:0;}
        .twin-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
        .twin-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px 22px;}
        .twin-card-wide{grid-column:1 / -1;}
        .twin-card-head{display:flex;align-items:center;gap:8px;color:var(--primary-purple);margin-bottom:10px;}
        .twin-card-head h3{font-size:14px;margin:0;color:var(--deep-violet);}
        .twin-card a{color:var(--primary-purple);text-decoration:underline;}
        .cycle-bars{display:flex;align-items:flex-end;gap:10px;height:110px;margin:14px 0 8px;}
        .cycle-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px;}
        .cycle-bar{width:100%;max-width:26px;background:linear-gradient(180deg,var(--lavender),var(--primary-purple));border-radius:6px 6px 2px 2px;}
        .cycle-bar-col span{font-size:10.5px;color:var(--ink-soft);}
        .twin-timeline{display:flex;flex-direction:column;gap:12px;}
        .twin-timeline li{display:flex;align-items:flex-start;gap:10px;}
        .twin-timeline li strong{display:block;font-size:13px;color:var(--deep-violet);font-weight:600;}
        .twin-timeline li span{font-size:11px;color:var(--ink-soft);}
        .twin-tag{flex-shrink:0;font-family:var(--font-head);font-weight:700;font-size:10px;padding:3px 8px;border-radius:100px;margin-top:1px;}
        .twin-tag-symptom{background:#FBE4E6;color:#6b1f27;}
        .twin-tag-lab{background:#E6F2F0;color:#215a52;}
        .twin-tag-lifestyle{background:#F3EEFF;color:var(--primary-purple);}

        /* Risk signal / level styling (shared: twin + clinician) */
        .risk-card{border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:12px;}
        .risk-card:last-child{margin-bottom:0;}
        .risk-card-head{display:flex;align-items:center;gap:9px;margin-bottom:8px;}
        .risk-card-head strong{font-family:var(--font-head);color:var(--deep-violet);font-size:13.5px;}
        .example-tag{margin-left:auto;font-size:10px;font-weight:700;color:var(--ink-soft);border:1px solid var(--line);border-radius:100px;padding:2px 8px;}
        .level-pill{font-family:var(--font-head);font-weight:700;font-size:10.5px;padding:4px 10px;border-radius:100px;flex-shrink:0;}
        .level-l0{background:#E6F2F0;color:#215a52;} .level-l1{background:#FFF4E0;color:#7A4B00;}
        .level-l2{background:#FBE4E6;color:#6b1f27;} .level-l3{background:#6b1f27;color:#fff;}
        .risk-card-l0{border-left:4px solid #3F8F87;} .risk-card-l1{border-left:4px solid #F4CE45;}
        .risk-card-l2{border-left:4px solid var(--soft-rose);} .risk-card-l3{border-left:4px solid #6b1f27;}
        .factor-list{margin:0 0 8px;padding-left:18px;font-size:12.5px;color:var(--ink);}
        .factor-list li{margin-bottom:3px;}
        .risk-next{display:flex;align-items:flex-start;gap:6px;font-size:12.5px;color:var(--ink-soft);margin-top:6px;line-height:1.5;}
        .risk-next svg{flex-shrink:0;margin-top:2px;color:var(--primary-purple);}

        /* Clinician Portal page */
        .clinician-banner{display:flex;align-items:flex-start;gap:9px;background:#F3EEFF;color:var(--ink-soft);border:1px solid var(--line);border-radius:12px;padding:12px 16px;font-size:12.5px;line-height:1.5;margin-bottom:18px;}
        .clinician-banner svg{flex-shrink:0;margin-top:2px;color:var(--primary-purple);}
        .clinician-grid{display:grid;grid-template-columns:320px 1fr;gap:18px;align-items:start;}
        .roster-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;}
        .roster-list{display:flex;flex-direction:column;gap:4px;margin-top:8px;}
        .roster-list li{display:flex;align-items:center;gap:10px;padding:11px 8px;border-radius:10px;cursor:pointer;}
        .roster-list li:hover{background:#FCF9F2;}
        .roster-list li.selected{background:var(--lavender);}
        .roster-info{flex:1;min-width:0;}
        .roster-info strong{display:block;font-size:13px;color:var(--deep-violet);font-weight:600;}
        .roster-info span{font-size:11px;color:var(--ink-soft);}
        .roster-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;}
        .level-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
        .level-dot.level-l0{background:#3F8F87;} .level-dot.level-l1{background:#F4CE45;}
        .level-dot.level-l2{background:var(--soft-rose);} .level-dot.level-l3{background:#6b1f27;}
        .patient-detail-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px 24px;}
        .patient-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--line);}
        .patient-detail-head h3{font-size:16px;}
        .patient-detail-card h4{display:flex;align-items:center;gap:7px;font-family:var(--font-head);font-size:12.5px;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-soft);margin:18px 0 10px;}
        .patient-detail-card h4:first-of-type{margin-top:0;}
        .event-log{display:flex;flex-direction:column;gap:9px;}
        .event-log li{display:flex;align-items:center;gap:10px;font-size:12.5px;padding:8px 0;border-bottom:1px dashed var(--line);}
        .event-log li:last-child{border-bottom:none;}
        .event-time{font-family:var(--font-head);font-weight:700;color:var(--primary-purple);font-size:11px;width:40px;flex-shrink:0;}
        .event-log li strong{color:var(--deep-violet);width:170px;flex-shrink:0;}
        .event-log li span:last-child{color:var(--ink-soft);}

        @media (max-width:900px){
          .sidebar{width:72px;padding:18px 10px;}
          .brand span:last-child, .nav-item span, .user-name, .user-sub{display:none;}
          .brand{justify-content:center;padding-bottom:20px;}
          .nav-item{justify-content:center;}
          .user-chip{justify-content:center;}
          .stat-grid{grid-template-columns:repeat(2,1fr);}
          .page{padding:22px 16px 40px;}
          .twin-grid{grid-template-columns:1fr;}
          .clinician-grid{grid-template-columns:1fr;}
          .pipeline-row{flex-wrap:nowrap;}
        }
      `}</style>

      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"></span><span>NARI</span></div>
        <nav className="sidebar-nav">
          <a href="#dashboard" onClick={goTo("dashboard")} className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}>
            <Home size={18} /><span>Dashboard</span>
          </a>
          <a href="#assistant" onClick={goTo("assistant")} className={`nav-item ${activePage === "assistant" ? "active" : ""}`}>
            <MessageCircle size={18} /><span>Assistant</span>
          </a>
          <a href="#reports" onClick={goTo("reports")} className={`nav-item ${activePage === "reports" ? "active" : ""}`}>
            <FileText size={18} /><span>Reports</span>
          </a>
          <a href="#twin" onClick={goTo("twin")} className={`nav-item ${activePage === "twin" ? "active" : ""}`}>
            <HeartPulse size={18} /><span>Health Twin</span>
          </a>
          <a href="#clinician" onClick={goTo("clinician")} className={`nav-item ${activePage === "clinician" ? "active" : ""}`}>
            <Stethoscope size={18} /><span>Clinician Portal</span>
          </a>
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="user-avatar"><User size={15} color="#fff" /></span>
            <div>
              <div className="user-name">Ananya</div>
              <div className="user-sub">Health twin active</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-title">{PAGE_TITLES[activePage]}</div>
          <div className="topbar-actions">
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
                  <h1>Welcome back, Ananya</h1>
                  <p className="muted">Here's where things stand with your health twin today.</p>
                </div>
                <div className="quick-actions">
                  <a href="#assistant" onClick={goTo("assistant")} className="qa-btn primary"><MessageCircle size={15} />Ask the assistant</a>
                  <a href="#reports" onClick={goTo("reports")} className="qa-btn"><Upload size={15} />Scan a report</a>
                </div>
              </section>

              <section className="stat-grid">
                <div className="stat-card"><Droplets size={18} className="stat-icon rose" /><div className="stat-label">Cycle day</div><div className="stat-value">Day 18</div><div className="stat-sub">Luteal phase</div></div>
                <div className="stat-card"><TrendingDown size={18} className="stat-icon teal" /><div className="stat-label">Latest flag</div><div className="stat-value">Ferritin low</div><div className="stat-sub">3rd cycle running</div></div>
                <div className="stat-card"><Activity size={18} className="stat-icon purple" /><div className="stat-label">Adherence</div><div className="stat-value">86%</div><div className="stat-sub">Missed doses on weekends</div></div>
                <div className="stat-card"><Calendar size={18} className="stat-icon violet" /><div className="stat-label">Next appointment</div><div className="stat-value">Tomorrow</div><div className="stat-sub">Dr. Mehta, 10:00 AM</div></div>
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
                <ul className="activity-list">
                  <li><span className="dot rose"></span><div><strong>Logged mild cramps</strong><span>Today, 8:12 AM</span></div></li>
                  <li><span className="dot teal"></span><div><strong>Lab report scanned — ferritin flagged</strong><span>Yesterday, 6:40 PM</span></div></li>
                  <li><span className="dot purple"></span><div><strong>Nutrition plan updated for iron intake</strong><span>2 days ago</span></div></li>
                  <li><span className="dot violet"></span><div><strong>Appointment booked with Dr. Mehta</strong><span>3 days ago</span></div></li>
                </ul>
              </section>
            </>
          )}

          {activePage === "assistant" && (
            <div className="chat-shell">
              <div className="chat-toolbar">
                <div className="chat-toolbar-left">
                  <Sparkles size={15} />
                  <span>Routes to the right specialist agent automatically</span>
                </div>
                <button className={`speak-toggle ${speakEnabled ? "on" : ""}`} onClick={() => setSpeakEnabled((v) => !v)}>
                  {speakEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  <span>{speakEnabled ? "Reading replies aloud" : "Read replies aloud"}</span>
                </button>
              </div>

              <div className="chat-window">
                {messages.map((m) => (
                  <div key={m.id} className={`msg-row ${m.sender}`}>
                    {m.sender === "assistant" && <span className="agent-tag">{m.agent}</span>}
                    <div className={`bubble ${m.sender} ${m.urgent ? "urgent" : ""}`}>
                      {m.text}
                      {m.riskSignal && (
                        <div className={`risk-flag risk-${(m.riskSignal.level || "").toLowerCase()}`}>
                          <AlertTriangle size={13} />
                          <span>
                            {m.riskSignal.domain} pattern flag ({m.riskSignal.level}) — {m.riskSignal.next_step}
                          </span>
                        </div>
                      )}
                      {m.evidence && m.evidence.length > 0 && (
                        <div className="evidence-list">
                          {m.evidence.slice(0, 2).map((e) => (
                            <div key={e.chunk_id} className="evidence-item">
                              Source: {e.source_url ? (
                                <a href={e.source_url} target="_blank" rel="noreferrer">{e.source_title}</a>
                              ) : (
                                e.source_title
                              )}
                            </div>
                          ))}
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
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  placeholder={isListening ? "Listening…" : "Ask about symptoms, labs, nutrition…"}
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
                  <h2>Ananya's Digital Health Twin</h2>
                  <p className="muted-sm">Cycle day 18 · Luteal phase · PCOS pattern &amp; iron levels being monitored</p>
                </div>
                <span className="twin-badge"><HeartPulse size={13} />Twin active</span>
              </section>

              <div className="twin-grid">
                <section className="twin-card">
                  <div className="twin-card-head"><Droplets size={15} /><h3>Reproductive context</h3></div>
                  <p className="muted-sm">Last 6 logged cycle lengths (days) - demo data, not yet wired to a live cycle-tracking endpoint.</p>
                  <div className="cycle-bars">
                    {DEMO_CYCLE_LENGTHS.map((len, i) => (
                      <div className="cycle-bar-col" key={i}>
                        <div className="cycle-bar" style={{ height: `${Math.max(18, (len / 40) * 100)}%` }} />
                        <span>{len}d</span>
                      </div>
                    ))}
                  </div>
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
                      <p>{sessionCarePlan.summary}</p>
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
                            <p>{detail.carePlan.summary}</p>
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