import React, { useEffect, useRef, useState } from "react";
import {
  HeartPulse, ArrowRight, ShieldCheck, Lock, Sparkles, Activity,
  FileText, Watch, Pill, Brain, Network, ClipboardCheck, Stethoscope,
  Users, ChevronRight, Quote
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
  { icon: Activity, label: "Symptoms & cycle tracking" },
  { icon: FileText, label: "Lab reports & prescriptions" },
  { icon: Watch, label: "Wearable device data" },
  { icon: Pill, label: "Medications & adherence" },
  { icon: Brain, label: "Stress, sleep & mental wellbeing" },
  { icon: ClipboardCheck, label: "Clinical history & imaging" },
];

const PIPELINE = [
  { n: "01", title: "Unify every signal", text: "Symptoms, labs, wearables, prescriptions and lifestyle habits are brought into one continuous health profile — not siloed apps." },
  { n: "02", title: "Reason like a care team", text: "A multi-agent system routes each concern to the right specialist logic — symptom triage, labs, nutrition, mental wellbeing, risk, and follow-up." },
  { n: "03", title: "Explain, don't just flag", text: "Every risk signal cites the factors behind it and the evidence it's grounded in, so you and your clinician both understand the 'why'." },
  { n: "04", title: "Support the whole journey", text: "From menstrual health through PCOS, fertility, pregnancy, postpartum and menopause — one profile that grows with you." },
];

