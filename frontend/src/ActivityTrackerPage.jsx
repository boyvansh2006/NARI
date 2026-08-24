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
  { key: "great", label: "Great", emoji: "😄" },
  { key: "good", label: "Good", emoji: "🙂" },
  { key: "okay", label: "Okay", emoji: "😐" },
  { key: "low", label: "Low", emoji: "😔" },
  { key: "stressed", label: "Stressed", emoji: "😣" },
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

function Ring({ value, goal, color, size = 84, stroke = 9, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal ? value / goal : 0);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#E6ECE8" strokeWidth={stroke} fill="none" />
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
        .activity-shell{ display:flex; flex-direction:column; gap:20px; }
        .act-hero{
          background:linear-gradient(140deg, #0A3B31 0%, #0F5144 100%); color:#fff; border-radius:20px; padding:24px 28px;
          display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; box-shadow:var(--shadow-card);
        }
        .act-hero h2{ color:#fff; font-size:19px; }
        .act-hero p{ color:rgba(230,244,241,0.85); font-size:13px; margin-top:4px; }
        .fit-card{
          background:#fff; border-radius:16px; padding:16px 20px; box-shadow:var(--shadow-card);
          border:1px solid #E2EBE7; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px;
        }
        .fit-info{ display:flex; align-items:center; gap:12px; }
        .fit-icon{
          width:42px; height:42px; border-radius:12px; background:#E6F4F1;
          display:flex; align-items:center; justify-content:center; color:#0F5144; flex-shrink:0;
        }
        .fit-actions{ display:flex; align-items:center; gap:10px; }
        .fit-btn{
          background:#0F5144; color:#fff; border:none; border-radius:10px;
          padding:9px 16px; font-family:var(--font-head); font-weight:700; font-size:12.5px; cursor:pointer;
          transition:all .18s ease;
        }
        .fit-btn:hover{ background:#0A3B31; transform:translateY(-1px); }
        .fit-sync-btn{
          background:#FAFCFB; color:#0F5144; border:1.5px solid #CBD5E1; border-radius:10px;
          padding:8px 15px; font-family:var(--font-head); font-weight:700; font-size:12.5px; cursor:pointer;
          transition:all .18s ease;
        }
        .fit-sync-btn:hover{ background:#E6F4F1; border-color:#0F5144; }
        .act-rings-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .act-ring-card{
          background:#fff; border-radius:16px; padding:18px 16px; box-shadow:var(--shadow-card);
          border:1px solid #E2EBE7; display:flex; flex-direction:column; align-items:center; text-align:center;
        }
        .act-ring-label{ font-family:var(--font-head); font-weight:700; font-size:13px; color:#0F2922; margin-top:10px; }
        .act-ring-value{ font-size:12px; color:#527068; margin-top:2px; }
        .act-ring-controls{ display:flex; align-items:center; gap:8px; margin-top:12px; }
        .act-ring-btn{
          width:28px; height:28px; border-radius:50%; border:1px solid #E2E8F0; background:#FAFCFB;
          display:flex; align-items:center; justify-content:center; color:#0F2922; cursor:pointer;
          transition:all .15s ease;
        }
        .act-ring-btn:hover{ background:#E6F4F1; border-color:#0F5144; }
        .act-two-col{ display:grid; grid-template-columns:1fr 1fr; gap:18px; }
        .act-card{ background:#fff; border-radius:16px; padding:20px 22px; box-shadow:var(--shadow-card); border:1px solid #E2EBE7; }
        .act-card-head{ display:flex; align-items:center; gap:8px; color:#0F5144; margin-bottom:14px; }
        .act-card-head h3{ font-size:14px; margin:0; color:#0F2922; font-weight:700; }
        .mood-row{ display:flex; gap:8px; flex-wrap:wrap; }
        .mood-btn{
          flex:1; min-width:52px; padding:9px 6px; border-radius:12px; border:1.5px solid #E2E8F0;
          background:#FAFCFB; display:flex; flex-direction:column; align-items:center; gap:4px; font-size:11px;
          color:#527068; font-weight:600; cursor:pointer; transition:all .18s ease;
        }
        .mood-btn span:first-child{ font-size:18px; }
        .mood-btn:hover{ background:#E6F4F1; border-color:#0F5144; }
        .mood-btn.selected{ background:#E6F4F1; border-color:#0F5144; color:#0F5144; font-weight:700; }
        .meal-form{ display:flex; gap:8px; margin-bottom:12px; }
        .meal-form input{ flex:1; border:1.5px solid #E2E8F0; border-radius:10px; padding:9px 14px; font-size:13.5px; outline:none; }
        .meal-form input:focus{ border-color:#0F5144; }
        .meal-form button{ background:#0F5144; color:#fff; border:none; border-radius:10px; width:38px; height:38px; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer; }
        .meal-list{ display:flex; flex-direction:column; gap:8px; max-height:180px; overflow-y:auto; }
        .meal-item{ display:flex; align-items:center; justify-content:space-between; background:#F0F7F4; border-radius:10px; padding:8px 12px; font-size:13px; }
        .meal-item span:first-child{ color:#1E3A34; }
        .meal-item span.muted-sm{ font-size:11px; color:#527068; }
        .meal-item button{ background:none; border:none; color:#94A3B8; font-size:12px; cursor:pointer; }
        .meal-item button:hover{ color:#DC2626; }
        .weight-row{ display:flex; align-items:center; gap:10px; margin-top:8px; }
        .weight-input{ width:120px; border:1.5px solid #E2E8F0; border-radius:10px; padding:8px 12px; font-size:13.5px; outline:none; }
        .weight-input:focus{ border-color:#0F5144; }
        .history-strip{ display:flex; justify-content:space-between; gap:8px; margin-top:12px; }
        .history-day{ flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; }
        .history-bar-track{ width:100%; max-width:24px; height:90px; background:#E6ECE8; border-radius:6px; display:flex; align-items:flex-end; overflow:hidden; }
        .history-bar-fill{ width:100%; border-radius:6px; transition:height .5s ease; }
        .history-day span{ font-size:11px; color:#527068; font-weight:600; }
        .history-day.today span{ color:#0F5144; font-weight:700; }
        .act-guest-note{ font-size:12px; color:#527068; background:#E6F4F1; border-radius:12px; padding:10px 16px; border:1px solid #D1FAE5; }

        @media (max-width:800px){
          .act-rings-grid{ grid-template-columns:repeat(2,1fr); }
          .act-two-col{ grid-template-columns:1fr; }
        }
      `}</style>

      <div className="act-hero">
        <div>
          <h2>Daily Activity &amp; Wellness Tracker</h2>
          <p>Track hydration, sleep, steps, meals, and mood across your cycle.</p>
        </div>
      </div>

      {!isGuest && (
        <div className="fit-card">
          <div className="fit-info">
            <div className="fit-icon"><Watch size={20} /></div>
            <div>
              <strong style={{ display: "block", fontFamily: "var(--font-head)", fontSize: "14px", color: "#0F2922" }}>
                Google Fit Integration
              </strong>
              <span className="muted-sm" style={{ fontSize: "12px", color: "#527068" }}>
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
          <Ring value={day.water} goal={GOALS.water} color="#059669"><Droplet size={20} color="#059669" /></Ring>
          <div className="act-ring-label">Water</div>
          <div className="act-ring-value">{day.water} / {GOALS.water} glasses</div>
          <div className="act-ring-controls">
            <button className="act-ring-btn" onClick={() => bump("water", -1, 0)} aria-label="Decrease water"><Minus size={13} /></button>
            <button className="act-ring-btn" onClick={() => bump("water", 1)} aria-label="Increase water"><Plus size={13} /></button>
          </div>
        </div>

        <div className="act-ring-card">
          <Ring value={day.sleep_hours} goal={GOALS.sleep} color="#0F766E"><Moon size={20} color="#0F766E" /></Ring>
          <div className="act-ring-label">Sleep</div>
          <div className="act-ring-value">{day.sleep_hours} / {GOALS.sleep} hrs</div>
          <div className="act-ring-controls">
            <button className="act-ring-btn" onClick={() => bump("sleep_hours", -0.5, 0)} aria-label="Decrease sleep"><Minus size={13} /></button>
            <button className="act-ring-btn" onClick={() => bump("sleep_hours", 0.5)} aria-label="Increase sleep"><Plus size={13} /></button>
          </div>
        </div>

        <div className="act-ring-card">
          <Ring value={day.steps} goal={GOALS.steps} color="#047857"><Footprints size={20} color="#047857" /></Ring>
          <div className="act-ring-label">Steps</div>
          <div className="act-ring-value">{day.steps.toLocaleString()} / {GOALS.steps.toLocaleString()}</div>
          <div className="act-ring-controls">
            <button className="act-ring-btn" onClick={() => bump("steps", -500, 0)} aria-label="Decrease steps"><Minus size={13} /></button>
            <button className="act-ring-btn" onClick={() => bump("steps", 500)} aria-label="Increase steps"><Plus size={13} /></button>
          </div>
        </div>

        <div className="act-ring-card">
          <Ring value={day.exercise_minutes} goal={GOALS.exercise} color="#D97706"><Dumbbell size={20} color="#D97706" /></Ring>
          <div className="act-ring-label">Exercise</div>
          <div className="act-ring-value">{day.exercise_minutes} / {GOALS.exercise} min</div>
          <div className="act-ring-controls">
            <button className="act-ring-btn" onClick={() => bump("exercise_minutes", -5, 0)} aria-label="Decrease exercise"><Minus size={13} /></button>
            <button className="act-ring-btn" onClick={() => bump("exercise_minutes", 5)} aria-label="Increase exercise"><Plus size={13} /></button>
          </div>
        </div>
      </div>

      <div className="act-two-col">
        <div className="act-card">
          <div className="act-card-head"><Smile size={16} /><h3>Today's Mood &amp; Energy</h3></div>
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

          <div style={{ marginTop: "18px" }}>
            <div className="act-card-head" style={{ marginBottom: "8px" }}><Scale size={16} /><h3>Weight Log</h3></div>
            <div className="weight-row">
              <input
                className="weight-input"
                placeholder="e.g. 58.5 kg"
                value={day.weight || ""}
                onChange={(e) => persist({ weight: e.target.value })}
              />
              <span className="muted-sm">Track weight fluctuations across cycle phases</span>
            </div>
          </div>
        </div>

        <div className="act-card">
          <div className="act-card-head"><Utensils size={16} /><h3>Nutrition &amp; Meals</h3></div>
          <form className="meal-form" onSubmit={addMeal}>
            <input
              placeholder="e.g. Lentil soup with spinach"
              value={mealInput}
              onChange={(e) => setMealInput(e.target.value)}
            />
            <button type="submit" aria-label="Add meal"><Plus size={14} /></button>
          </form>

          <div className="meal-list">
            {(day.meals || []).length === 0 && (
              <p className="muted-sm" style={{ padding: "8px 0" }}>No meals logged today yet.</p>
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
        <div className="act-card-head"><TrendingUp size={16} /><h3>7-Day Wellness Consistency</h3></div>
        <p className="muted-sm">Computed across water, sleep, step, and exercise targets.</p>
        <div className="history-strip">
          {historyDisplay.map((d) => (
            <div key={d.key} className={`history-day ${d.isToday ? "today" : ""}`}>
              <div className="history-bar-track">
                <div
                  className="history-bar-fill"
                  style={{
                    height: `${Math.max(6, d.score * 100)}%`,
                    background: d.isToday
                      ? "linear-gradient(180deg,#059669,#0F5144)"
                      : "linear-gradient(180deg,#D1FAE5,#A7F3D0)",
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