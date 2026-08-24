import React from "react";
import { Lock, ShieldCheck, ArrowRight, HeartPulse, Sparkles, CheckCircle2 } from "lucide-react";

export default function GuestGate({
  featureTitle = "Account Feature",
  featureDescription = "This feature requires a secure account to protect your private clinical records and persist your health data over time.",
  benefits = [
    "End-to-end encrypted storage for your private health data",
    "Access your health twin & history from any phone or computer",
    "Continuous personalized guidance from NARI's AI multi-agent system"
  ],
  onSignIn,
  onGoToChat
}) {
  return (
    <div className="guest-restriction-wrap">
      <style>{`
        .guest-restriction-wrap{
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding:40px 20px; max-width:680px; margin:0 auto; width:100%; text-align:center;
          font-family:'Plus Jakarta Sans','DM Sans',sans-serif;
        }
        .guest-restriction-card{
          background:#FFFFFF; border:1px solid #D5E2DC; border-radius:28px; padding:44px 38px;
          box-shadow:0 4px 20px rgba(27,94,80,0.06); width:100%; display:flex; flex-direction:column;
          align-items:center;
        }
        .guest-restriction-icon-wrap{
          position:relative; width:64px; height:64px; border-radius:22px;
          background:linear-gradient(135deg,#D6EDE5 0%,#EDF5F1 100%);
          display:flex; align-items:center; justify-content:center; color:#1B5E50; margin-bottom:22px;
        }
        .guest-restriction-badge{
          position:absolute; bottom:-4px; right:-4px; width:24px; height:24px; border-radius:50%;
          background:#1B5E50; color:#fff; display:flex; align-items:center; justify-content:center;
          border:2px solid #fff;
        }
        .guest-restriction-card h2{
          font-family:'Sora',sans-serif; font-size:23px; font-weight:800; color:#0D2C24; margin:0 0 10px;
        }
        .guest-restriction-card p{
          color:#4E6D64; font-size:14.5px; line-height:1.65; margin:0 0 26px; max-width:500px;
        }
        .guest-benefits-list{
          background:#F7FAF8; border:1px solid #E0EAE5; border-radius:18px; padding:18px 22px;
          width:100%; margin-bottom:28px; text-align:left; display:flex; flex-direction:column; gap:10px;
        }
        .guest-benefit-item{
          display:flex; align-items:center; gap:10px; font-size:13px; color:#16362F; font-weight:600;
        }
        .guest-benefit-item svg{ color:#1B5E50; flex-shrink:0; }
        .guest-actions-row{ display:flex; gap:12px; flex-wrap:wrap; justify-content:center; width:100%; }
        .guest-primary-btn{
          display:inline-flex; align-items:center; gap:8px; background:#1B5E50; color:#fff;
          border:none; border-radius:999px; padding:14px 28px; font-weight:700; font-size:14px;
          font-family:'Sora',sans-serif; cursor:pointer; transition:all .18s ease;
          box-shadow:0 3px 12px rgba(27,94,80,0.2);
        }
        .guest-primary-btn:hover{ background:#144D42; transform:translateY(-1px); }
        .guest-secondary-btn{
          display:inline-flex; align-items:center; gap:8px; background:none; color:#4E6D64;
          border:1.5px solid #D5E2DC; border-radius:999px; padding:13px 22px; font-weight:600;
          font-size:13.5px; cursor:pointer; transition:all .18s ease;
        }
        .guest-secondary-btn:hover{ background:#F7FAF8; border-color:#1B5E50; color:#1B5E50; }
      `}</style>

      <div className="guest-restriction-card">
        <div className="guest-restriction-icon-wrap">
          <HeartPulse size={30} />
          <div className="guest-restriction-badge">
            <Lock size={12} />
          </div>
        </div>

        <h2>{featureTitle}</h2>
        <p>{featureDescription}</p>

        <div className="guest-benefits-list">
          {benefits.map((b, i) => (
            <div className="guest-benefit-item" key={i}>
              <CheckCircle2 size={16} />
              <span>{b}</span>
            </div>
          ))}
        </div>

        <div className="guest-actions-row">
          <button className="guest-primary-btn" onClick={onSignIn}>
            Create Free Account / Sign In <ArrowRight size={15} />
          </button>
          {onGoToChat && (
            <button className="guest-secondary-btn" onClick={onGoToChat}>
              Explore Free Chat &amp; OCR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