export default function LandingPage({ onGetStarted, onSignIn, onGuest }) {
  return (
    <div className="land-shell">
      <style>{`
        .land-shell{ font-family:'Source Sans 3',sans-serif; color:#EDE9F7; background:#160E28; overflow-x:hidden; }
        .land-shell h1,.land-shell h2,.land-shell h3{ font-family:'Plus Jakarta Sans',sans-serif; }
        .land-shell *{ box-sizing:border-box; }
        .land-shell section{ position:relative; }

        /* --- Nav --- */
        .land-nav{
          display:flex; align-items:center; justify-content:space-between; padding:22px 48px;
          position:sticky; top:0; z-index:20; background:rgba(22,14,40,0.72); backdrop-filter:blur(10px);
          border-bottom:1px solid rgba(255,255,255,0.06);
        }
        .land-brand{ display:flex; align-items:center; gap:10px; font-weight:800; font-size:19px; color:#fff; }
        .land-brand-mark{
          width:32px;height:32px;border-radius:50%; background:radial-gradient(circle at 35% 30%,#fff,#F5A6C2 55%,#7C5CD6);
          display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 5px rgba(255,255,255,0.08);
        }
        .land-nav-links{ display:flex; gap:34px; }
        .land-nav-links a{ color:rgba(237,233,247,0.72); font-size:14px; font-weight:600; text-decoration:none; transition:color .2s ease; }
        .land-nav-links a:hover{ color:#fff; }
        .land-nav-actions{ display:flex; align-items:center; gap:16px; }
        .land-link-btn{ background:none; border:none; color:rgba(237,233,247,0.85); font-weight:600; font-size:14px; cursor:pointer; }
        .land-cta-btn{
          display:inline-flex; align-items:center; gap:8px; background:#fff; color:#3B2159; border:none; border-radius:100px;
          padding:11px 20px; font-weight:700; font-size:13.5px; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease;
        }
        .land-cta-btn:hover{ transform:translateY(-2px); box-shadow:0 12px 26px rgba(0,0,0,0.28); }

        /* --- Hero --- */
        .land-hero{
          min-height:88vh; display:flex; align-items:center; padding:70px 48px;
          background:radial-gradient(circle at 82% 30%,rgba(124,92,214,0.35),transparent 55%),
                     radial-gradient(circle at 15% 80%,rgba(245,166,194,0.18),transparent 50%),
                     linear-gradient(160deg,#160E28 0%,#241540 60%,#3B2159 130%);
          overflow:hidden;
        }
        .land-blob{ position:absolute; border-radius:50%; filter:blur(70px); opacity:0.4; animation:drift 14s ease-in-out infinite; }
        .land-blob.a{ width:360px;height:360px; background:#7C5CD6; top:-100px; right:80px; }
        .land-blob.b{ width:280px;height:280px; background:#8FD6C4; bottom:-60px; right:340px; animation-delay:3s; }
        .land-blob.c{ width:220px;height:220px; background:#F5A6C2; top:220px; right:520px; animation-delay:6s; }
        @keyframes drift{ 0%,100%{ transform:translate(0,0); } 50%{ transform:translate(-18px,22px); } }

        .land-hero-inner{ position:relative; z-index:1; max-width:640px; }
        .land-pill{
          display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14);
          border-radius:100px; padding:8px 16px; font-size:12.5px; font-weight:700; color:#E7CFFF; margin-bottom:26px;
        }
        .land-hero h1{ font-size:56px; line-height:1.08; font-weight:800; color:#fff; margin:0 0 22px; }
        .land-hero h1 span{ background:linear-gradient(120deg,#F5A6C2,#E7CFFF); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .land-hero p{ font-size:16px; line-height:1.7; color:rgba(237,233,247,0.78); max-width:520px; margin-bottom:34px; }
        .land-hero-actions{ display:flex; gap:14px; flex-wrap:wrap; margin-bottom:40px; }
        .land-primary-btn{
          display:inline-flex; align-items:center; gap:9px; background:#fff; color:#3B2159; border:none; border-radius:100px;
          padding:15px 26px; font-weight:700; font-size:14.5px; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease;
        }
        .land-primary-btn:hover{ transform:translateY(-3px); box-shadow:0 16px 34px rgba(0,0,0,0.32); }
        .land-secondary-btn{
          display:inline-flex; align-items:center; gap:9px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2);
          color:#fff; border-radius:100px; padding:15px 26px; font-weight:700; font-size:14.5px; cursor:pointer; transition:background .2s ease;
        }
        .land-secondary-btn:hover{ background:rgba(255,255,255,0.16); }
        .land-guest-note{ font-size:12.5px; color:rgba(237,233,247,0.55); }
        .land-guest-note button{ background:none; border:none; color:#E7CFFF; font-weight:700; cursor:pointer; text-decoration:underline; padding:0; font-size:12.5px; }
        .land-trust-row{ display:flex; gap:26px; margin-top:34px; flex-wrap:wrap; }
        .land-trust-item{ display:flex; align-items:center; gap:8px; font-size:12.5px; color:rgba(237,233,247,0.65); }

        /* --- Stats --- */
        .land-stats{ background:#1C1233; padding:56px 48px; display:flex; justify-content:center; gap:70px; flex-wrap:wrap; }
        .land-stat{ text-align:center; }
        .land-stat strong{ display:block; font-family:'Plus Jakarta Sans',sans-serif; font-size:34px; font-weight:800; color:#fff; }
        .land-stat span{ font-size:12.5px; color:rgba(237,233,247,0.6); }

        /* --- Reveal utility --- */
        .reveal{ opacity:0; transform:translateY(26px); transition:opacity .7s ease, transform .7s ease; }
        .reveal.in{ opacity:1; transform:translateY(0); }

        /* --- Features (light section) --- */
        .land-light{ background:#FFF7F0; color:#2E1B45; padding:90px 48px; }
        .land-section-head{ max-width:640px; margin:0 auto 48px; text-align:center; }
        .land-eyebrow{ font-size:12px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#7C5CD6; margin-bottom:10px; }
        .land-section-head h2{ font-size:34px; font-weight:800; color:#3B2159; margin-bottom:12px; }
        .land-section-head p{ color:#6B5A8E; font-size:15px; line-height:1.7; }
        .land-feature-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:20px; max-width:1080px; margin:0 auto; }
        .land-feature-card{
          background:#fff; border-radius:20px; padding:26px 24px; box-shadow:0 14px 34px rgba(59,33,89,0.08);
          transition:transform .2s ease, box-shadow .2s ease;
        }
        .land-feature-card:hover{ transform:translateY(-6px); box-shadow:0 20px 44px rgba(59,33,89,0.16); }
        .land-feature-icon{
          width:44px;height:44px;border-radius:13px; background:linear-gradient(135deg,#E7CFFF,#FFD9E4);
          display:flex; align-items:center; justify-content:center; color:#7C5CD6; margin-bottom:16px;
        }
        .land-feature-card strong{ display:block; font-family:'Plus Jakarta Sans',sans-serif; font-size:14.5px; color:#3B2159; margin-bottom:2px; }

        /* --- Pipeline (dark section) --- */
        .land-dark{ background:#160E28; padding:90px 48px; }
        .land-dark .land-eyebrow{ color:#F5A6C2; }
        .land-dark .land-section-head h2{ color:#fff; }
        .land-dark .land-section-head p{ color:rgba(237,233,247,0.68); }
        .land-pipeline{ max-width:900px; margin:0 auto; display:flex; flex-direction:column; gap:0; }
        .land-pipeline-step{ display:flex; gap:24px; padding:26px 0; border-bottom:1px solid rgba(255,255,255,0.08); }
        .land-pipeline-step:last-child{ border-bottom:none; }
        .land-pipeline-num{ font-family:'Plus Jakarta Sans',sans-serif; font-size:28px; font-weight:800; color:rgba(255,255,255,0.18); flex-shrink:0; width:56px; }
        .land-pipeline-step h3{ color:#fff; font-size:17px; margin-bottom:6px; }
        .land-pipeline-step p{ color:rgba(237,233,247,0.65); font-size:14px; line-height:1.65; margin:0; }

        /* --- Privacy split section --- */
        .land-privacy{ background:#FFF7F0; padding:90px 48px; }
        .land-privacy-grid{ max-width:1080px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:56px; align-items:center; }
        .land-privacy-grid h2{ font-size:32px; color:#3B2159; margin-bottom:16px; }
        .land-privacy-grid > div:first-child p{ color:#6B5A8E; font-size:15px; line-height:1.7; margin-bottom:26px; }
        .land-privacy-point{ display:flex; gap:14px; margin-bottom:20px; }
        .land-privacy-point-icon{
          width:38px;height:38px;border-radius:12px; background:#DFF3ED; color:#215a52;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .land-privacy-point strong{ display:block; font-family:'Plus Jakarta Sans',sans-serif; font-size:14.5px; color:#3B2159; margin-bottom:3px; }
        .land-privacy-point p{ font-size:13.5px; color:#6B5A8E; margin:0; line-height:1.6; }
        .land-quote-card{
          background:#fff; border-radius:24px; padding:34px 32px; box-shadow:0 20px 50px rgba(59,33,89,0.12);
          position:relative;
        }
        .land-quote-card svg{ color:#E7CFFF; margin-bottom:14px; }
        .land-quote-card p{ font-size:19px; line-height:1.6; color:#3B2159; font-weight:600; margin-bottom:14px; }
        .land-quote-card span{ font-size:12.5px; color:#9384b8; font-weight:600; }

        /* --- Final CTA --- */
        .land-final-cta{
          background:linear-gradient(135deg,#3B2159,#7C5CD6); padding:80px 48px; text-align:center;
        }
        .land-final-cta h2{ color:#fff; font-size:30px; margin-bottom:14px; }
        .land-final-cta p{ color:rgba(237,233,247,0.8); font-size:15px; margin-bottom:30px; }
        .land-final-actions{ display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }

        .land-footer{ background:#160E28; padding:26px 48px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
        .land-footer span{ font-size:12px; color:rgba(237,233,247,0.5); }

        @media (max-width:920px){
          .land-nav-links{ display:none; }
          .land-hero{ padding:56px 24px; }
          .land-hero h1{ font-size:38px; }
          .land-feature-grid{ grid-template-columns:1fr; }
          .land-privacy-grid{ grid-template-columns:1fr; }
          .land-stats{ gap:36px; padding:44px 24px; }
          .land-light, .land-dark, .land-privacy, .land-final-cta{ padding:64px 22px; }
        }
      `}</style>

      {/* Nav */}
      <nav className="land-nav">
        <div className="land-brand">
          <span className="land-brand-mark"><HeartPulse size={16} color="#fff" /></span>
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
        <span className="land-blob a" />
        <span className="land-blob b" />
        <span className="land-blob c" />
        <div className="land-hero-inner">
          <div className="land-pill"><Sparkles size={13} />Agentic multimodal women's health intelligence</div>
          <h1>Every stage of your health, <span>finally understood together.</span></h1>
          <p>
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
      </section>

      {/* Stats */}
      <section className="land-stats">
        <div className="land-stat"><strong><Counter to={12} /></strong><span>Specialist care agents</span></div>
        <div className="land-stat"><strong><Counter to={15} /></strong><span>WHO / MoHFW evidence sources</span></div>
        <div className="land-stat"><strong><Counter to={7} /></strong><span>Stage reasoning pipeline</span></div>
        <div className="land-stat"><strong><Counter to={100} suffix="%" /></strong><span>Explainable risk signals</span></div>
      </section>

      {/* Features */}
      <section className="land-light" id="features">
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
                <div className="land-feature-icon"><f.icon size={20} /></div>
                <strong>{f.label}</strong>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="land-dark" id="how-it-works">
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
              <Quote size={26} />
              <p>"The goal isn't more health data. It's a better relationship with the data you already have."</p>
              <span>NARI product principle</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
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

      <footer className="land-footer">
        <div className="land-brand"><span className="land-brand-mark"><HeartPulse size={14} color="#fff" /></span>NARI</div>
        <span>Decision support, not a diagnosis. Always consult a clinician for medical concerns.</span>
      </footer>
    </div>
  );
}