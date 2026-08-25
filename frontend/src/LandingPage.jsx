import React, { useEffect, useRef, useState } from "react";
import {
  HeartPulse, ArrowRight, ShieldCheck, Lock, Activity,
  FileText, Watch, Pill, Brain, ClipboardCheck, ChevronRight, Sparkles, Smile, Globe
} from "lucide-react";
import { SUPPORTED_LANGUAGES } from "./i18n.js";

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
  { icon: Activity, label: "Symptoms & Cycle Patterns", text: "Empathetic tracking connecting daily physical sensations to your hormonal phases." },
  { icon: FileText, label: "Pathology Reports & Labs", text: "Upload reports to receive clear, calm explanations of your biomarkers without medical jargon." },
  { icon: Watch, label: "Wearables & Restful Sleep", text: "Continuous sleep, hydration, and movement synced smoothly from Google Fit." },
  { icon: Pill, label: "Medication Reminders", text: "Gentle nudges and automated interaction checks for supplements and prescriptions." },
  { icon: Brain, label: "Mental Wellbeing & Ease", text: "Mood and stress validation treated as meaningful clinical health signals." },
  { icon: ClipboardCheck, label: "Clinical Guidelines", text: "All advice grounded in certified WHO and MoHFW clinical protocols." },
];

const PIPELINE = [
  { n: "01", title: "Unify Your Health Signals", text: "Bring symptoms, labs, Google Fit wearables, and lifestyle notes into one tranquil, unified space." },
  { n: "02", title: "Multi-Agent Clinical Evaluation", text: "Specialized clinical nodes reason over your symptoms, lab flags, and metabolic indicators with medical care." },
  { n: "03", title: "Transparent, Understandable Insight", text: "Every risk signal explains its contributory factors in plain English, helping reduce health anxiety." },
  { n: "04", title: "Continuous, Supportive Care", text: "Receive clear next steps, nutrition advice, and follow-up guidance across every life stage." },
];

const STATS = [
  { to: 7, suffix: " specialized", label: "Care reasoning agents" },
  { to: 15, suffix: "+ verified", label: "WHO & MoHFW protocol sources" },
  { to: 100, suffix: "%", label: "Transparent, explainable factors" },
  { to: 24, suffix: "/7", label: "Empathetic health companion" },
];

const DEMO_RING = [26, 31, 24, 33, 27, 35];

function HeroRing({ lengths = [] }) {
  const size = 208, center = size / 2, maxR = 84, minR = 36;
  const max = Math.max(...lengths, 1);
  const fills = ["#1E405C", "#347BA8", "#4D7D9A", "#E07A6F", "#275375", "#5295BA"];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 208, display: "block", margin: "6px auto" }}>
      {lengths.map((len, i) => {
        const angle = (i / lengths.length) * 2 * Math.PI - Math.PI / 2;
        const r = minR + (len / max) * (maxR - minR);
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        const petalR = 15 + (len / max) * 9;
        const fill = fills[i % fills.length];
        return (
          <g key={i}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="#347BA8" strokeWidth="1.5" opacity="0.22" />
            <circle cx={x} cy={y} r={petalR} fill={fill} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#FFFFFF" fontFamily="'Plus Jakarta Sans',sans-serif">
              {len}
            </text>
          </g>
        );
      })}
      <circle cx={center} cy={center} r={25} fill="#1E405C" />
      <text x={center} y={center + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#E8F1F4" fontFamily="'Plus Jakarta Sans',sans-serif">
        cycles
      </text>
    </svg>
  );
}

