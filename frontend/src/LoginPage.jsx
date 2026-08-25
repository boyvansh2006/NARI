import React, { useState } from "react";
import { HeartPulse, Mail, Lock, ArrowRight, ArrowLeft, ShieldCheck, UserRound, Globe } from "lucide-react";
import { registerUser, loginUser, setToken } from "./api.js";
import { SUPPORTED_LANGUAGES } from "./i18n.js";

export default function LoginPage({ onSignIn, onGuest, onBack, lang, onLangChange }) {
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
          min-height:100vh; display:flex; font-family:'Plus Jakarta Sans','DM Sans',-apple-system,sans-serif; background:#F7F9FA;
        }
        .login-shell *{ box-sizing:border-box; }
        .login-visual{
          flex:1.1; background:linear-gradient(160deg,#02182E 0%,#022F56 60%,#234D6D 100%);
          display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;
          position:relative; overflow:hidden; padding:48px;
        }
        .login-back-btn{
          position:absolute; top:24px; left:24px; display:flex; align-items:center; gap:8px;
          background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.22); color:#fff; border-radius:999px;
          padding:9px 18px; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s ease; z-index:2;
        }
        .login-back-btn:hover{ background:rgba(255,255,255,0.24); transform:translateX(-2px); }
        .login-visual-inner{ position:relative; z-index:1; text-align:center; max-width:380px; }
        .login-visual-mark{
          width:64px; height:64px; border-radius:22px; margin:0 auto 24px;
          background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25);
          display:flex; align-items:center; justify-content:center; color:#CCDEE4;
        }
        .login-visual h2{ font-size:28px; font-weight:800; margin-bottom:14px; color:#fff; letter-spacing:-0.01em; line-height:1.2; }
        .login-visual p{ font-size:14.5px; line-height:1.7; color:rgba(235,244,246,0.9); margin:0; }
        .login-badge-strip{
          display:inline-flex; align-items:center; gap:8px; margin-top:28px;
          background:rgba(255,255,255,0.1); padding:8px 16px; border-radius:999px; font-size:12.5px;
          color:#CCDEE4; border:1px solid rgba(255,255,255,0.2); font-weight:500;
        }

        .login-form-side{
          flex:1; display:flex; align-items:center; justify-content:center; background:#FFFFFF; padding:48px 36px;
          border-left:1px solid #E2E9EB;
        }
        .login-card{ width:100%; max-width:400px; }
        .login-brand{ display:flex; align-items:center; gap:10px; margin-bottom:8px; }
        .login-brand-mark{
          width:36px; height:36px; border-radius:12px; background:#022F56;
          display:flex; align-items:center; justify-content:center; color:#CCDEE4; flex-shrink:0;
        }
        .login-brand span{ font-weight:800; font-size:24px; letter-spacing:-0.01em; color:#0D1D2C; }
        .login-sub{ color:#4E606D; font-size:14px; margin:0 0 26px; line-height:1.55; }
        
        /* M3 Segmented Switcher */
        .login-tabs{ display:flex; background:#EDF3F5; border-radius:999px; padding:4px; margin-bottom:26px; border:1px solid #E0E8EA; }
        .login-tab{
          flex:1; text-align:center; padding:10px 0; border:none; background:none; border-radius:999px;
          font-weight:700; font-size:13px; color:#4E606D; cursor:pointer; transition: all .2s ease;
        }
        .login-tab.active{ background:#022F56; color:#fff; box-shadow:0 2px 10px rgba(2,47,86,0.28); }

        .field{ margin-bottom:20px; }
        .field label{ display:block; font-size:12.5px; font-weight:600; color:#162736; margin-bottom:8px; }
        .field-input{
          display:flex; align-items:center; gap:12px; border:1.5px solid #D5DFE2;
          border-radius:14px; padding:12px 16px; background:#FBFDFD; transition: all .2s ease;
        }
        .field-input:focus-within{ border-color:#022F56; background:#fff; box-shadow:0 0 0 3px rgba(2,47,86,0.12); }
        .field-input svg{ color:#748C99; flex-shrink:0; }
        .field-input input{ border:none; outline:none; flex:1; font-size:14px; font-family:inherit; background:transparent; color:#0D1D2C; }
        
        .login-error{ background:#FDF2F2; color:#A02C2C; font-size:13px; padding:12px 16px; border-radius:12px; margin-bottom:18px; border:1px solid #F9D5D5; line-height:1.5; }
        
        /* M3 Filled Button */
        .login-submit{
          width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
          background:#022F56; color:#fff; border:none; border-radius:999px;
          padding:14px 0; font-weight:700; font-size:14.5px;
          cursor:pointer; transition: all .2s ease; margin-top:8px; box-shadow:0 4px 14px rgba(2,47,86,0.2);
        }
        .login-submit:hover{ background:#02182E; transform:translateY(-1px); box-shadow:0 6px 18px rgba(2,47,86,0.28); }
        .login-submit:disabled{ opacity:0.6; cursor:not-allowed; transform:none; }
        
        .login-divider{ display:flex; align-items:center; gap:14px; margin:24px 0; }
        .login-divider span{ font-size:11.5px; color:#748C99; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; }
        .login-divider::before, .login-divider::after{ content:''; flex:1; height:1px; background:#E2E9EB; }
        
        /* M3 Tonal Outlined Button */
        .login-guest-btn{
          width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
          background:#F4F7F8; border:1.5px solid #D5DFE2; color:#022F56; border-radius:999px;
          padding:13px 0; font-weight:700; font-size:14px;
          cursor:pointer; transition: all .2s ease;
        }
        .login-guest-btn:hover{ background:#EDF3F5; border-color:#022F56; }
        
        .login-foot{ text-align:center; margin-top:28px; font-size:12.5px; color:#6B7F8B; display:flex; align-items:center; justify-content:center; gap:7px; }
        .spinner{ width:16px; height:16px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
        @keyframes spin{ to{ transform:rotate(360deg); } }
        @media (max-width:820px){ .login-visual{ display:none; } }
      `}</style>

      <div className="login-visual">
        {onBack && (
          <button className="login-back-btn" onClick={onBack}>
            <ArrowLeft size={15} /> Back to overview
          </button>
        )}
        <div className="login-visual-inner">
          <div className="login-visual-mark"><HeartPulse size={30} /></div>
          <h2>Thoughtful care, grounded in evidence.</h2>
          <p>NARI synthesizes your symptoms, lab reports, and wearable metrics into clear, supportive care plans designed for your peace of mind.</p>
          <div className="login-badge-strip">
            <ShieldCheck size={15} /> Grounded in WHO &amp; MoHFW Protocols
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="login-brand" style={{ justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", align_items: "center", gap: "10px" }}>
              <span className="login-brand-mark"><HeartPulse size={18} /></span>
              <span>NARI</span>
            </div>
            {onLangChange && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#EDF3F5", border: "1px solid #D5DFE2", borderRadius: "999px", padding: "4px 12px" }}>
                <Globe size={13} color="#022F56" />
                <select
                  value={lang}
                  onChange={(e) => onLangChange(e.target.value)}
                  style={{ border: "none", outline: "none", background: "transparent", fontSize: "12px", fontWeight: 700, color: "#022F56", cursor: "pointer" }}
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="login-sub">Welcome. Take a peaceful moment to access your personalized health twin.</p>

          <div className="login-tabs">
            <button className={`login-tab ${mode === "signin" ? "active" : ""}`} onClick={() => setMode("signin")}>Sign In</button>
            <button className={`login-tab ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Create Account</button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email Address</label>
              <div className="field-input">
                <Mail size={17} />
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
                <Lock size={17} />
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
                  {mode === "signin" ? "Sign in to NARI" : "Create Account"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {onGuest && (
            <>
              <div className="login-divider">
                <span>Or explore without signing in</span>
              </div>
              <button className="login-guest-btn" type="button" onClick={onGuest}>
                <UserRound size={16} />
                Continue in Guest Mode
              </button>
            </>
          )}

          <div className="login-foot">
            <ShieldCheck size={14} />
            <span>Private, client-isolated health data</span>
          </div>
        </div>
      </div>
    </div>
  );
}