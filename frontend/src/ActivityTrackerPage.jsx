import React, { useState, useEffect, useCallback } from "react";
import {
  Droplet, Moon, Footprints, Smile, Utensils, Dumbbell, Scale, Plus, Minus, TrendingUp, Watch
} from "lucide-react";
import {
  getTodayActivity, updateTodayActivity, getActivityHistory,
  getGoogleFitAuthUrl, getGoogleFitStatus, syncGoogleFit
} from "./api.js";

const LOCAL_KEY = "nari_daily_activity";
const GOALS = { water: 8, sleep: 8, steps: 10000, exercise: 30 };
const MOODS = [
  { key: "great", label: "Energized", emoji: "✨" },
  { key: "good", label: "Calm & Good", emoji: "🌿" },
  { key: "okay", label: "Neutral", emoji: "🌤️" },
  { key: "low", label: "Fatigued", emoji: "🌧️" },
  { key: "stressed", label: "Tense / Anxious", emoji: "🌪️" },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function loadLocalLog() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveLocalLog(log) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(log));
  } catch {
    /* ignore */
  }
}
function emptyDay() {
  return { water: 0, sleep_hours: 0, steps: 0, exercise_minutes: 0, mood: null, meals: [], weight: "" };
}

function Ring({ value, goal, color, size = 84, stroke = 8, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal ? value / goal : 0);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#E0E8EA" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset .5s ease" }}
      />
      <foreignObject x="0" y="0" width={size} height={size} style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
      </foreignObject>
    </svg>
  );
}

