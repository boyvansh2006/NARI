import React, { useEffect, useRef, useState } from "react";
import {
  HeartPulse, ArrowRight, ShieldCheck, Lock, Activity,
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
  { icon: Activity, label: "Symptoms & Cycle Variance", text: "Longitudinal symptom tracking mapped directly to hormonal cycle phases." },
  { icon: FileText, label: "Pathology Reports & Scans", text: "Automated OCR extraction and biomarker trend tracking across laboratory visits." },
  { icon: Watch, label: "Wearables & Activity", text: "Continuous sleep, hydration, and activity integration via Google Fit." },
  { icon: Pill, label: "Medications & Adherence", text: "Automated interaction safety heuristics and proactive compliance tracking." },
  { icon: Brain, label: "Mental Wellbeing & Stress", text: "Mood and sleep correlation analyzed as clinical health signals." },
  { icon: ClipboardCheck, label: "Medical History & Guidelines", text: "Evidence-grounded protocols aligned with WHO and MoHFW clinical guidance." },
];

const PIPELINE = [
  { n: "01", title: "Unify Continuous Health Data", text: "Symptoms, pathology reports, Google Fit wearables, and lifestyle metrics are combined into a single unified health record." },
  { n: "02", title: "Multi-Agent Clinical Triage", text: "Specialized clinical nodes evaluate symptoms, biomarker flags, and metabolic indicators using verified medical heuristics." },
  { n: "03", title: "Transparent, Explainable Risk Signals", text: "Every risk signal explicitly cites contributory factors and guidelines rather than opaque black-box assertions." },
  { n: "04", title: "Continuous Longitudinal Care", text: "Proactive care plans and follow-up reminders designed to support women through every hormonal and reproductive stage." },
];

const STATS = [
  { to: 7, suffix: " specialized", label: "Clinical reasoning agents" },
  { to: 15, suffix: "+ verified", label: "WHO & MoHFW protocol sources" },
  { to: 100, suffix: "%", label: "Transparent, explainable risk factors" },
  { to: 24, suffix: "/7", label: "Proactive health monitoring" },
];

const DEMO_RING = [26, 31, 24, 33, 27, 35];

