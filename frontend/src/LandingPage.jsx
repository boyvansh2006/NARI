import React, { useEffect, useRef, useState } from "react";
import {
  HeartPulse, ArrowRight, ShieldCheck, Lock, Sparkles, Activity,
  FileText, Watch, Pill, Brain, ClipboardCheck, ChevronRight, Quote
} from "lucide-react";

/** Fades + slides a section up the first time it scrolls into view. */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ as: Tag = "div", className = "", delay = 0, children }) {
  const [ref, visible] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? "in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

function Counter({ to, suffix = "" }) {
  const [ref, visible] = useReveal();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let raf;
    const start = performance.now();
    const dur = 1100;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, to]);
  return <span ref={ref}>{val}{suffix}</span>;
}

const INPUT_STREAMS = [
  { icon: Activity, label: "Symptoms & cycle tracking", text: "Daily logs turn into patterns worth flagging, not just a diary entry.", tone: "purple" },
  { icon: FileText, label: "Lab reports & prescriptions", text: "Upload a PDF once — every marker is parsed, trended and explained.", tone: "teal" },
  { icon: Watch, label: "Wearable device data", text: "Sleep, heart rate and activity feed straight into your health profile.", tone: "rose" },
  { icon: Pill, label: "Medications & adherence", text: "Reminders and interaction checks stay tied to what you're actually taking.", tone: "teal" },
  { icon: Brain, label: "Stress, sleep & mental wellbeing", text: "Mood and sleep are treated as clinical signal, not an afterthought.", tone: "rose" },
  { icon: ClipboardCheck, label: "Clinical history & imaging", text: "Past diagnoses and scans give every new signal proper context.", tone: "purple" },
];

const PIPELINE = [
  { n: "01", title: "Unify every signal", text: "Symptoms, labs, wearables, prescriptions and lifestyle habits are brought into one continuous health profile — not siloed apps." },
  { n: "02", title: "Reason like a care team", text: "A multi-agent system routes each concern to the right specialist logic — symptom triage, labs, nutrition, mental wellbeing, risk, and follow-up." },
  { n: "03", title: "Explain, don't just flag", text: "Every risk signal cites the factors behind it and the evidence it's grounded in, so you and your clinician both understand the 'why'." },
  { n: "04", title: "Support the whole journey", text: "From menstrual health through PCOS, fertility, pregnancy, postpartum and menopause — one profile that grows with you." },
];

const EVIDENCE = ["WHO", "MoHFW", "ICMR", "PubMed"];

const STATS = [
  { to: 12, suffix: "", label: "Specialist care agents", tone: "lav" },
  { to: 15, suffix: "", label: "WHO / MoHFW evidence sources", tone: "rose" },
  { to: 7, suffix: "", label: "Stage reasoning pipeline", tone: "teal" },
  { to: 100, suffix: "%", label: "Explainable risk signals", tone: "yellow" },
];

const DEMO_RING = [26, 31, 24, 33, 27, 35];

/** Small on-palette "bloom" ring for the hero mockup — the signature visual:
 * every logged signal becomes one petal of the cycle ring, sized by value. */
function HeroRing({ lengths = [] }) {
  const size = 208, center = size / 2, maxR = 84, minR = 36;
  const max = Math.max(...lengths, 1);
  const fills = ["#694CD0", "#E7A1A8", "#3F8F87", "#34205F"];
  const darkFills = new Set(["#694CD0", "#34205F"]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 208, display: "block", margin: "6px auto" }}>
      {lengths.map((len, i) => {
        const angle = (i / lengths.length) * 2 * Math.PI - Math.PI / 2;
        const r = minR + (len / max) * (maxR - minR);
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        const petalR = 15 + (len / max) * 9;
        const fill = fills[i % fills.length];
        const textColor = darkFills.has(fill) ? "#FFF9EF" : "#34205F";
        return (
          <g key={i}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="#694CD0" strokeWidth="1.5" opacity="0.18" />
            <circle cx={x} cy={y} r={petalR} fill={fill} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={textColor} fontFamily="'DM Sans',sans-serif">
              {len}
            </text>
          </g>
        );
      })}
      <circle cx={center} cy={center} r={25} fill="#34205F" />
      <text x={center} y={center + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#FFF9EF" fontFamily="'DM Sans',sans-serif">
        cycles
      </text>
    </svg>
  );
}