export default function ActivityTrackerPage({ isGuest }) {
  const [day, setDay] = useState(emptyDay());
  const [history, setHistory] = useState([]);
  const [mealInput, setMealInput] = useState("");
  const [loading, setLoading] = useState(!isGuest);
  const [fitConnected, setFitConnected] = useState(false);
  const [fitSyncing, setFitSyncing] = useState(false);

  const loadGuest = useCallback(() => {
    const log = loadLocalLog();
    const today = todayKey();
    setDay({ ...emptyDay(), ...log[today] });
    const last7 = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return { log_date: key, ...emptyDay(), ...log[key] };
    });
    setHistory(last7);
    setLoading(false);
  }, []);

  const loadRemote = useCallback(async () => {
    try {
      const [todayRow, historyRows] = await Promise.all([getTodayActivity(), getActivityHistory(7)]);
      setDay({ ...emptyDay(), ...todayRow });
      setHistory(historyRows);
    } catch {
      setDay(emptyDay());
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isGuest) loadGuest();
    else {
      loadRemote();
      getGoogleFitStatus()
        .then((s) => setFitConnected(!!s.connected))
        .catch(() => setFitConnected(false));
    }
  }, [isGuest, loadGuest, loadRemote]);

  // Handle redirect from Google Fit OAuth (?fit=connected or ?fit=error)
  useEffect(() => {
    if (isGuest) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("fit") === "connected") {
      setFitConnected(true);
      setFitSyncing(true);
      syncGoogleFit()
        .then((updated) => setDay((prev) => ({ ...prev, steps: updated.steps })))
        .catch(() => {})
        .finally(() => {
          setFitSyncing(false);
          window.history.replaceState(null, "", window.location.pathname + window.location.hash);
        });
    }
  }, [isGuest]);

  const handleConnectFit = async () => {
    try {
      const { auth_url } = await getGoogleFitAuthUrl();
      if (auth_url) window.location.assign(auth_url);
    } catch {
      /* ignore */
    }
  };

  const handleSyncFit = async () => {
    setFitSyncing(true);
    try {
      const updated = await syncGoogleFit();
      if (updated && typeof updated.steps === "number") {
        setDay((prev) => ({ ...prev, steps: updated.steps }));
      }
    } catch {
      /* ignore */
    } finally {
      setFitSyncing(false);
    }
  };

  const persist = async (patch) => {
    const nextDay = { ...day, ...patch };
    setDay(nextDay);
    if (isGuest) {
      const log = loadLocalLog();
      log[todayKey()] = nextDay;
      saveLocalLog(log);
      setHistory((prev) => prev.map((h) => (h.log_date === todayKey() ? { ...h, ...nextDay } : h)));
    } else {
      try {
        const saved = await updateTodayActivity(patch);
        setHistory((prev) => prev.map((h) => (h.log_date === saved.log_date ? saved : h)));
      } catch {
        /* optimistic update */
      }
    }
  };

  const bump = (field, delta, min = 0, max = Infinity) => {
    const next = Math.min(max, Math.max(min, (day[field] || 0) + delta));
    persist({ [field]: next });
  };

  const addMeal = (e) => {
    e.preventDefault();
    if (!mealInput.trim()) return;
    const meals = [
      ...(day.meals || []),
      { text: mealInput.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
    ];
    persist({ meals });
    setMealInput("");
  };

  const removeMeal = (idx) => {
    persist({ meals: (day.meals || []).filter((_, i) => i !== idx) });
  };

  const scoreFor = (d) =>
    (Math.min(1, (d.water || 0) / GOALS.water) +
      Math.min(1, (d.sleep_hours || 0) / GOALS.sleep) +
      Math.min(1, (d.steps || 0) / GOALS.steps) +
      Math.min(1, (d.exercise_minutes || 0) / GOALS.exercise)) / 4;

  const historyDisplay = history.map((h) => ({
    key: h.log_date,
    label: new Date(h.log_date).toLocaleDateString(undefined, { weekday: "short" }),
    score: scoreFor(h),
    isToday: h.log_date === todayKey(),
  }));

  if (loading) return <p className="muted-sm">Loading your activity…</p>;

  return (
    <div className="activity-shell">
      <style>{`
        .activity-shell{ display:flex; flex-direction:column; gap:22px; font-family:'Plus Jakarta Sans','DM Sans',sans-serif; }
        .act-hero{
          background:linear-gradient(150deg, #02182E 0%, #022F56 100%); color:#fff; border-radius:24px; padding:26px 30px;
          display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; box-shadow:0 4px 18px rgba(2,47,86,0.12);
        }
        .act-hero h2{ color:#fff; font-size:20px; font-weight:700; margin:0; }
        .act-hero p{ color:rgba(235,244,246,0.9); font-size:13.5px; margin:4px 0 0; }
        
        .fit-card{
          background:#fff; border-radius:20px; padding:18px 24px; box-shadow:0 1px 3px rgba(0,0,0,0.03);
          border:1px solid #E0E8EA; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;
        }
        .fit-info{ display:flex; align-items:center; gap:14px; }
        .fit-icon{
          width:44px; height:44px; border-radius:14px; background:#CCDEE4;
          display:flex; align-items:center; justify-content:center; color:#061D33; flex-shrink:0;
        }
        .fit-actions{ display:flex; align-items:center; gap:10px; }
        .fit-btn{
          background:#022F56; color:#fff; border:none; border-radius:999px;
          padding:10px 20px; font-weight:700; font-size:13px; cursor:pointer;
          transition:all .18s ease; box-shadow:0 2px 8px rgba(2,47,86,0.18);
        }
        .fit-btn:hover{ background:#02182E; transform:translateY(-1px); box-shadow:0 4px 12px rgba(2,47,86,0.25); }
        .fit-sync-btn{
          background:#F4F7F8; color:#022F56; border:1.5px solid #D5DFE2; border-radius:999px;
          padding:9px 18px; font-weight:700; font-size:13px; cursor:pointer;
          transition:all .18s ease;
        }
        .fit-sync-btn:hover{ background:#EDF3F5; border-color:#022F56; }
        
        .act-rings-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .act-ring-card{
          background:#fff; border-radius:20px; padding:20px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.03);
          border:1px solid #E0E8EA; display:flex; flex-direction:column; align-items:center; text-align:center;
          transition:all .18s ease;
        }
        .act-ring-card:hover{ border-color:#347BA8; transform:translateY(-2px); box-shadow:0 4px 14px rgba(2,47,86,0.06); }
        .act-ring-label{ font-weight:700; font-size:13.5px; color:#0D1D2C; margin-top:12px; }
        .act-ring-value{ font-size:12.5px; color:#4E606D; margin-top:2px; }
        .act-ring-controls{ display:flex; align-items:center; gap:8px; margin-top:14px; }
        .act-ring-btn{
          width:30px; height:30px; border-radius:50%; border:1px solid #D5DFE2; background:#FBFDFD;
          display:flex; align-items:center; justify-content:center; color:#0D1D2C; cursor:pointer;
          transition:all .15s ease;
        }
        .act-ring-btn:hover{ background:#CCDEE4; border-color:#022F56; color:#061D33; }
        
        .act-two-col{ display:grid; grid-template-columns:1fr 1fr; gap:18px; }
        .act-card{ background:#fff; border-radius:20px; padding:22px 24px; box-shadow:0 1px 3px rgba(0,0,0,0.03); border:1px solid #E0E8EA; }
        .act-card-head{ display:flex; align-items:center; gap:9px; color:#022F56; margin-bottom:16px; }
        .act-card-head h3{ font-size:14.5px; margin:0; color:#0D1D2C; font-weight:700; }
        .mood-row{ display:flex; gap:8px; flex-wrap:wrap; }
        .mood-btn{
          flex:1; min-width:54px; padding:10px 8px; border-radius:14px; border:1.5px solid #D5DFE2;
          background:#FBFDFD; display:flex; flex-direction:column; align-items:center; gap:5px; font-size:11px;
          color:#4E606D; font-weight:600; cursor:pointer; transition:all .18s ease;
        }
        .mood-btn span:first-child{ font-size:20px; }
        .mood-btn:hover{ background:#EDF3F5; border-color:#022F56; }
        .mood-btn.selected{ background:#CCDEE4; border-color:#022F56; color:#061D33; font-weight:700; }
        
        .meal-form{ display:flex; gap:8px; margin-bottom:14px; }
        .meal-form input{ flex:1; border:1.5px solid #D5DFE2; border-radius:999px; padding:10px 16px; font-size:13.5px; outline:none; background:#FBFDFD; }
        .meal-form input:focus{ border-color:#022F56; background:#fff; box-shadow:0 0 0 3px rgba(2,47,86,0.1); }
        .meal-form button{ background:#022F56; color:#fff; border:none; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer; }
        .meal-list{ display:flex; flex-direction:column; gap:8px; max-height:180px; overflow-y:auto; }
        .meal-item{ display:flex; align-items:center; justify-content:space-between; background:#EDF3F5; border-radius:12px; padding:9px 14px; font-size:13px; }
        .meal-item span:first-child{ color:#1E2D3A; font-weight:500; }
        .meal-item span.muted-sm{ font-size:11.5px; color:#4E606D; }
        .meal-item button{ background:none; border:none; color:#8A979E; font-size:12px; cursor:pointer; }
        .meal-item button:hover{ color:#C74D4D; }
        
        .weight-row{ display:flex; align-items:center; gap:12px; margin-top:8px; }
        .weight-input{ width:130px; border:1.5px solid #D5DFE2; border-radius:12px; padding:9px 14px; font-size:13.5px; outline:none; background:#FBFDFD; }
        .weight-input:focus{ border-color:#022F56; background:#fff; }
        
        .history-strip{ display:flex; justify-content:space-between; gap:8px; margin-top:14px; }
        .history-day{ flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; }
        .history-bar-track{ width:100%; max-width:24px; height:90px; background:#E0E8EA; border-radius:999px; display:flex; align-items:flex-end; overflow:hidden; }
        .history-bar-fill{ width:100%; border-radius:999px; transition:height .5s ease; }
        .history-day span{ font-size:11.5px; color:#4E606D; font-weight:600; }
        .history-day.today span{ color:#022F56; font-weight:700; }
        .act-guest-note{ font-size:12.5px; color:#4E606D; background:#CCDEE4; border-radius:16px; padding:12px 18px; border:1px solid #C0D7DF; }

        @media (max-width:800px){
          .act-rings-grid{ grid-template-columns:repeat(2,1fr); }
          .act-two-col{ grid-template-columns:1fr; }
        }
      `}</style>

      <div className="act-hero">
        <div>
          <h2>Daily Activity &amp; Wellness Tracker</h2>
          <p>Mindful tracking of hydration, restful sleep, daily steps, and mood across your cycle.</p>
        </div>
      </div>

      {!isGuest && (
        <div className="fit-card">
          <div className="fit-info">
            <div className="fit-icon"><Watch size={22} /></div>
            <div>
              <strong style={{ display: "block", fontSize: "14.5px", color: "#0D1D2C" }}>
                Google Fit Integration
              </strong>
              <span className="muted-sm" style={{ fontSize: "12.5px", color: "#4E606D" }}>
                {fitConnected ? "Connected — daily step count syncs automatically." : "Connect Google Fit to automatically import wearable metrics."}
              </span>
            </div>
          </div>
          <div className="fit-actions">
            {fitConnected ? (
              <button className="fit-sync-btn" onClick={handleSyncFit} disabled={fitSyncing}>
                {fitSyncing ? "Syncing…" : "Sync Steps Now"}
              </button>
            ) : (
              <button className="fit-btn" onClick={handleConnectFit}>Connect Google Fit</button>
            )}
          </div>
        </div>
      )}

      {isGuest && (
        <div className="act-guest-note">
          You are exploring in guest mode — daily logs are saved locally in your browser session.
        </div>
      )}

      <div className="act-rings-grid">
        <div className="act-ring-card">
          <Ring value={day.water} goal={GOALS.water} color="#2A5F85"><Droplet size={20} color="#2A5F85" /></Ring>
          <div className="act-ring-label">Water</div>
          <div className="act-ring-value">{day.water} / {GOALS.water} glasses</div>
          <div className="act-ring-controls">
            <button className="act-ring-btn" onClick={() => bump("water", -1, 0)} aria-label="Decrease water"><Minus size={13} /></button>
            <button className="act-ring-btn" onClick={() => bump("water", 1)} aria-label="Increase water"><Plus size={13} /></button>
          </div>
        </div>

        <div className="act-ring-card">
          <Ring value={day.sleep_hours} goal={GOALS.sleep} color="#1F496B"><Moon size={20} color="#1F496B" /></Ring>
          <div className="act-ring-label">Sleep</div>
          <div className="act-ring-value">{day.sleep_hours} / {GOALS.sleep} hrs</div>
          <div className="act-ring-controls">
            <button className="act-ring-btn" onClick={() => bump("sleep_hours", -0.5, 0)} aria-label="Decrease sleep"><Minus size={13} /></button>
            <button className="act-ring-btn" onClick={() => bump("sleep_hours", 0.5)} aria-label="Increase sleep"><Plus size={13} /></button>
          </div>
        </div>

        <div className="act-ring-card">
          <Ring value={day.steps} goal={GOALS.steps} color="#347BA8"><Footprints size={20} color="#347BA8" /></Ring>
          <div className="act-ring-label">Steps</div>
          <div className="act-ring-value">{day.steps.toLocaleString()} / {GOALS.steps.toLocaleString()}</div>
          <div className="act-ring-controls">
            <button className="act-ring-btn" onClick={() => bump("steps", -500, 0)} aria-label="Decrease steps"><Minus size={13} /></button>
            <button className="act-ring-btn" onClick={() => bump("steps", 500)} aria-label="Increase steps"><Plus size={13} /></button>
          </div>
        </div>

        <div className="act-ring-card">
          <Ring value={day.exercise_minutes} goal={GOALS.exercise} color="#C27B2B"><Dumbbell size={20} color="#C27B2B" /></Ring>
          <div className="act-ring-label">Movement</div>
          <div className="act-ring-value">{day.exercise_minutes} / {GOALS.exercise} min</div>
          <div className="act-ring-controls">
            <button className="act-ring-btn" onClick={() => bump("exercise_minutes", -5, 0)} aria-label="Decrease exercise"><Minus size={13} /></button>
            <button className="act-ring-btn" onClick={() => bump("exercise_minutes", 5)} aria-label="Increase exercise"><Plus size={13} /></button>
          </div>
        </div>
      </div>

      <div className="act-two-col">
        <div className="act-card">
          <div className="act-card-head"><Smile size={17} /><h3>Today's Mood &amp; Emotional State</h3></div>
          <div className="mood-row">
            {MOODS.map((m) => (
              <button
                key={m.key}
                className={`mood-btn ${day.mood === m.key ? "selected" : ""}`}
                onClick={() => persist({ mood: day.mood === m.key ? null : m.key })}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: "20px" }}>
            <div className="act-card-head" style={{ marginBottom: "8px" }}><Scale size={17} /><h3>Weight Monitoring</h3></div>
            <div className="weight-row">
              <input
                className="weight-input"
                placeholder="e.g. 58.5 kg"
                value={day.weight || ""}
                onChange={(e) => persist({ weight: e.target.value })}
              />
              <span className="muted-sm" style={{ color: "#4E606D", fontSize: "12.5px" }}>Natural fluctuations across cycle phases</span>
            </div>
          </div>
        </div>

        <div className="act-card">
          <div className="act-card-head"><Utensils size={17} /><h3>Nourishment &amp; Meals</h3></div>
          <form className="meal-form" onSubmit={addMeal}>
            <input
              placeholder="e.g. Warm spinach salad with pumpkin seeds"
              value={mealInput}
              onChange={(e) => setMealInput(e.target.value)}
            />
            <button type="submit" aria-label="Add meal"><Plus size={15} /></button>
          </form>

          <div className="meal-list">
            {(day.meals || []).length === 0 && (
              <p className="muted-sm" style={{ padding: "8px 0", color: "#4E606D", fontSize: "12.5px" }}>No meals logged today yet.</p>
            )}
            {(day.meals || []).map((m, i) => (
              <div className="meal-item" key={i}>
                <span>{m.text}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="muted-sm">{m.time}</span>
                  <button onClick={() => removeMeal(i)} aria-label="Remove meal">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="act-card">
        <div className="act-card-head"><TrendingUp size={17} /><h3>7-Day Wellness Balance</h3></div>
        <p className="muted-sm" style={{ color: "#4E606D", fontSize: "12.5px", margin: "0 0 12px" }}>
          Calculated across water, sleep, step, and movement balance.
        </p>
        <div className="history-strip">
          {historyDisplay.map((d) => (
            <div key={d.key} className={`history-day ${d.isToday ? "today" : ""}`}>
              <div className="history-bar-track">
                <div
                  className="history-bar-fill"
                  style={{
                    height: `${Math.max(6, d.score * 100)}%`,
                    background: d.isToday
                      ? "linear-gradient(180deg,#2A5F85,#022F56)"
                      : "linear-gradient(180deg,#CCDEE4,#A7CBD9)",
                  }}
                />
              </div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}