function HeroRing({ lengths = [] }) {
  const size = 208, center = size / 2, maxR = 84, minR = 36;
  const max = Math.max(...lengths, 1);
  const fills = ["#0F5144", "#10B981", "#059669", "#E06D63", "#047857", "#34D399"];
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
            <line x1={center} y1={center} x2={x} y2={y} stroke="#10B981" strokeWidth="1.5" opacity="0.25" />
            <circle cx={x} cy={y} r={petalR} fill={fill} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#FFFFFF" fontFamily="'DM Sans',sans-serif">
              {len}
            </text>
          </g>
        );
      })}
      <circle cx={center} cy={center} r={25} fill="#0F5144" />
      <text x={center} y={center + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#E6F4F1" fontFamily="'DM Sans',sans-serif">
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
          --forest:#0F5144;
          --forest-dark:#0A3B31;
          --emerald:#10B981;
          --emerald-dark:#059669;
          --mint-light:#E6F4F1;
          --mint-bg:#F0F7F4;
          --sand-bg:#F6FAF8;
          --card-bg:#FFFFFF;
          --ink-primary:#0F2922;
          --ink-secondary:#2D4A43;
          --ink-muted:#527068;
          --line:#E2EBE7;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.04);
          --shadow-md: 0 6px 20px rgba(15,81,68,0.06);
          --shadow-lg: 0 16px 40px rgba(15,81,68,0.08);

          font-family:'DM Sans',-apple-system,sans-serif; color:var(--ink-secondary); background:var(--sand-bg); overflow-x:hidden;
          -webkit-font-smoothing:antialiased;
        }
        .land-shell *{ box-sizing:border-box; }
        .land-shell h1,.land-shell h2,.land-shell h3,.land-shell h4{
          font-family:'Sora',sans-serif; margin:0; font-weight:700; letter-spacing:-0.01em; color:var(--ink-primary);
        }
        .land-shell section{ position:relative; }
        .land-shell button{ font-family:'DM Sans',sans-serif; }

        /* --- Nav --- */
        .land-nav{
          display:flex; align-items:center; justify-content:space-between; padding:18px 56px;
          position:sticky; top:0; z-index:30; background:rgba(246,250,248,0.92); backdrop-filter:blur(10px);
          border-bottom:1px solid var(--line);
        }
        .land-brand{ display:flex; align-items:center; gap:9px; font-family:'Sora',sans-serif; font-weight:700; font-size:18px; color:var(--forest); }
        .land-brand-mark{
          width:32px; height:32px; border-radius:9px; background:var(--forest);
          display:flex; align-items:center; justify-content:center; color:#E6F4F1;
        }
        .land-nav-links{ display:flex; gap:34px; }
        .land-nav-links a{ color:var(--ink-muted); font-size:14px; font-weight:600; text-decoration:none; transition:color .2s ease; }
        .land-nav-links a:hover{ color:var(--forest); }
        .land-nav-actions{ display:flex; align-items:center; gap:16px; }
        .land-link-btn{ background:none; border:none; color:var(--forest); font-weight:700; font-size:14px; cursor:pointer; }
        .land-cta-btn{
          display:inline-flex; align-items:center; gap:8px; background:var(--forest); color:#fff; border:none; border-radius:10px;
          padding:10px 18px; font-weight:700; font-size:13.5px; cursor:pointer; transition:all .18s ease;
        }
        .land-cta-btn:hover{ background:var(--forest-dark); transform:translateY(-1px); box-shadow:0 4px 12px rgba(15,81,68,0.2); }

        /* --- Hero --- */
        .land-hero{ background:var(--sand-bg); padding:76px 56px 64px; }
        .land-hero-grid{ position:relative; z-index:1; max-width:1180px; margin:0 auto; display:grid; grid-template-columns:1.05fr 0.95fr; gap:64px; align-items:center; }
        .land-pill{
          display:inline-flex; align-items:center; gap:8px; background:var(--mint-bg); border:1px solid var(--line);
          border-radius:100px; padding:6px 14px; font-size:12.5px; font-weight:700; color:var(--forest); margin-bottom:20px;
        }
        .land-acronym{
          font-size:11.5px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
          color:var(--ink-muted); margin:0 0 14px;
        }
        .land-acronym strong{ color:var(--forest); font-weight:700; }
        .land-hero h1{ font-size:48px; line-height:1.12; font-weight:800; color:var(--ink-primary); margin:0 0 18px; }
        .land-hero h1 em{ font-style:normal; color:var(--emerald-dark); }
        .land-hero p.lead{ font-size:16px; line-height:1.7; color:var(--ink-muted); max-width:520px; margin-bottom:28px; }
        .land-hero-actions{ display:flex; gap:14px; flex-wrap:wrap; margin-bottom:20px; }
        .land-primary-btn{
          display:inline-flex; align-items:center; gap:9px; background:var(--forest); color:#fff; border:none; border-radius:12px;
          padding:14px 24px; font-weight:700; font-size:14px; cursor:pointer; transition:all .18s ease;
        }
        .land-primary-btn:hover{ background:var(--forest-dark); transform:translateY(-2px); box-shadow:0 8px 20px rgba(15,81,68,0.25); }
        .land-secondary-btn{
          display:inline-flex; align-items:center; gap:9px; background:#fff; border:1.5px solid var(--line);
          color:var(--forest); border-radius:12px; padding:14px 24px; font-weight:700; font-size:14px; cursor:pointer; transition:all .18s ease;
        }
        .land-secondary-btn:hover{ border-color:var(--forest); transform:translateY(-2px); background:var(--mint-bg); }
        .land-guest-note{ font-size:13px; color:var(--ink-muted); }
        .land-guest-note button{ background:none; border:none; color:var(--forest); font-weight:700; cursor:pointer; text-decoration:underline; padding:0; font-size:13px; }
        .land-trust-row{ display:flex; gap:24px; margin-top:26px; flex-wrap:wrap; }
        .land-trust-item{ display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:600; color:var(--ink-muted); }
        .land-trust-item svg{ color:var(--emerald-dark); flex-shrink:0; }

        /* --- Hero mockup panel --- */
        .land-mock{
          position:relative; z-index:1; background:#fff; border-radius:20px; padding:26px;
          border:1px solid var(--line); box-shadow:var(--shadow-lg);
        }
        .land-mock-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid var(--line); }
        .land-mock-head span{ font-size:12.5px; font-weight:700; color:var(--forest); }
        .land-mock-streams{ display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:6px; }
        .land-mock-chip{
          display:flex; align-items:center; gap:6px; background:var(--mint-bg); border:1px solid var(--line); border-radius:100px; padding:5px 12px;
          font-size:11.5px; font-weight:600; color:var(--forest);
        }
        .land-mock-insight{ display:flex; align-items:center; gap:10px; background:#FEF3C7; border:1px solid #FDE68A; border-radius:12px; padding:12px 14px; margin-top:8px; }
        .land-mock-insight .dot{ width:8px; height:8px; border-radius:50%; background:#D97706; flex-shrink:0; }
        .land-mock-insight > div{ display:flex; flex-direction:column; gap:2px; }
        .land-mock-insight span{ font-size:12.5px; font-weight:700; color:#92400E; }
        .land-mock-insight small{ font-weight:500; color:#B45309; font-size:11px; line-height:1.4; }

        /* --- Stats --- */
        .land-stats{ padding:0 56px 80px; max-width:1180px; margin:0 auto; }
        .land-stats-row{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .land-stat{ background:#fff; border-radius:16px; padding:24px 20px; border:1px solid var(--line); box-shadow:var(--shadow-sm); }
        .land-stat strong{ display:block; font-family:'Sora',sans-serif; font-size:30px; font-weight:800; color:var(--forest); margin-bottom:4px; }
        .land-stat span{ font-size:12.5px; color:var(--ink-muted); font-weight:500; line-height:1.4; }

        /* --- Features --- */
        .land-features{ background:#FFFFFF; padding:80px 56px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
        .land-section-head{ max-width:640px; margin:0 auto 48px; text-align:center; }
        .land-eyebrow{ font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--emerald-dark); margin-bottom:8px; }
        .land-section-head h2{ font-size:32px; font-weight:800; color:var(--ink-primary); margin-bottom:12px; }
        .land-section-head p{ color:var(--ink-muted); font-size:15px; line-height:1.7; }
        .land-feature-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:20px; max-width:1120px; margin:0 auto; }
        .land-feature-card{
          background:var(--sand-bg); border:1px solid var(--line); border-radius:16px; padding:26px 24px;
          transition:all .2s ease;
        }
        .land-feature-card:hover{ transform:translateY(-4px); box-shadow:var(--shadow-md); background:#fff; border-color:var(--emerald); }
        .land-feature-icon{
          width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:16px;
          background:var(--mint-light); color:var(--forest);
        }
        .land-feature-card strong{ display:block; font-family:'Sora',sans-serif; font-weight:700; font-size:15px; color:var(--ink-primary); margin-bottom:6px; }
        .land-feature-card p{ font-size:13.5px; line-height:1.6; color:var(--ink-muted); margin:0; }

        /* --- Pipeline --- */
        .land-pipeline-sec{ background:var(--sand-bg); padding:80px 56px; }
        .land-pipeline{ max-width:860px; margin:0 auto; display:flex; flex-direction:column; gap:0; }
        .land-pipeline-step{ display:flex; gap:24px; padding:24px 0; border-bottom:1px solid var(--line); }
        .land-pipeline-step:last-child{ border-bottom:none; }
        .land-pipeline-num{
          flex-shrink:0; width:46px; height:46px; border-radius:12px; background:#fff; border:1.5px solid var(--line); color:var(--forest);
          display:flex; align-items:center; justify-content:center; font-family:'Sora',sans-serif; font-weight:800; font-size:15px;
        }
        .land-pipeline-step h3{ color:var(--ink-primary); font-size:16.5px; margin-bottom:5px; font-weight:700; }
        .land-pipeline-step p{ color:var(--ink-muted); font-size:14px; line-height:1.65; margin:0; }

        /* --- Final CTA --- */
        .land-final-wrap{ padding:20px 24px 40px; }
        .land-final-cta{
          background:linear-gradient(140deg, var(--forest-dark) 0%, var(--forest) 100%);
          border-radius:24px; padding:64px 48px; text-align:center; max-width:1180px; margin:0 auto;
          box-shadow:var(--shadow-lg);
        }
        .land-final-cta h2{ color:#fff; font-size:32px; margin-bottom:12px; font-weight:800; }
        .land-final-cta p{ color:rgba(230,244,241,0.85); font-size:15px; margin-bottom:28px; max-width:540px; margin-left:auto; margin-right:auto; }
        .land-final-actions{ display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
        .land-final-cta .land-primary-btn{ background:var(--emerald); color:#fff; }
        .land-final-cta .land-primary-btn:hover{ background:#059669; }
        .land-final-cta .land-secondary-btn{ background:transparent; border-color:rgba(255,255,255,0.3); color:#fff; }
        .land-final-cta .land-secondary-btn:hover{ background:rgba(255,255,255,0.1); border-color:#fff; }

        /* --- Footer --- */
        .land-footer{ background:var(--forest-dark); padding:48px 56px 24px; color:#E6F4F1; }
        .land-footer-top{ display:flex; justify-content:space-between; flex-wrap:wrap; gap:32px; max-width:1180px; margin:0 auto 36px; }
        .land-footer .land-brand{ color:#fff; margin-bottom:8px; }
        .land-footer-top p{ font-size:12.5px; color:rgba(230,244,241,0.65); max-width:320px; line-height:1.6; margin:0; }
        .land-footer-links{ display:flex; gap:48px; flex-wrap:wrap; }
        .land-footer-links div strong{ display:block; font-size:11.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#A7F3D0; margin-bottom:12px; }
        .land-footer-links a{ display:block; color:rgba(230,244,241,0.75); font-size:13.5px; text-decoration:none; margin-bottom:8px; font-weight:500; }
        .land-footer-links a:hover{ color:#fff; }
        .land-footer-bottom{ border-top:1px solid rgba(255,255,255,0.1); padding-top:20px; max-width:1180px; margin:0 auto; display:flex; justify-content:space-between; font-size:12px; color:rgba(230,244,241,0.5); }

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
          <span className="land-brand-mark"><HeartPulse size={16} /></span>
          NARI
        </div>
        <div className="land-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#evidence">Evidence &amp; Clinical Safety</a>
        </div>
        <div className="land-nav-actions">
          <button className="land-link-btn" onClick={onSignIn}>Sign in</button>
          <button className="land-cta-btn" onClick={onGetStarted}>
            Get started <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="land-hero">
        <div className="land-hero-grid">
          <div>
            <div className="land-pill">
              <ShieldCheck size={14} /> Grounded in Clinical Guidelines
            </div>
            <div className="land-acronym">
              <strong>NARI</strong> — Nurturing Agentic Responsive Intelligence
            </div>
            <h1>Continuous, intelligent health care <em>tailored for women</em>.</h1>
            <p className="lead">
              NARI unifies your menstrual cycle signals, pathology reports, Google Fit wearables, and lifestyle data into an explainable, evidence-backed care companion.
            </p>
            <div className="land-hero-actions">
              <button className="land-primary-btn" onClick={onGetStarted}>
                Start your health profile <ArrowRight size={15} />
              </button>
              <button className="land-secondary-btn" onClick={onSignIn}>
                Sign in to account
              </button>
            </div>
            {onGuest && (
              <div className="land-guest-note">
                Want to test first? <button type="button" onClick={onGuest}>Explore in Guest Mode</button>
              </div>
            )}
            <div className="land-trust-row">
              <div className="land-trust-item"><ShieldCheck size={15} /> WHO &amp; MoHFW Grounding</div>
              <div className="land-trust-item"><Lock size={15} /> Private &amp; Client-Isolated</div>
            </div>
          </div>

          <div className="land-mock">
            <div className="land-mock-head">
              <span>Digital Health Twin Preview</span>
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
                <span>Clinical Pattern Flag (L2)</span>
                <small>11-day cycle variance with low ferritin detected. Recommended for clinician review.</small>
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
          <h2>Designed for the full spectrum of women's health</h2>
          <p>From daily cycle tracking to complex lab report parsing, NARI bridges the gap between patient symptoms and clinical insight.</p>
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
          <h2>How NARI reasons through health signals</h2>
          <p>A multi-agent care pipeline processes each turn with transparency, safety escalation, and clinical grounding.</p>
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
          <h2>Experience intelligent women's health care</h2>
          <p>Join NARI to start tracking your symptoms, interpreting pathology reports, and accessing evidence-backed care guidance.</p>
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
              <a href="#how-it-works">How it works</a>
              <a href="#evidence">Clinical Guidelines</a>
            </div>
            <div>
              <strong>Account</strong>
              <a href="#" onClick={(e) => { e.preventDefault(); onSignIn(); }}>Sign in</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onGetStarted(); }}>Create account</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onGuest(); }}>Guest mode</a>
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