export default function LandingPage({ onGetStarted, onSignIn, onGuest, lang, onLangChange }) {
  return (
    <div className="land-shell">
      <style>{`
        .land-shell{
          --md-primary:#022F56;
          --md-primary-dark:#02182E;
          --md-primary-container:#CCDEE4;
          --md-on-primary-container:#061D33;
          --md-surface:#F7F9FA;
          --md-surface-container:#FFFFFF;
          --md-surface-container-high:#EDF3F5;
          --md-ink-primary:#0D1D2C;
          --md-ink-secondary:#1E2D3A;
          --md-ink-muted:#4E606D;
          --md-outline:#E0E8EA;
          --md-outline-strong:#D5DFE2;
          --md-shadow-sm: 0 1px 3px rgba(0,0,0,0.03);
          --md-shadow-md: 0 4px 16px rgba(2,47,86,0.06);
          --md-shadow-lg: 0 12px 32px rgba(2,47,86,0.08);

          font-family:'Plus Jakarta Sans','DM Sans',-apple-system,sans-serif; color:var(--md-ink-secondary); background:var(--md-surface); overflow-x:hidden;
          -webkit-font-smoothing:antialiased;
        }
        .land-shell *{ box-sizing:border-box; }
        .land-shell h1,.land-shell h2,.land-shell h3,.land-shell h4{
          font-family:'Sora',sans-serif; margin:0; font-weight:700; letter-spacing:-0.01em; color:var(--md-ink-primary);
        }
        .land-shell section{ position:relative; }
        .land-shell button{ font-family:inherit; }

        /* --- M3 Navigation Bar --- */
        .land-nav{
          display:flex; align-items:center; justify-content:space-between; padding:16px 56px;
          position:sticky; top:0; z-index:30; background:rgba(247,249,250,0.92); backdrop-filter:blur(10px);
          border-bottom:1px solid var(--md-outline);
        }
        .land-brand{ display:flex; align-items:center; gap:10px; font-family:'Sora',sans-serif; font-weight:700; font-size:18.5px; color:var(--md-primary); }
        .land-brand-mark{
          width:34px; height:34px; border-radius:10px; background:var(--md-primary);
          display:flex; align-items:center; justify-content:center; color:#E8F1F4;
        }
        .land-nav-links{ display:flex; gap:32px; }
        .land-nav-links a{ color:var(--md-ink-muted); font-size:14px; font-weight:600; text-decoration:none; transition:color .2s ease; }
        .land-nav-links a:hover{ color:var(--md-primary); }
        .land-nav-actions{ display:flex; align-items:center; gap:14px; }
        .land-link-btn{ background:none; border:none; color:var(--md-primary); font-weight:700; font-size:14px; cursor:pointer; padding:8px 12px; }
        
        /* M3 Pill CTA */
        .land-cta-btn{
          display:inline-flex; align-items:center; gap:8px; background:var(--md-primary); color:#fff; border:none; border-radius:999px;
          padding:10px 20px; font-weight:700; font-size:13.5px; cursor:pointer; transition:all .2s ease;
          box-shadow:0 2px 8px rgba(2,47,86,0.18);
        }
        .land-cta-btn:hover{ background:var(--md-primary-dark); transform:translateY(-1px); box-shadow:0 4px 14px rgba(2,47,86,0.25); }

        /* --- Hero Section --- */
        .land-hero{ background:var(--md-surface); padding:72px 56px 64px; }
        .land-hero-grid{ position:relative; z-index:1; max-width:1180px; margin:0 auto; display:grid; grid-template-columns:1.05fr 0.95fr; gap:64px; align-items:center; }
        .land-pill{
          display:inline-flex; align-items:center; gap:8px; background:var(--md-primary-container); border:1px solid var(--md-outline);
          border-radius:999px; padding:6px 16px; font-size:12.5px; font-weight:700; color:var(--md-on-primary-container); margin-bottom:22px;
        }
        .land-acronym{
          font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
          color:var(--md-ink-muted); margin:0 0 14px;
        }
        .land-acronym strong{ color:var(--md-primary); font-weight:700; }
        .land-hero h1{ font-size:48px; line-height:1.15; font-weight:800; color:var(--md-ink-primary); margin:0 0 18px; }
        .land-hero h1 em{ font-style:normal; color:#235275; }
        .land-hero p.lead{ font-size:16px; line-height:1.7; color:var(--md-ink-muted); max-width:520px; margin-bottom:30px; }
        .land-hero-actions{ display:flex; gap:14px; flex-wrap:wrap; margin-bottom:22px; }
        .land-primary-btn{
          display:inline-flex; align-items:center; gap:9px; background:var(--md-primary); color:#fff; border:none; border-radius:999px;
          padding:14px 26px; font-weight:700; font-size:14.5px; cursor:pointer; transition:all .2s ease;
          box-shadow:0 4px 14px rgba(2,47,86,0.22);
        }
        .land-primary-btn:hover{ background:var(--md-primary-dark); transform:translateY(-2px); box-shadow:0 6px 20px rgba(2,47,86,0.3); }
        .land-secondary-btn{
          display:inline-flex; align-items:center; gap:9px; background:#fff; border:1.5px solid var(--md-outline-strong);
          color:var(--md-primary); border-radius:999px; padding:14px 24px; font-weight:700; font-size:14.5px; cursor:pointer; transition:all .2s ease;
        }
        .land-secondary-btn:hover{ border-color:var(--md-primary); transform:translateY(-2px); background:var(--md-surface-container-high); }
        .land-guest-note{ font-size:13.5px; color:var(--md-ink-muted); }
        .land-guest-note button{ background:none; border:none; color:var(--md-primary); font-weight:700; cursor:pointer; text-decoration:underline; padding:0; font-size:13.5px; }
        .land-trust-row{ display:flex; gap:24px; margin-top:28px; flex-wrap:wrap; }
        .land-trust-item{ display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--md-ink-muted); }
        .land-trust-item svg{ color:var(--md-primary); flex-shrink:0; }

        /* --- Hero Mockup Panel --- */
        .land-mock{
          position:relative; z-index:1; background:#fff; border-radius:24px; padding:28px;
          border:1px solid var(--md-outline); box-shadow:var(--md-shadow-lg);
        }
        .land-mock-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--md-outline); }
        .land-mock-head span{ font-size:13px; font-weight:700; color:var(--md-primary); }
        .land-mock-streams{ display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
        .land-mock-chip{
          display:flex; align-items:center; gap:6px; background:var(--md-surface-container-high); border:1px solid var(--md-outline); border-radius:999px; padding:6px 14px;
          font-size:12px; font-weight:600; color:var(--md-primary);
        }
        .land-mock-insight{ display:flex; align-items:center; gap:12px; background:#FFFBEB; border:1px solid #FDE68A; border-radius:16px; padding:14px 16px; margin-top:10px; }
        .land-mock-insight .dot{ width:8px; height:8px; border-radius:50%; background:#D97706; flex-shrink:0; }
        .land-mock-insight > div{ display:flex; flex-direction:column; gap:2px; }
        .land-mock-insight span{ font-size:13px; font-weight:700; color:#92400E; }
        .land-mock-insight small{ font-weight:500; color:#B45309; font-size:11.5px; line-height:1.45; }

        /* --- Stats Row --- */
        .land-stats{ padding:0 56px 80px; max-width:1180px; margin:0 auto; }
        .land-stats-row{ display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
        .land-stat{ background:#fff; border-radius:20px; padding:24px 20px; border:1px solid var(--md-outline); box-shadow:var(--md-shadow-sm); }
        .land-stat strong{ display:block; font-family:'Sora',sans-serif; font-size:32px; font-weight:800; color:var(--md-primary); margin-bottom:4px; }
        .land-stat span{ font-size:13px; color:var(--md-ink-muted); font-weight:500; line-height:1.4; }

        /* --- Features Section --- */
        .land-features{ background:#FFFFFF; padding:88px 56px; border-top:1px solid var(--md-outline); border-bottom:1px solid var(--md-outline); }
        .land-section-head{ max-width:640px; margin:0 auto 48px; text-align:center; }
        .land-eyebrow{ font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--md-primary); margin-bottom:8px; }
        .land-section-head h2{ font-size:32px; font-weight:800; color:var(--md-ink-primary); margin-bottom:12px; }
        .land-section-head p{ color:var(--md-ink-muted); font-size:15.5px; line-height:1.7; }
        .land-feature-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:22px; max-width:1120px; margin:0 auto; }
        .land-feature-card{
          background:var(--md-surface); border:1px solid var(--md-outline); border-radius:20px; padding:28px 24px;
          transition:all .2s ease;
        }
        .land-feature-card:hover{ transform:translateY(-4px); box-shadow:var(--md-shadow-md); background:#fff; border-color:var(--md-primary); }
        .land-feature-icon{
          width:44px; height:44px; border-radius:14px; display:flex; align-items:center; justify-content:center; margin-bottom:18px;
          background:var(--md-primary-container); color:var(--md-on-primary-container);
        }
        .land-feature-card strong{ display:block; font-family:'Sora',sans-serif; font-weight:700; font-size:15.5px; color:var(--md-ink-primary); margin-bottom:6px; }
        .land-feature-card p{ font-size:13.5px; line-height:1.65; color:var(--md-ink-muted); margin:0; }

        /* --- Pipeline Section --- */
        .land-pipeline-sec{ background:var(--md-surface); padding:88px 56px; }
        .land-pipeline{ max-width:860px; margin:0 auto; display:flex; flex-direction:column; gap:0; }
        .land-pipeline-step{ display:flex; gap:26px; padding:26px 0; border-bottom:1px solid var(--md-outline); }
        .land-pipeline-step:last-child{ border-bottom:none; }
        .land-pipeline-num{
          flex-shrink:0; width:48px; height:48px; border-radius:14px; background:#fff; border:1.5px solid var(--md-outline); color:var(--md-primary);
          display:flex; align-items:center; justify-content:center; font-family:'Sora',sans-serif; font-weight:800; font-size:15px;
        }
        .land-pipeline-step h3{ color:var(--md-ink-primary); font-size:17px; margin-bottom:6px; font-weight:700; }
        .land-pipeline-step p{ color:var(--md-ink-muted); font-size:14.5px; line-height:1.65; margin:0; }

        /* --- Final CTA --- */
        .land-final-wrap{ padding:20px 24px 44px; }
        .land-final-cta{
          background:linear-gradient(140deg, var(--md-primary-dark) 0%, var(--md-primary) 100%);
          border-radius:28px; padding:68px 48px; text-align:center; max-width:1180px; margin:0 auto;
          box-shadow:var(--md-shadow-lg);
        }
        .land-final-cta h2{ color:#fff; font-size:32px; margin-bottom:12px; font-weight:800; }
        .land-final-cta p{ color:rgba(235,244,246,0.9); font-size:15.5px; margin-bottom:30px; max-width:540px; margin-left:auto; margin-right:auto; line-height:1.6; }
        .land-final-actions{ display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
        .land-final-cta .land-primary-btn{ background:#CCDEE4; color:var(--md-on-primary-container); font-weight:800; }
        .land-final-cta .land-primary-btn:hover{ background:#fff; }
        .land-final-cta .land-secondary-btn{ background:transparent; border-color:rgba(255,255,255,0.35); color:#fff; }
        .land-final-cta .land-secondary-btn:hover{ background:rgba(255,255,255,0.1); border-color:#fff; }

        /* --- Footer --- */
        .land-footer{ background:var(--md-primary-dark); padding:52px 56px 28px; color:#E8F1F4; }
        .land-footer-top{ display:flex; justify-content:space-between; flex-wrap:wrap; gap:36px; max-width:1180px; margin:0 auto 36px; }
        .land-footer .land-brand{ color:#fff; margin-bottom:8px; }
        .land-footer-top p{ font-size:13px; color:rgba(235,244,246,0.7); max-width:320px; line-height:1.65; margin:0; }
        .land-footer-links{ display:flex; gap:48px; flex-wrap:wrap; }
        .land-footer-links div strong{ display:block; font-size:11.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#A7DFF3; margin-bottom:12px; }
        .land-footer-links a{ display:block; color:rgba(235,244,246,0.8); font-size:13.5px; text-decoration:none; margin-bottom:8px; font-weight:500; }
        .land-footer-links a:hover{ color:#fff; }
        .land-footer-bottom{ border-top:1px solid rgba(255,255,255,0.1); padding-top:20px; max-width:1180px; margin:0 auto; display:flex; justify-content:space-between; font-size:12.5px; color:rgba(235,244,246,0.55); }

        .reveal{ opacity:0; transform:translateY(20px); transition:opacity .5s ease, transform .5s ease; }
        .reveal.in{ opacity:1; transform:translateY(0); }

        @media (max-width:920px){
          .land-nav{ padding:16px 20px; }
          .land-nav-links{ display:none; }
          .land-hero{ padding:52px 20px 40px; }
          .land-hero-grid{ grid-template-columns:1fr; gap:36px; }
          .land-hero h1{ font-size:34px; }
          .land-stats{ padding:0 20px 50px; }
          .land-stats-row{ grid-template-columns:repeat(2,1fr); }
          .land-feature-grid{ grid-template-columns:1fr; }
          .land-features, .land-pipeline-sec{ padding:56px 20px; }
          .land-final-cta{ padding:48px 24px; }
        }
      `}</style>

      {/* Navigation */}
      <nav className="land-nav">
        <div className="land-brand" title="Nurturing Agentic Responsive Intelligence">
          <span className="land-brand-mark"><HeartPulse size={17} /></span>
          NARI
        </div>
        <div className="land-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#evidence">Clinical Guidelines</a>
        </div>
        <div className="land-nav-actions">
          {onLangChange && (
            <div className="lang-pill-container" style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid var(--md-outline)", borderRadius: "999px", padding: "4px 12px" }}>
              <Globe size={14} color="var(--md-primary)" />
              <select
                value={lang}
                onChange={(e) => onLangChange(e.target.value)}
                style={{ border: "none", outline: "none", background: "transparent", fontSize: "12.5px", fontWeight: 700, color: "var(--md-primary)", cursor: "pointer" }}
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native} ({l.name})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="land-link-btn" onClick={onSignIn}>Sign In</button>
          <button className="land-cta-btn" onClick={onGetStarted}>
            Get Started <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="land-hero">
        <div className="land-hero-grid">
          <div>
            <div className="land-pill">
              <ShieldCheck size={15} /> Grounded in Certified Clinical Guidelines
            </div>
            <div className="land-acronym">
              <strong>NARI</strong> — Nurturing Agentic Responsive Intelligence
            </div>
            <h1>Gentle, evidence-grounded health care <em>tailored for women</em>.</h1>
            <p className="lead">
              A peaceful, supportive space that unifies your menstrual patterns, lab reports, and Google Fit metrics into clear, comforting clinical insights.
            </p>
            <div className="land-hero-actions">
              <button className="land-primary-btn" onClick={onGetStarted}>
                Begin Your Health Profile <ArrowRight size={15} />
              </button>
              <button className="land-secondary-btn" onClick={onSignIn}>
                Sign In to Account
              </button>
            </div>
            {onGuest && (
              <div className="land-guest-note">
                Want to explore first? <button type="button" onClick={onGuest}>Continue in Guest Mode</button>
              </div>
            )}
            <div className="land-trust-row">
              <div className="land-trust-item"><ShieldCheck size={15} /> WHO &amp; MoHFW Grounded</div>
              <div className="land-trust-item"><Lock size={15} /> Private &amp; Client-Isolated</div>
            </div>
          </div>

          <div className="land-mock">
            <div className="land-mock-head">
              <span>Digital Health Twin</span>
              <div className="land-mock-chip"><Activity size={12} /> Cycle Day 18 (Luteal)</div>
            </div>
            <HeroRing lengths={DEMO_RING} />
            <div className="land-mock-streams">
              <span className="land-mock-chip"><FileText size={11} /> Ferritin: 9 ng/mL</span>
              <span className="land-mock-chip"><Watch size={11} /> 8,420 Steps</span>
            </div>
            <div className="land-mock-insight">
              <span className="dot" />
              <div>
                <span>Clinical Observation (L2)</span>
                <small>11-day cycle variance with lower ferritin observed. Recommended for gentle clinician review.</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <Reveal as="section" className="land-stats">
        <div className="land-stats-row">
          {STATS.map((s, i) => (
            <div className="land-stat" key={i}>
              <strong><Counter to={s.to} suffix={s.suffix} /></strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Features Grid */}
      <section className="land-features" id="features">
        <div className="land-section-head">
          <div className="land-eyebrow">Integrated Health Platform</div>
          <h2>Thoughtful care across every stage of your life</h2>
          <p>From cycle tracking to pathology lab report explanations, NARI brings peace of mind through clear medical reasoning.</p>
        </div>
        <div className="land-feature-grid">
          {INPUT_STREAMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <div className="land-feature-card" key={i}>
                <div className="land-feature-icon"><Icon size={20} /></div>
                <strong>{item.label}</strong>
                <p>{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Reasoning Pipeline */}
      <section className="land-pipeline-sec" id="how-it-works">
        <div className="land-section-head">
          <div className="land-eyebrow">Agentic Architecture</div>
          <h2>How NARI reasons through your health questions</h2>
          <p>Every consultation passes through dedicated safety checks, specialist clinical nodes, and verified guideline retrieval.</p>
        </div>
        <div className="land-pipeline">
          {PIPELINE.map((p, i) => (
            <div className="land-pipeline-step" key={i}>
              <div className="land-pipeline-num">{p.n}</div>
              <div>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <div className="land-final-wrap">
        <div className="land-final-cta">
          <h2>Experience supportive, evidence-grounded care</h2>
          <p>Join NARI to start tracking symptoms, understanding lab results, and getting evidence-backed care guidance designed for peace of mind.</p>
          <div className="land-final-actions">
            <button className="land-primary-btn" onClick={onGetStarted}>
              Get Started Now <ArrowRight size={15} />
            </button>
            <button className="land-secondary-btn" onClick={onGuest}>
              Explore as Guest
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="land-footer">
        <div className="land-footer-top">
          <div>
            <div className="land-brand">
              <span className="land-brand-mark"><HeartPulse size={16} /></span>
              NARI
            </div>
            <p>Nurturing Agentic Responsive Intelligence. Built for evidence-grounded women's health monitoring and continuity of care.</p>
          </div>
          <div className="land-footer-links">
            <div>
              <strong>Navigation</strong>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#evidence">Clinical Protocols</a>
            </div>
            <div>
              <strong>Account</strong>
              <a href="#" onClick={(e) => { e.preventDefault(); onSignIn(); }}>Sign In</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onGetStarted(); }}>Create Account</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onGuest(); }}>Guest Mode</a>
            </div>
          </div>
        </div>
        <div className="land-footer-bottom">
          <span>&copy; {new Date().getFullYear()} NARI Health Intelligence. All rights reserved.</span>
          <span>Aligned with WHO &amp; MoHFW Reproductive Health Guidelines</span>
        </div>
      </footer>
    </div>
  );
}