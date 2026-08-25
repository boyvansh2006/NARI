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
          background:#FFFFFF; border:1px solid #D5DFE2; border-radius:28px; padding:44px 38px;
          box-shadow:0 4px 20px rgba(2,47,86,0.06); width:100%; display:flex; flex-direction:column;
          align-items:center; animation:guestCardIn .3s cubic-bezier(.2,.8,.2,1);
        }
        @keyframes guestCardIn{ from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:translateY(0); } }
        .guest-restriction-icon-wrap{
          position:relative; width:64px; height:64px; border-radius:22px;
          background:linear-gradient(135deg,#CCDEE4 0%,#EDF3F5 100%);
          display:flex; align-items:center; justify-content:center; color:#022F56; margin-bottom:22px;
        }
        .guest-restriction-badge{
          position:absolute; bottom:-4px; right:-4px; width:24px; height:24px; border-radius:50%;
          background:#022F56; color:#fff; display:flex; align-items:center; justify-content:center;
          border:2px solid #fff;
        }
        .guest-restriction-card h2{
          font-family:'Sora',sans-serif; font-size:23px; font-weight:800; color:#0D1D2C; margin:0 0 10px;
        }
        .guest-restriction-card p{
          color:#4E606D; font-size:14.5px; line-height:1.65; margin:0 0 26px; max-width:500px;
        }
        .guest-benefits-list{
          background:#F7F9FA; border:1px solid #E0E8EA; border-radius:18px; padding:18px 22px;
          width:100%; margin-bottom:28px; text-align:left; display:flex; flex-direction:column; gap:10px;
        }
        .guest-benefit-item{
          display:flex; align-items:center; gap:10px; font-size:13px; color:#162736; font-weight:600;
        }
        .guest-benefit-item svg{ color:#022F56; flex-shrink:0; }
        .guest-actions-row{ display:flex; gap:12px; flex-wrap:wrap; justify-content:center; width:100%; }
        .guest-primary-btn{
          display:inline-flex; align-items:center; gap:8px; background:#022F56; color:#fff;
          border:none; border-radius:999px; padding:14px 28px; font-weight:700; font-size:14px;
          font-family:'Sora',sans-serif; cursor:pointer; transition:all .18s ease;
          box-shadow:0 3px 12px rgba(2,47,86,0.2);
        }
        .guest-primary-btn:hover{ background:#02182E; transform:translateY(-1px); }
        .guest-secondary-btn{
          display:inline-flex; align-items:center; gap:8px; background:none; color:#4E606D;
          border:1.5px solid #D5DFE2; border-radius:999px; padding:13px 22px; font-weight:600;
          font-size:13.5px; cursor:pointer; transition:all .18s ease;
        }
        .guest-secondary-btn:hover{ background:#F7F9FA; border-color:#022F56; color:#022F56; }
        .guest-restriction-wrap button:active{ transform:scale(0.96); }
        .guest-restriction-wrap *:focus-visible{ outline:2px solid #022F56; outline-offset:2px; border-radius:8px; }

        @media (max-width:520px){
          .guest-restriction-wrap{ padding:24px 14px; }
          .guest-restriction-card{ padding:30px 22px; border-radius:22px; }
          .guest-restriction-card h2{ font-size:19px; }
          .guest-actions-row{ flex-direction:column; align-items:stretch; }
          .guest-primary-btn, .guest-secondary-btn{ justify-content:center; }
        }
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
