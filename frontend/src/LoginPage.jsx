import React, { useState } from "react";
import { HeartPulse, Mail, Lock, ArrowRight, Sparkles, Flower2, ArrowLeft, UserRound } from "lucide-react";
import { registerUser, loginUser, setToken } from "./api.js";
export default function LoginPage({ onSignIn, onGuest, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

    const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter both an email and a password.");
      return;
    }
    setLoading(true);
    try {
      const data = mode === "signin"
        ? await loginUser(email.trim(), password)
        : await registerUser(email.trim(), password);
      setToken(data.access_token);
      onSignIn({ email: data.user.email, id: data.user.id, fullName: data.user.full_name });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="login-shell">
      <style>{`
        .login-shell{
          min-height:100vh; display:flex; font-family:'Source Sans 3',sans-serif;
        }
        .login-shell h1, .login-shell h2, .login-shell h3, .login-brand span{
          font-family:'Plus Jakarta Sans',sans-serif;
        }
        .login-visual{
          flex:1.1; background:linear-gradient(160deg,#3B2159 0%,#7C5CD6 55%,#E7CFFF 120%);
          display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;
          position:relative; overflow:hidden; padding:40px;
        }
        .login-back-btn{
          position:absolute; top:24px; left:24px; display:flex; align-items:center; gap:6px;
          background:rgba(255,255,255,0.12); border:none; color:#fff; border-radius:100px; padding:9px 15px;
          font-size:12.5px; font-weight:600; cursor:pointer; transition:background .2s ease; z-index:2;
        }
        .login-back-btn:hover{ background:rgba(255,255,255,0.22); }
        .login-visual::before, .login-visual::after{
          content:''; position:absolute; border-radius:50%; filter:blur(50px);
        }
        .login-visual::before{ width:260px; height:260px; background:#FFD9E4; opacity:0.35; top:-60px; left:-40px; }
        .login-visual::after{ width:220px; height:220px; background:#8FD6C4; opacity:0.25; bottom:-40px; right:-30px; }
        .login-visual-inner{ position:relative; z-index:1; text-align:center; max-width:340px; }
        .login-visual-mark{
          width:64px;height:64px;border-radius:50%; margin:0 auto 22px;
          background:radial-gradient(circle at 35% 30%,#fff,#F5A6C2 60%,#7C5CD6);
          display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 8px rgba(255,255,255,0.14);
        }
        .login-visual h2{ font-size:28px; font-weight:800; margin-bottom:12px; color:#fff; }
        .login-visual p{ font-size:14px; line-height:1.7; color:rgba(255,255,255,0.85); }
        .login-visual-petals{ display:flex; gap:10px; justify-content:center; margin-top:26px; }
        .login-visual-petals span{ width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.6); }

        .login-form-side{
          flex:1; display:flex; align-items:center; justify-content:center; background:#FFF7F0; padding:32px;
        }
        .login-card{ width:100%; max-width:380px; animation: rise 0.5s ease; }
        @keyframes rise{ from{opacity:0; transform:translateY(16px);} to{opacity:1; transform:translateY(0);} }
        .login-brand{ display:flex; align-items:center; gap:10px; margin-bottom:8px; }
        .login-brand-mark{
          width:32px;height:32px;border-radius:50%; background:linear-gradient(135deg,#7C5CD6,#F5A6C2);
          display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0;
        }
        .login-brand span{ font-weight:700; font-size:22px; color:#3B2159; }
        .login-sub{ color:#6B5A8E; font-size:13.5px; margin:0 0 28px; }
        .login-tabs{ display:flex; background:#F0E9FF; border-radius:100px; padding:4px; margin-bottom:24px; }
        .login-tab{
          flex:1; text-align:center; padding:10px 0; border:none; background:none; border-radius:100px;
          font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:13px; color:#6B5A8E; cursor:pointer;
          transition: all .2s ease;
        }
        .login-tab.active{ background:#7C5CD6; color:#fff; box-shadow:0 6px 16px rgba(124,92,214,0.35); }
        .field{ margin-bottom:18px; }
        .field label{ display:block; font-size:12px; font-weight:600; color:#6B5A8E; margin-bottom:7px; }
        .field-input{
          display:flex; align-items:center; gap:10px; border:1.5px solid rgba(59,33,89,0.12);
          border-radius:14px; padding:12px 15px; background:#fff; transition: border-color .2s ease, box-shadow .2s ease;
        }
        .field-input:focus-within{ border-color:#7C5CD6; box-shadow:0 0 0 4px rgba(124,92,214,0.12); }
        .field-input svg{ color:#B7A9DA; flex-shrink:0; }
        .field-input input{ border:none; outline:none; flex:1; font-size:14px; font-family:inherit; background:transparent; }
        .login-error{ background:#FBE0E5; color:#6b1f27; font-size:12.5px; padding:10px 13px; border-radius:12px; margin-bottom:16px; }
        .login-submit{
          width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
          background:linear-gradient(120deg,#7C5CD6,#3B2159); color:#fff; border:none; border-radius:14px;
          padding:14px 0; font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:14.5px;
          cursor:pointer; transition: transform .15s ease, box-shadow .15s ease; margin-top:6px;
        }
        .login-submit:hover{ transform:translateY(-2px); box-shadow:0 14px 28px rgba(124,92,214,0.35); }
        .login-submit:disabled{ opacity:0.6; cursor:not-allowed; transform:none; }
        .login-divider{ display:flex; align-items:center; gap:12px; margin:22px 0; }
        .login-divider span{ font-size:11px; color:#B7A9DA; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; }
        .login-divider::before, .login-divider::after{ content:''; flex:1; height:1px; background:rgba(59,33,89,0.1); }
        .login-guest-btn{
          width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
          background:#fff; border:1.5px dashed #C9B8EA; color:#3B2159; border-radius:14px;
          padding:13px 0; font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:13.5px;
          cursor:pointer; transition: background .2s ease, border-color .2s ease;
        }
        .login-guest-btn:hover{ background:#F0E9FF; border-color:#7C5CD6; }
        .login-foot{ text-align:center; margin-top:20px; font-size:12px; color:#B7A9DA; display:flex; align-items:center; justify-content:center; gap:6px; }
        .spinner{ width:15px; height:15px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
        @keyframes spin{ to{ transform:rotate(360deg); } }
        @media (max-width:820px){ .login-visual{ display:none; } }
      `}</style>

      <div className="login-visual">
        {onBack && (
          <button className="login-back-btn" onClick={onBack}>
            <ArrowLeft size={14} />Back to home
          </button>
        )}
        <div className="login-visual-inner">
          <div className="login-visual-mark"><Flower2 size={28} /></div>
          <h2>You, understood.</h2>
          <p>NARI brings together symptom tracking, lab insight, and gentle guidance — grounded in real clinical evidence, built around your cycle.</p>
          <div className="login-visual-petals"><span/><span/><span/><span/><span/></div>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="login-brand">
            <span className="login-brand-mark"><HeartPulse size={16} /></span>
            <span>NARI</span>
          </div>
          <p className="login-sub">Your agentic women's health companion.</p>

          <div className="login-tabs">
            <button className={`login-tab ${mode === "signin" ? "active" : ""}`} onClick={() => setMode("signin")}>Sign in</button>
            <button className={`login-tab ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Create account</button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <div className="field-input">
                <Mail size={16} />
                <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Password</label>
              <div className="field-input">
                <Lock size={16} />
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? <span className="spinner" /> : <><span>{mode === "signin" ? "Sign in" : "Create account"}</span><ArrowRight size={15} /></>}
            </button>
          </form>

          <div className="login-divider"><span>or</span></div>

          <button className="login-guest-btn" onClick={onGuest}>
            <UserRound size={16} />Continue as guest
          </button>

          <div className="login-foot"><Sparkles size={12} />Multi-agent care, grounded in WHO/MoHFW evidence.</div>
        </div>
      </div>
    </div>
  );
}