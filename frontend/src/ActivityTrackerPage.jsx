import React, { useState, useEffect, useCallback } from "react";
import { Droplet, Moon, Footprints, Smile, Utensils, Dumbbell, Scale, Plus, Minus, TrendingUp } from "lucide-react";
import { getTodayActivity, updateTodayActivity, getActivityHistory } from "./api.js";

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
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#F0E9FF" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset .5s ease" }} />
      <foreignObject x="0" y="0" width={size} height={size} style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
      </foreignObject>
    </svg>
  );
}

export default function ActivityTrackerPage({ isGuest }) {
  const [day, setDay] = useState(emptyDay());
  const [history, setHistory] = useState([]); // [{log_date, water, sleep_hours, steps, exercise_minutes}]
  const [mealInput, setMealInput] = useState("");
  const [loading, setLoading] = useState(!isGuest);

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
    else loadRemote();
  }, [isGuest, loadGuest, loadRemote]);

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
        /* ignore - optimistic update already applied */
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
    const meals = [...(day.meals || []), { text: mealInput.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }];
    persist({ meals });
    setMealInput("");
  };

  const removeMeal = (idx) => {
    persist({ meals: (day.meals || []).filter((_, i) => i !== idx) });
  };

  const scoreFor = (d) =>
    (Math.min(1, (d.water || 0) / GOALS.water) + Math.min(1, (d.sleep_hours || 0) / GOALS.sleep) +
      Math.min(1, (d.steps || 0) / GOALS.steps) + Math.min(1, (d.exercise_minutes || 0) / GOALS.exercise)) / 4;

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
        .activity-shell{ display:flex; flex-direction:column; gap:22px; }
        .act-hero{
          background:var(--gradient-hero); color:#fff; border-radius:24px; padding:26px 30px;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:18px;
        }
        .act-hero h2{ color:#fff; font-size:20px; }
        .act-hero p{ color:rgba(255,247,240,0.82); font-size:13px; margin-top:4px; }
        .act-rings-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .act-ring-card{
          background:#fff; border-radius:20px; padding:20px; box-shadow:var(--shadow-soft);
          display:flex; flex-direction:column; align-items:center; gap:10px; transition:transform .2s ease;
        }
        .act-ring-card:hover{ transform:translateY(-3px); }
        .act-ring-label{ font-family:var(--font-head); font-weight:700; font-size:13px; color:var(--deep-violet); display:flex; align-items:center; gap:6px; }
        .act-ring-value{ font-size:12px; color:var(--ink-soft); }
        .act-ring-controls{ display:flex; align-items:center; gap:10px; }
        .act-round-btn{
          width:30px; height:30px; border-radius:50%; border:1.5px solid var(--line); background:#fff;
          display:flex; align-items:center; justify-content:center; color:var(--primary-purple); transition:transform .15s ease;
        }
        .act-round-btn:hover{ transform:scale(1.1); background:var(--gradient-blush); }
        .act-ring-num{ font-family:var(--font-head); font-weight:700; font-size:14px; color:var(--deep-violet); min-width:34px; text-align:center; }
        .act-two-col{ display:grid; grid-template-columns:1fr 1fr; gap:18px; }
        .act-card{ background:#fff; border-radius:20px; padding:22px 24px; box-shadow:var(--shadow-soft); }
        .act-card-head{ display:flex; align-items:center; gap:9px; color:var(--primary-purple); margin-bottom:14px; }
        .act-card-head h3{ font-size:14.5px; color:var(--deep-violet); }
        .mood-row{ display:flex; gap:10px; flex-wrap:wrap; }
        .mood-btn{ flex:1; min-width:64px; display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px 8px; border-radius:16px; border:1.5px solid var(--line); background:#fff; transition:all .18s ease; }
        .mood-btn .emoji{ font-size:22px; }
        .mood-btn span{ font-size:11px; color:var(--ink-soft); font-weight:600; }
        .mood-btn.selected{ background:var(--gradient-blush); border-color:var(--primary-purple); transform:translateY(-2px); }
        .weight-row{ display:flex; align-items:center; gap:10px; margin-top:4px; }
        .weight-row input{ flex:1; border:1.5px solid var(--line); border-radius:12px; padding:10px 13px; font-size:14px; outline:none; }
        .weight-row input:focus{ border-color:var(--primary-purple); }
        .weight-unit{ font-size:12.5px; color:var(--ink-soft); font-weight:600; }
        .meal-form{ display:flex; gap:8px; margin-bottom:12px; }
        .meal-form input{ flex:1; border:1.5px solid var(--line); border-radius:100px; padding:10px 16px; font-size:13.5px; outline:none; }
        .meal-form input:focus{ border-color:var(--primary-purple); }
        .meal-form button{ background:linear-gradient(135deg,var(--primary-purple),#5D3FB5); color:#fff; border:none; border-radius:50%; width:38px; height:38px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .meal-list{ display:flex; flex-direction:column; gap:8px; max-height:180px; overflow-y:auto; }
        .meal-item{ display:flex; align-items:center; justify-content:space-between; background:var(--warm-cream); border-radius:12px; padding:9px 13px; font-size:13px; }
        .meal-item span:first-child{ color:var(--ink); }
        .meal-item span:last-child{ color:var(--ink-soft); font-size:11.5px; }
        .meal-item button{ background:none; border:none; color:var(--ink-soft); cursor:pointer; margin-left:8px; }
        .history-card{ background:#fff; border-radius:20px; padding:22px 24px; box-shadow:var(--shadow-soft); }
        .history-strip{ display:flex; justify-content:space-between; gap:8px; margin-top:12px; }
        .history-day{ flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; }
        .history-bar-track{ width:100%; max-width:26px; height:100px; background:#F0E9FF; border-radius:100px; display:flex; align-items:flex-end; overflow:hidden; }
        .history-bar-fill{ width:100%; border-radius:100px; transition:height .5s ease; }
        .history-day span{ font-size:11px; color:var(--ink-soft); font-weight:600; }
        .history-day.today span{ color:var(--primary-purple); }
        .act-guest-note{ font-size:12px; color:var(--ink-soft); background:var(--gradient-blush); border-radius:14px; padding:10px 16px; }
        @media (max-width:900px){ .act-rings-grid{ grid-template-columns:repeat(2,1fr); } .act-two-col{ grid-template-columns:1fr; } }
      `}</style>

      <div className="act-hero">
        <div>
          <h2>Daily activity tracker</h2>
          <p>Log water, sleep, steps, mood, meals and exercise — build a healthy rhythm one day at a time.</p>
        </div>
        <div className="rem-summary-stat">
          <strong>{Math.round(scoreFor(day) * 100)}%</strong>
          <span>Today's goal progress</span>
        </div>
      </div>

      {isGuest && (
        <div className="act-guest-note">You're in guest mode — activity is saved on this device only. Sign in to sync it to your account.</div>
      )}

      <div className="act-rings-grid">
        <div className="act-ring-card">
          <Ring value={day.water} goal={GOALS.water} color="#7C5CD6"><Droplet size={22} color="#7C5CD6" /></Ring>
          <div className="act-ring-label">Water</div>
          <div className="act-ring-value">{day.water} / {GOALS.water} glasses</div>
          <div className="act-ring-controls">
            <button className="act-round-btn" onClick={() => bump("water", -1)}><Minus size={14} /></button>
            <span className="act-ring-num">{day.water}</span>
            <button className="act-round-btn" onClick={() => bump("water", 1, 0, 20)}><Plus size={14} /></button>
          </div>
        </div>

        <div className="act-ring-card">
          <Ring value={day.sleep_hours} goal={GOALS.sleep} color="#F5A6C2"><Moon size={22} color="#F5A6C2" /></Ring>
          <div className="act-ring-label">Sleep</div>
          <div className="act-ring-value">{day.sleep_hours} / {GOALS.sleep} hrs</div>
          <div className="act-ring-controls">
            <button className="act-round-btn" onClick={() => bump("sleep_hours", -0.5)}><Minus size={14} /></button>
            <span className="act-ring-num">{day.sleep_hours}</span>
            <button className="act-round-btn" onClick={() => bump("sleep_hours", 0.5, 0, 14)}><Plus size={14} /></button>
          </div>
        </div>

        <div className="act-ring-card">
          <Ring value={day.steps} goal={GOALS.steps} color="#8FD6C4"><Footprints size={22} color="#3F8F87" /></Ring>
          <div className="act-ring-label">Steps</div>
          <div className="act-ring-value">{day.steps.toLocaleString()} / {GOALS.steps.toLocaleString()}</div>
          <div className="act-ring-controls">
            <button className="act-round-btn" onClick={() => bump("steps", -500, 0)}><Minus size={14} /></button>
            <span className="act-ring-num">{Math.round(day.steps / 1000)}k</span>
            <button className="act-round-btn" onClick={() => bump("steps", 500, 0, 50000)}><Plus size={14} /></button>
          </div>
        </div>

        <div className="act-ring-card">
          <Ring value={day.exercise_minutes} goal={GOALS.exercise} color="#F6C453"><Dumbbell size={22} color="#B8860B" /></Ring>
          <div className="act-ring-label">Exercise</div>
          <div className="act-ring-value">{day.exercise_minutes} / {GOALS.exercise} min</div>
          <div className="act-ring-controls">
            <button className="act-round-btn" onClick={() => bump("exercise_minutes", -5, 0)}><Minus size={14} /></button>
            <span className="act-ring-num">{day.exercise_minutes}</span>
            <button className="act-round-btn" onClick={() => bump("exercise_minutes", 5, 0, 300)}><Plus size={14} /></button>
          </div>
        </div>
      </div>

      <div className="act-two-col">
        <div className="act-card">
          <div className="act-card-head"><Smile size={16} /><h3>How are you feeling today?</h3></div>
          <div className="mood-row">
            {MOODS.map((m) => (
              <button key={m.key} className={`mood-btn ${day.mood === m.key ? "selected" : ""}`} onClick={() => persist({ mood: m.key })}>
                <span className="emoji">{m.emoji}</span><span>{m.label}</span>
              </button>
            ))}
          </div>
          <div className="act-card-head" style={{ marginTop: 22 }}><Scale size={16} /><h3>Weight (optional)</h3></div>
          <div className="weight-row">
            <input type="number" step="0.1" placeholder="e.g. 58.5" value={day.weight || ""} onChange={(e) => persist({ weight: e.target.value })} />
            <span className="weight-unit">kg</span>
          </div>
        </div>

        <div className="act-card">
          <div className="act-card-head"><Utensils size={16} /><h3>Meals logged today</h3></div>
          <form className="meal-form" onSubmit={addMeal}>
            <input value={mealInput} onChange={(e) => setMealInput(e.target.value)} placeholder="e.g. Oats with almonds and berries" />
            <button type="submit"><Plus size={16} /></button>
          </form>
          <div className="meal-list">
            {(day.meals || []).length === 0 && <p className="muted-sm">No meals logged yet today.</p>}
            {(day.meals || []).map((m, i) => (
              <div className="meal-item" key={i}>
                <span>{m.text}</span><span>{m.time}</span>
                <button onClick={() => removeMeal(i)} aria-label="Remove"><Minus size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="history-card">
        <div className="act-card-head"><TrendingUp size={16} /><h3>Last 7 days</h3></div>
        <div className="history-strip">
          {historyDisplay.map((d) => (
            <div className={`history-day ${d.isToday ? "today" : ""}`} key={d.key}>
              <div className="history-bar-track">
                <div className="history-bar-fill" style={{
                  height: `${Math.max(6, d.score * 100)}%`,
                  background: d.isToday ? "linear-gradient(180deg,#7C5CD6,#5D3FB5)" : "linear-gradient(180deg,#E7CFFF,#C9B8EA)",
                }} />
              </div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}