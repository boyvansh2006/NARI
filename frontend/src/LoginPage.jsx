import React, { useState } from "react";
import { HeartPulse, Mail, Lock, ArrowRight, ArrowLeft, ShieldCheck, UserRound } from "lucide-react";
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
          min-height:100vh; display:flex; font-family:'DM Sans',-apple-system,sans-serif; background:#F6FAF8;
        }
        .login-shell *{ box-sizing:border-box; }
        .login-shell h1, .login-shell h2, .login-shell h3, .login-brand span{
          font-family:'Sora',sans-serif;
        }
        .login-visual{
          flex:1.1; background:linear-gradient(150deg,#0A3B31 0%,#0F5144 60%,#134E4A 100%);
          display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;
          position:relative; overflow:hidden; padding:48px;
        }
        .login-back-btn{
          position:absolute; top:24px; left:24px; display:flex; align-items:center; gap:6px;
          background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:100px;
          padding:8px 16px; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .2s ease; z-index:2;
        }
        .login-back-btn:hover{ background:rgba(255,255,255,0.22); }
        .login-visual::before{
          content:''; position:absolute; width:340px; height:340px; border-radius:50%;
          background:radial-gradient(circle,rgba(16,185,129,0.18) 0%,transparent 70%); top:-80px; left:-60px;
        }
        .login-visual::after{
          content:''; position:absolute; width:280px; height:280px; border-radius:50%;
          background:radial-gradient(circle,rgba(52,211,153,0.12) 0%,transparent 70%); bottom:-60px; right:-40px;
        }
        .login-visual-inner{ position:relative; z-index:1; text-align:center; max-width:360px; }
        .login-visual-mark{
          width:60px; height:60px; border-radius:18px; margin:0 auto 24px;
          background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.25);
          display:flex; align-items:center; justify-content:center; color:#6EE7B7;
        }
        .login-visual h2{ font-size:27px; font-weight:800; margin-bottom:12px; color:#fff; letter-spacing:-0.01em; }
        .login-visual p{ font-size:14px; line-height:1.7; color:rgba(230,244,241,0.85); }
        .login-badge-strip{
          display:inline-flex; align-items:center; gap:8px; margin-top:28px;
          background:rgba(255,255,255,0.08); padding:7px 14px; border-radius:100px; font-size:12px;
          color:#D1FAE5; border:1px solid rgba(255,255,255,0.15);
        }

        .login-form-side{
          flex:1; display:flex; align-items:center; justify-content:center; background:#FFFFFF; padding:40px 32px;
          border-left:1px solid #E6ECE8;
        }
        .login-card{ width:100%; max-width:380px; }
        .login-brand{ display:flex; align-items:center; gap:10px; margin-bottom:8px; }
        .login-brand-mark{
          width:34px; height:34px; border-radius:10px; background:#0F5144;
          display:flex; align-items:center; justify-content:center; color:#E6F4F1; flex-shrink:0;
        }
        .login-brand span{ font-weight:800; font-size:22px; letter-spacing:-0.01em; color:#0F2922; }
        .login-sub{ color:#527068; font-size:13.5px; margin:0 0 24px; line-height:1.5; }
        .login-tabs{ display:flex; background:#F0F7F4; border-radius:12px; padding:4px; margin-bottom:24px; border:1px solid #E6ECE8; }
        .login-tab{
          flex:1; text-align:center; padding:9px 0; border:none; background:none; border-radius:8px;
          font-family:'Sora',sans-serif; font-weight:700; font-size:13px; color:#527068; cursor:pointer;
          transition: all .2s ease;
        }
        .login-tab.active{ background:#0F5144; color:#fff; box-shadow:0 2px 8px rgba(15,81,68,0.25); }
        .field{ margin-bottom:18px; }
        .field label{ display:block; font-size:12px; font-weight:600; color:#1E3A34; margin-bottom:7px; }
        .field-input{
          display:flex; align-items:center; gap:10px; border:1.5px solid #E2E8F0;
          border-radius:12px; padding:11px 14px; background:#FAFCFB; transition: all .2s ease;
        }
        .field-input:focus-within{ border-color:#0F5144; background:#fff; box-shadow:0 0 0 3px rgba(15,81,68,0.1); }
        .field-input svg{ color:#83A69C; flex-shrink:0; }
        .field-input input{ border:none; outline:none; flex:1; font-size:14px; font-family:inherit; background:transparent; color:#0F2922; }
        .login-error{ background:#FEF2F2; color:#991B1B; font-size:12.5px; padding:10px 14px; border-radius:10px; margin-bottom:16px; border:1px solid #FEE2E2; }
        .login-submit{
          width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
          background:#0F5144; color:#fff; border:none; border-radius:12px;
          padding:13px 0; font-family:'Sora',sans-serif; font-weight:700; font-size:14px;
          cursor:pointer; transition: all .18s ease; margin-top:6px;
        }
        .login-submit:hover{ background:#0A3B31; transform:translateY(-1px); box-shadow:0 6px 16px rgba(15,81,68,0.25); }
        .login-submit:disabled{ opacity:0.6; cursor:not-allowed; transform:none; }
        .login-divider{ display:flex; align-items:center; gap:12px; margin:22px 0; }
        .login-divider span{ font-size:11px; color:#83A69C; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; }
        .login-divider::before, .login-divider::after{ content:''; flex:1; height:1px; background:#E6ECE8; }
        .login-guest-btn{
          width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
          background:#FAFCFB; border:1.5px solid #CBD5E1; color:#0F5144; border-radius:12px;
          padding:12px 0; font-family:'Sora',sans-serif; font-weight:700; font-size:13.5px;
          cursor:pointer; transition: all .18s ease;
        }
        .login-guest-btn:hover{ background:#F0F7F4; border-color:#0F5144; }
        .login-foot{ text-align:center; margin-top:24px; font-size:12px; color:#64748B; display:flex; align-items:center; justify-content:center; gap:6px; }
        .spinner{ width:15px; height:15px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
        @keyframes spin{ to{ transform:rotate(360deg); } }
        @media (max-width:820px){ .login-visual{ display:none; } }
      `}</style>

      <div className="login-visual">
        {onBack && (
          <button className="login-back-btn" onClick={onBack}>
            <ArrowLeft size={14} /> Back to overview
          </button>
        )}
        <div className="login-visual-inner">
          <div className="login-visual-mark"><HeartPulse size={28} /></div>
          <h2>Clinical rigor, tailored for women.</h2>
          <p>NARI synthesizes your symptoms, lab markers, and longitudinal metrics into clear, evidence-grounded care recommendations.</p>
          <div className="login-badge-strip">
            <ShieldCheck size={14} /> Grounded in WHO &amp; MoHFW Protocols
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="login-brand">
            <span className="login-brand-mark"><HeartPulse size={18} /></span>
            <span>NARI</span>
          </div>
          <p className="login-sub">Continuous, evidence-grounded health intelligence across your cycle.</p>

          <div className="login-tabs">
            <button className={`login-tab ${mode === "signin" ? "active" : ""}`} onClick={() => setMode("signin")}>Sign in</button>
            <button className={`login-tab ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Create account</button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email Address</label>
              <div className="field-input">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label>Password</label>
              <div className="field-input">
                <Lock size={16} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                />
              </div>
            </div>

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  {mode === "signin" ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                <>
                  {mode === "signin" ? "Sign in to NARI" : "Create your account"}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {onGuest && (
            <>
              <div className="login-divider">
                <span>Or explore first</span>
              </div>
              <button className="login-guest-btn" type="button" onClick={onGuest}>
                <UserRound size={15} />
                Continue in Guest Mode
              </button>
            </>
          )}

          <div className="login-foot">
            <ShieldCheck size={13} />
            <span>Private, encrypted session data</span>
          </div>
        </div>
      </div>
    </div>
  );
}