export default function LandingPage({ onGetStarted, onSignIn, onGuest }) {
  return (
    <div className="land-shell">
      <style>{`
        .land-shell{
          --violet:#34205F; --purple:#694CD0; --lavender:#E1C3FF; --cream:#FFF9EF;
          --teal:#3F8F87; --rose:#E7A1A8; --yellow:#F4CE45; --ink:#22163F;
          --line: rgba(52,32,95,0.1);
          font-family:'DM Sans',-apple-system,sans-serif; color:var(--violet); background:var(--cream); overflow-x:hidden;
          -webkit-font-smoothing:antialiased;
        }
        .land-shell *{ box-sizing:border-box; }
        .land-shell h1,.land-shell h2,.land-shell h3,.land-shell h4{
          font-family:'Sora',sans-serif; margin:0; font-weight:700; letter-spacing:-0.01em;
        }
        .land-shell section{ position:relative; }
        .land-shell button{ font-family:'DM Sans',sans-serif; }

        /* --- Nav --- */
        .land-nav{
          display:flex; align-items:center; justify-content:space-between; padding:18px 56px;
          position:sticky; top:0; z-index:30; background:rgba(255,249,239,0.92); backdrop-filter:blur(10px);
          border-bottom:1px solid var(--line);
        }
        .land-brand{ display:flex; align-items:center; gap:9px; font-family:'Sora',sans-serif; font-weight:700; font-size:18px; color:var(--violet); }
        .land-brand-mark{
          width:32px;height:32px;border-radius:9px; background:var(--violet);
          display:flex; align-items:center; justify-content:center;
        }
        .land-nav-links{ display:flex; gap:34px; }
        .land-nav-links a{ color:rgba(34,22,63,0.62); font-size:14px; font-weight:500; text-decoration:none; transition:color .2s ease; }
        .land-nav-links a:hover{ color:var(--violet); }
        .land-nav-actions{ display:flex; align-items:center; gap:16px; }
        .land-link-btn{ background:none; border:none; color:var(--violet); font-weight:600; font-size:14px; cursor:pointer; }
        .land-cta-btn{
          display:inline-flex; align-items:center; gap:8px; background:var(--violet); color:var(--cream); border:none; border-radius:11px;
          padding:11px 20px; font-weight:600; font-size:13.5px; cursor:pointer; transition:transform .18s ease, background .18s ease;
        }
        .land-cta-btn:hover{ background:var(--purple); transform:translateY(-1px); }

        /* --- Hero: light, on cream, one restrained accent shape --- */
        .land-hero{ background:var(--cream); padding:76px 56px 64px; overflow:hidden; }
        .land-hero-glow{
          position:absolute; width:520px; height:520px; border-radius:50%;
          background:radial-gradient(circle, rgba(105,76,208,0.14) 0%, rgba(105,76,208,0) 68%);
          top:-220px; right:-140px; pointer-events:none;
        }
        .land-hero-grid{ position:relative; z-index:1; max-width:1180px; margin:0 auto; display:grid; grid-template-columns:1.05fr 0.95fr; gap:64px; align-items:center; }
        .land-pill{
          display:inline-flex; align-items:center; gap:8px; background:#fff; border:1px solid var(--line);
          border-radius:100px; padding:7px 15px; font-size:12.5px; font-weight:600; color:var(--purple); margin-bottom:22px;
        }
        .land-acronym{
          font-size:11.5px; font-weight:700; letter-spacing:0.09em; text-transform:uppercase;
          color:rgba(52,32,95,0.42); margin:0 0 14px;
        }
        .land-acronym strong{ color:var(--violet); font-weight:700; }
        .land-hero h1{ font-size:50px; line-height:1.08; font-weight:700; color:var(--violet); margin:0 0 20px; }
        .land-hero h1 em{ font-style:normal; color:var(--purple); position:relative; }
        .land-hero p.lead{ font-size:16px; line-height:1.7; color:rgba(52,32,95,0.68); max-width:500px; margin-bottom:30px; }
        .land-hero-actions{ display:flex; gap:14px; flex-wrap:wrap; margin-bottom:22px; }
        .land-primary-btn{
          display:inline-flex; align-items:center; gap:9px; background:var(--violet); color:var(--cream); border:none; border-radius:12px;
          padding:15px 24px; font-weight:600; font-size:14.5px; cursor:pointer; transition:transform .18s ease, background .18s ease;
        }
        .land-primary-btn:hover{ background:var(--purple); transform:translateY(-2px); }
        .land-secondary-btn{
          display:inline-flex; align-items:center; gap:9px; background:#fff; border:1px solid var(--line);
          color:var(--violet); border-radius:12px; padding:15px 24px; font-weight:600; font-size:14.5px; cursor:pointer; transition:border-color .2s ease, transform .18s ease;
        }
        .land-secondary-btn:hover{ border-color:var(--purple); transform:translateY(-2px); }
        .land-guest-note{ font-size:13px; color:rgba(52,32,95,0.55); }
        .land-guest-note button{ background:none; border:none; color:var(--purple); font-weight:600; cursor:pointer; text-decoration:underline; padding:0; font-size:13px; }
        .land-trust-row{ display:flex; gap:24px; margin-top:26px; flex-wrap:wrap; }
        .land-trust-item{ display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:500; color:rgba(52,32,95,0.55); }
        .land-trust-item svg{ color:var(--teal); flex-shrink:0; }

        /* --- Hero mockup panel --- */
        .land-mock{ position:relative; z-index:1; background:#fff; border-radius:22px; padding:26px; border:1px solid var(--line); box-shadow:0 24px 60px rgba(52,32,95,0.14); }
        .land-mock-head{ display:flex; align-items:center; gap:6px; margin-bottom:18px; }
        .land-mock-dot{ width:8px;height:8px;border-radius:50%; }
        .land-mock-dot.p{ background:var(--purple); }
        .land-mock-dot.y{ background:var(--rose); }
        .land-mock-dot.l{ background:var(--teal); }
        .land-mock-head span{ margin-left:8px; font-size:12px; font-weight:600; color:rgba(52,32,95,0.45); }
        .land-mock-streams{ display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:4px; }
        .land-mock-chip{
          display:flex; align-items:center; gap:6px; background:var(--cream); border:1px solid var(--line); border-radius:100px; padding:6px 12px;
          font-size:11px; font-weight:600; color:var(--purple);
        }
        .land-mock-insight{ display:flex; align-items:center; gap:10px; background:rgba(231,161,168,0.18); border-radius:14px; padding:12px 14px; margin-top:4px; }
        .land-mock-insight .dot{ width:8px;height:8px;border-radius:50%; background:var(--rose); flex-shrink:0; margin-top:3px; align-self:flex-start; }
        .land-mock-insight > div{ display:flex; flex-direction:column; gap:2px; }
        .land-mock-insight span{ font-size:12.5px; font-weight:700; color:var(--violet); }
        .land-mock-insight small{ font-weight:500; color:rgba(52,32,95,0.6); font-size:11px; line-height:1.4; }

        /* --- Evidence strip --- */
        .land-evidence{ display:flex; align-items:center; justify-content:center; gap:28px; flex-wrap:wrap; padding:0 56px 68px; max-width:1180px; margin:0 auto; }
        .land-evidence span.label{ font-size:11.5px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:rgba(52,32,95,0.38); }
        .land-evidence .marks{ display:flex; gap:26px; flex-wrap:wrap; }
        .land-evidence .marks span{ font-family:'Sora',sans-serif; font-weight:700; font-size:15px; color:rgba(52,32,95,0.32); letter-spacing:0.01em; }

        /* --- Reveal utility --- */
        .reveal{ opacity:0; transform:translateY(24px); transition:opacity .6s ease, transform .6s ease; }
        .reveal.in{ opacity:1; transform:translateY(0); }

        /* --- Stats: soft tinted cards, not a solid band --- */
        .land-stats{ padding:0 56px 96px; max-width:1180px; margin:0 auto; }
        .land-stats-row{ display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
        .land-stat{ border-radius:18px; padding:26px 22px; border:1px solid var(--line); }
        .land-stat.lav{ background:rgba(225,195,255,0.28); }
        .land-stat.rose{ background:rgba(231,161,168,0.16); }
        .land-stat.teal{ background:rgba(63,143,135,0.1); }
        .land-stat.yellow{ background:rgba(244,206,69,0.18); }
        .land-stat strong{ display:block; font-family:'Sora',sans-serif; font-size:32px; font-weight:700; color:var(--violet); margin-bottom:4px; }
        .land-stat span{ font-size:12.5px; color:rgba(52,32,95,0.6); font-weight:500; }

        /* --- Features --- */
        .land-features{ background:var(--cream); padding:20px 56px 100px; }
        .land-section-head{ max-width:640px; margin:0 auto 48px; text-align:center; }
        .land-eyebrow{ font-size:12px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--purple); margin-bottom:10px; }
        .land-section-head h2{ font-size:32px; font-weight:700; color:var(--violet); margin-bottom:12px; }
        .land-section-head p{ color:rgba(52,32,95,0.6); font-size:15px; line-height:1.7; }
        .land-feature-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; max-width:1080px; margin:0 auto; }
        .land-feature-card{
          background:#fff; border:1px solid var(--line); border-radius:18px; padding:26px 24px;
          transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease;
        }
        .land-feature-card:hover{ transform:translateY(-5px); box-shadow:0 16px 32px rgba(52,32,95,0.08); border-color:rgba(105,76,208,0.25); }
        .land-feature-icon{
          width:42px;height:42px;border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:16px;
        }
        .land-feature-icon.purple{ background:rgba(105,76,208,0.12); color:var(--purple); }
        .land-feature-icon.teal{ background:rgba(63,143,135,0.14); color:var(--teal); }
        .land-feature-icon.rose{ background:rgba(231,161,168,0.22); color:#c26670; }
        .land-feature-card strong{ display:block; font-family:'Sora',sans-serif; font-weight:600; font-size:15px; color:var(--violet); margin-bottom:6px; }
        .land-feature-card p{ font-size:13.5px; line-height:1.6; color:rgba(52,32,95,0.6); margin:0; }

        /* --- Pipeline: light, editorial, outlined numerals --- */
        .land-pipeline-sec{ background:#fff; padding:96px 56px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
        .land-pipeline{ max-width:860px; margin:0 auto; display:flex; flex-direction:column; gap:0; }
        .land-pipeline-step{ display:flex; gap:26px; padding:26px 0; border-bottom:1px solid var(--line); }
        .land-pipeline-step:last-child{ border-bottom:none; }
        .land-pipeline-num{
          flex-shrink:0; width:50px;height:50px; border-radius:13px; border:1.5px solid rgba(105,76,208,0.3); color:var(--purple);
          display:flex; align-items:center; justify-content:center; font-family:'Sora',sans-serif; font-weight:700; font-size:16px;
        }
        .land-pipeline-step h3{ color:var(--violet); font-size:17px; margin-bottom:6px; font-weight:600; }
        .land-pipeline-step p{ color:rgba(52,32,95,0.6); font-size:14px; line-height:1.65; margin:0; }

        /* --- Privacy --- */
        .land-privacy{ background:rgba(225,195,255,0.22); padding:96px 56px; }
        .land-privacy-grid{ max-width:1080px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:56px; align-items:center; }
        .land-privacy-grid h2{ font-size:30px; color:var(--violet); margin-bottom:16px; font-weight:700; }
        .land-privacy-grid > div:first-child > p{ color:rgba(52,32,95,0.66); font-size:15px; line-height:1.7; margin-bottom:26px; }
        .land-privacy-point{ display:flex; gap:14px; margin-bottom:20px; }
        .land-privacy-point-icon{
          width:36px;height:36px;border-radius:11px; background:var(--violet); color:var(--cream);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .land-privacy-point strong{ display:block; font-family:'Sora',sans-serif; font-weight:600; font-size:14.5px; color:var(--violet); margin-bottom:3px; }
        .land-privacy-point p{ font-size:13.5px; color:rgba(52,32,95,0.62); margin:0; line-height:1.6; }
        .land-quote-card{ background:#fff; border-radius:20px; padding:32px 30px; box-shadow:0 20px 46px rgba(52,32,95,0.12); }
        .land-quote-card svg{ color:var(--purple); margin-bottom:14px; }
        .land-quote-card p{ font-family:'Sora',sans-serif; font-size:18px; line-height:1.55; color:var(--violet); font-weight:600; margin-bottom:14px; }
        .land-quote-card span{ font-size:12.5px; color:rgba(105,76,208,0.85); font-weight:600; }

        /* --- Final CTA: the one bold saturated moment, inset card --- */
        .land-final-wrap{ padding:8px 24px 24px; }
        .land-final-cta{
          background:linear-gradient(135deg, var(--violet) 0%, var(--purple) 100%);
          border-radius:28px; padding:80px 56px; text-align:center; max-width:1180px; margin:0 auto; position:relative; overflow:hidden;
        }
        .land-final-cta h2{ color:var(--cream); font-size:32px; margin-bottom:14px; position:relative; z-index:1; }
        .land-final-cta p{ color:rgba(255,249,239,0.72); font-size:15px; margin-bottom:32px; position:relative; z-index:1; }
        .land-final-actions{ display:flex; gap:14px; justify-content:center; flex-wrap:wrap; position:relative; z-index:1; }
        .land-final-cta .land-primary-btn{ background:var(--yellow); color:var(--violet); }
        .land-final-cta .land-primary-btn:hover{ background:#f7d968; }
        .land-final-cta .land-secondary-btn{ background:transparent; border-color:rgba(255,249,239,0.35); color:var(--cream); }
        .land-final-cta .land-secondary-btn:hover{ background:rgba(255,249,239,0.1); border-color:rgba(255,249,239,0.5); }

        /* --- Footer --- */
        .land-footer{ background:var(--violet); padding-top:44px; overflow:hidden; }
        .land-footer-top{ display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:28px; padding:0 56px 36px; max-width:1180px; margin:0 auto; }
        .land-footer .land-brand{ color:var(--cream); margin-bottom:8px; }
        .land-footer .land-brand-mark{ background:var(--yellow); }
        .land-footer-top p{ font-size:12.5px; color:rgba(255,249,239,0.55); max-width:280px; line-height:1.6; margin:0; }
        .land-footer-links{ display:flex; gap:40px; flex-wrap:wrap; }
        .land-footer-links div strong{ display:block; font-size:11.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,249,239,0.4); margin-bottom:12px; }
        .land-footer-links a{ display:block; color:rgba(255,249,239,0.72); font-size:13.5px; text-decoration:none; margin-bottom:9px; font-weight:500; }
        .land-footer-links a:hover{ color:var(--cream); }
        .land-footer-bottom{ border-top:1px solid rgba(255,249,239,0.1); padding:18px 56px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
        .land-footer-bottom span{ font-size:12px; color:rgba(255,249,239,0.5); }
        .land-footer-wordmark{
          font-family:'Sora',sans-serif; font-weight:700; color:rgba(255,249,239,0.06); font-size:min(19vw,220px);
          line-height:0.75; text-align:center; letter-spacing:-0.02em; margin-top:8px; user-select:none; pointer-events:none;
        }

        @media (max-width:920px){
          .land-nav{ padding:16px 20px; }
          .land-nav-links{ display:none; }
          .land-hero{ padding:52px 22px 44px; }
          .land-hero-grid{ grid-template-columns:1fr; gap:40px; }
          .land-hero h1{ font-size:34px; }
          .land-evidence{ padding:0 22px 48px; }
          .land-stats{ padding:0 22px 64px; }
          .land-stats-row{ grid-template-columns:repeat(2,1fr); }
          .land-feature-grid{ grid-template-columns:1fr; }
          .land-privacy-grid{ grid-template-columns:1fr; }
          .land-features, .land-pipeline-sec, .land-privacy{ padding:56px 22px; }
          .land-final-cta{ padding:56px 24px; border-radius:22px; }
          .land-footer-top{ padding:0 22px 30px; }
          .land-footer-bottom{ padding:16px 22px; }
        }
      `}</style>

      {/* Nav */}
      <nav className="land-nav">
        <div className="land-brand" title="Nurturing Agentic Responsive Intelligence">
          <span className="land-brand-mark"><HeartPulse size={15} color="#FFF9EF" /></span>
          NARI
        </div>
        <div className="land-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
        </div>
        <div className="land-nav-actions">
          <button className="land-link-btn" onClick={onSignIn}>Sign in</button>
          <button className="land-cta-btn" onClick={onGetStarted}>Get started <ArrowRight size={14} /></button>
        </div>
      </nav>

      {/* Hero */}
      <section className="land-hero">
        <span className="land-hero-glow" />
        <div className="land-hero-grid">
          <div className="land-hero-copy">
            <p className="land-acronym"><strong>NARI</strong> — Nurturing Agentic Responsive Intelligence</p>
            <div className="land-pill"><Sparkles size={13} />Agentic multimodal women's health intelligence</div>
            <h1>Every stage of your health, <em>understood together.</em></h1>
            <p className="lead">
              NARI unifies symptoms, lab reports, prescriptions, wearable data, nutrition, sleep,
              hormonal cycles and clinical history into one continuously-learning health profile —
              spanning menstrual health, PCOS, fertility, pregnancy, postpartum and menopause —
              with explainable, evidence-grounded guidance at every step.
            </p>
            <div className="land-hero-actions">
              <button className="land-primary-btn" onClick={onGetStarted}>Start your health journey <ArrowRight size={16} /></button>
              <button className="land-secondary-btn" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
                See how it works
              </button>
            </div>
            <p className="land-guest-note">
              Just exploring? <button onClick={onGuest}>Continue as guest</button> — no sign-up needed.
            </p>
            <div className="land-trust-row">
              <div className="land-trust-item"><ShieldCheck size={15} />Built for clinical safety boundaries</div>
              <div className="land-trust-item"><Lock size={15} />Privacy-first by design</div>
            </div>
          </div>

          <div className="land-mock">
            <div className="land-mock-head">
              <span className="land-mock-dot p" /><span className="land-mock-dot y" /><span className="land-mock-dot l" />
              <span>Digital Health Twin</span>
            </div>
            <div className="land-mock-streams">
              <div className="land-mock-chip"><Activity size={12} />Symptoms</div>
              <div className="land-mock-chip"><FileText size={12} />Labs</div>
              <div className="land-mock-chip"><Watch size={12} />Wearables</div>
              <div className="land-mock-chip"><Pill size={12} />Meds</div>
            </div>
            <HeroRing lengths={DEMO_RING} />
            <div className="land-mock-insight">
              <span className="dot" />
              <div>
                <span>Ferritin trending low</span>
                <small>Flagged from your last lab upload, evidence linked</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Evidence strip */}
      <div className="land-evidence">
        <span className="label">Grounded in evidence from</span>
        <div className="marks">
          {EVIDENCE.map((e) => <span key={e}>{e}</span>)}
        </div>
      </div>

      {/* Stats */}
      <section className="land-stats">
        <div className="land-stats-row">
          {STATS.map((s) => (
            <div className={`land-stat ${s.tone}`} key={s.label}>
              <strong><Counter to={s.to} suffix={s.suffix} /></strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="land-features" id="features">
        <Reveal className="land-section-head">
          <p className="land-eyebrow">Unified intelligence</p>
          <h2>One profile, every signal that matters.</h2>
          <p>
            Instead of fragmented apps for symptom logging, appointments or reports, NARI continuously
            builds a single Digital Health Twin from every source of information you bring it.
          </p>
        </Reveal>
        <div className="land-feature-grid">
          {INPUT_STREAMS.map((f, i) => (
            <Reveal key={f.label} delay={i * 80}>
              <div className="land-feature-card">
                <div className={`land-feature-icon ${f.tone}`}><f.icon size={19} /></div>
                <strong>{f.label}</strong>
                <p>{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="land-pipeline-sec" id="how-it-works">
        <Reveal className="land-section-head">
          <p className="land-eyebrow">How it works</p>
          <h2>An agentic system, not a single chatbot.</h2>
          <p>Every interaction runs through a transparent, inspectable multi-agent pipeline — never a black box.</p>
        </Reveal>
        <div className="land-pipeline">
          {PIPELINE.map((step, i) => (
            <Reveal as="div" className="land-pipeline-step" key={step.n} delay={i * 100}>
              <div className="land-pipeline-num">{step.n}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="land-privacy" id="privacy">
        <div className="land-privacy-grid">
          <Reveal>
            <p className="land-eyebrow">Privacy & responsible AI</p>
            <h2>Your health story belongs to you.</h2>
            <p>
              NARI is designed around a simple promise: turn scattered health information into clarity,
              without ever making your data feel less private, or replacing clinical judgement.
            </p>
            <div className="land-privacy-point">
              <div className="land-privacy-point-icon"><ShieldCheck size={17} /></div>
              <div>
                <strong>Explainable, not autonomous</strong>
                <p>Every recommendation cites the factors and evidence behind it. NARI never diagnoses — it supports the conversation with your clinician.</p>
              </div>
            </div>
            <div className="land-privacy-point">
              <div className="land-privacy-point-icon"><Lock size={17} /></div>
              <div>
                <strong>Deterministic safety layer</strong>
                <p>Emergency and crisis detection runs on fixed, auditable rules — never left to an LLM's judgement in the moment it matters most.</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="land-quote-card">
              <Quote size={24} />
              <p>"The goal isn't more health data. It's a better relationship with the data you already have."</p>
              <span>NARI product principle</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <div className="land-final-wrap">
        <section className="land-final-cta">
          <Reveal>
            <h2>Ready to see your health, understood?</h2>
            <p>Create a profile in seconds, or explore first as a guest — no commitment either way.</p>
            <div className="land-final-actions">
              <button className="land-primary-btn" onClick={onGetStarted}>Create your profile <ChevronRight size={16} /></button>
              <button className="land-secondary-btn" onClick={onGuest}>Continue as guest</button>
            </div>
          </Reveal>
        </section>
      </div>

      <footer className="land-footer">
        <div className="land-footer-top">
          <div>
            <div className="land-brand"><span className="land-brand-mark"><HeartPulse size={14} color="#34205F" /></span>NARI</div>
            <p>Decision support, not a diagnosis. Always consult a clinician for medical concerns.</p>
          </div>
          <div className="land-footer-links">
            <div>
              <strong>Product</strong>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#privacy">Privacy</a>
            </div>
            <div>
              <strong>Get started</strong>
              <a onClick={onGetStarted}>Create a profile</a>
              <a onClick={onGuest}>Continue as guest</a>
            </div>
          </div>
        </div>
        <div className="land-footer-bottom">
          <span>© 2026 NARI · GGSIPU2617</span>
          <span>Built with a multi-agent, evidence-grounded care pipeline</span>
        </div>
        <div className="land-footer-wordmark">NARI</div>
      </footer>
    </div>
  );
}
