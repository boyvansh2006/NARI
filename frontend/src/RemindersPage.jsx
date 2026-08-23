import React, { useState, useEffect, useRef, useCallback } from "react";
import { Pill, Plus, Clock, Trash2, CheckCircle2, Bell, AlarmClock } from "lucide-react";
import { fetchReminders, createReminderApi, toggleReminderApi, deleteReminderApi } from "./api.js";

const STORAGE_KEY = "nari_medication_reminders";
const FREQUENCIES = ["Once daily", "Twice daily", "Three times daily", "Weekly", "As needed"];

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveLocal(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Normalize both API rows ({id, name, dose, time, frequency, taken_log})
// and local rows ({id, name, dose, time, frequency, log}) to one shape.
function normalize(r) {
  return { ...r, log: r.taken_log ?? r.log ?? {} };
}

export default function RemindersPage({ onTaken, isGuest }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(!isGuest);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("08:00");
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const firedTodayRef = useRef(new Set());

  const refresh = useCallback(async () => {
    if (isGuest) {
      setReminders(loadLocal().map(normalize));
      setLoading(false);
      return;
    }
    try {
      const rows = await fetchReminders();
      setReminders(rows.map(normalize));
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reminder notification polling
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const today = todayKey();
      reminders.forEach((r) => {
        const fireKey = `${r.id}-${today}-${hhmm}`;
        if (r.time === hhmm && !firedTodayRef.current.has(fireKey)) {
          firedTodayRef.current.add(fireKey);
          if (notifPermission === "granted") {
            try {
              new Notification("Time for your medication", { body: `${r.name}${r.dose ? ` — ${r.dose}` : ""}` });
            } catch {
              /* ignore */
            }
          }
        }
      });
    };
    const interval = setInterval(check, 30000);
    check();
    return () => clearInterval(interval);
  }, [reminders, notifPermission]);

  const requestNotifications = () => {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setNotifPermission);
  };

  const addReminder = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = { name: name.trim(), dose: dose.trim() || null, time, frequency };

    if (isGuest) {
      const reminder = { id: Date.now(), ...payload, log: {} };
      const next = [reminder, ...loadLocal()];
      saveLocal(next);
      setReminders(next.map(normalize));
    } else {
      try {
        const created = await createReminderApi(payload);
        setReminders((prev) => [normalize(created), ...prev]);
      } catch {
        /* swallow - could show a toast */
      }
    }
    setName(""); setDose(""); setTime("08:00"); setFrequency(FREQUENCIES[0]); setShowForm(false);
  };

  const removeReminder = async (id) => {
    if (isGuest) {
      const next = loadLocal().filter((r) => r.id !== id);
      saveLocal(next);
      setReminders(next.map(normalize));
    } else {
      try {
        await deleteReminderApi(id);
        setReminders((prev) => prev.filter((r) => r.id !== id));
      } catch {
        /* ignore */
      }
    }
  };

  const toggleTaken = async (id) => {
    const today = todayKey();
    if (isGuest) {
      const next = loadLocal().map((r) => {
        if (r.id !== id) return r;
        const nowTaken = !r.log?.[today];
        if (nowTaken && onTaken) onTaken(r);
        return { ...r, log: { ...(r.log || {}), [today]: nowTaken } };
      });
      saveLocal(next);
      setReminders(next.map(normalize));
    } else {
      try {
        const updated = await toggleReminderApi(id);
        const norm = normalize(updated);
        if (norm.log?.[today] && onTaken) onTaken(norm);
        setReminders((prev) => prev.map((r) => (r.id === id ? norm : r)));
      } catch {
        /* ignore */
      }
    }
  };

  const today = todayKey();
  const takenCount = reminders.filter((r) => r.log?.[today]).length;

  return (
    <div className="reminders-shell">
      <style>{`
        .reminders-shell{ display:flex; flex-direction:column; gap:20px; }
        .rem-summary{
          background:var(--gradient-hero); color:#fff; border-radius:24px; padding:24px 28px;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;
        }
        .rem-summary-text h2{ color:#fff; font-size:19px; }
        .rem-summary-text p{ color:rgba(255,247,240,0.82); font-size:13px; margin-top:4px; }
        .rem-summary-stat{ background:rgba(255,255,255,0.14); border-radius:16px; padding:12px 20px; text-align:center; }
        .rem-summary-stat strong{ display:block; font-family:var(--font-head); font-size:22px; }
        .rem-summary-stat span{ font-size:11px; color:rgba(255,247,240,0.8); }
        .rem-notif-btn{
          display:inline-flex; align-items:center; gap:7px; background:rgba(255,255,255,0.95); color:var(--deep-violet);
          border:none; border-radius:100px; padding:9px 16px; font-family:var(--font-head); font-weight:600; font-size:12.5px;
        }
        .rem-add-btn{
          display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg,var(--primary-purple),#5D3FB5);
          color:#fff; border:none; border-radius:100px; padding:12px 20px; font-family:var(--font-head); font-weight:600;
          font-size:13.5px; box-shadow:var(--shadow-soft); transition:transform .18s ease;
        }
        .rem-add-btn:hover{ transform:translateY(-2px); }
        .rem-form{
          background:#fff; border-radius:20px; padding:22px 24px; box-shadow:var(--shadow-soft);
          display:grid; grid-template-columns:1fr 1fr; gap:14px;
        }
        .rem-form-row{ display:flex; flex-direction:column; gap:6px; }
        .rem-form-row.full{ grid-column:1 / -1; }
        .rem-form-row label{ font-size:12px; font-weight:600; color:var(--ink-soft); }
        .rem-form-row input, .rem-form-row select{
          border:1.5px solid var(--line); border-radius:12px; padding:10px 13px; font-size:14px; font-family:inherit; outline:none;
        }
        .rem-form-row input:focus, .rem-form-row select:focus{ border-color:var(--primary-purple); }
        .rem-form-actions{ grid-column:1 / -1; display:flex; gap:10px; justify-content:flex-end; }
        .rem-list{ display:flex; flex-direction:column; gap:14px; }
        .rem-card{
          background:#fff; border-radius:20px; padding:18px 22px; box-shadow:var(--shadow-soft);
          display:flex; align-items:center; gap:16px; transition:transform .18s ease;
        }
        .rem-card:hover{ transform:translateY(-2px); }
        .rem-card.taken{ opacity:0.65; }
        .rem-icon{
          width:46px; height:46px; border-radius:14px; background:var(--gradient-blush);
          display:flex; align-items:center; justify-content:center; color:var(--primary-purple); flex-shrink:0;
        }
        .rem-info{ flex:1; min-width:0; }
        .rem-info strong{ display:block; font-family:var(--font-head); font-size:14.5px; color:var(--deep-violet); }
        .rem-info span{ font-size:12px; color:var(--ink-soft); display:flex; align-items:center; gap:5px; margin-top:3px; flex-wrap:wrap; }
        .rem-check-btn{
          width:38px; height:38px; border-radius:50%; border:1.5px solid var(--line); background:#fff;
          display:flex; align-items:center; justify-content:center; color:var(--ink-soft); flex-shrink:0; transition:all .2s ease;
        }
        .rem-check-btn.done{ background:var(--mint); border-color:var(--mint); color:#fff; }
        .rem-delete-btn{
          width:34px; height:34px; border-radius:50%; border:none; background:none; color:var(--ink-soft);
          display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:color .18s ease;
        }
        .rem-delete-btn:hover{ color:#b23b4a; }
        .rem-empty{ text-align:center; padding:50px 20px; color:var(--ink-soft); }
        .rem-empty svg{ color:var(--lavender); margin-bottom:12px; }
        .rem-guest-note{ font-size:12px; color:var(--ink-soft); background:var(--gradient-blush); border-radius:14px; padding:10px 16px; }
      `}</style>

      <div className="rem-summary">
        <div className="rem-summary-text">
          <h2>Medication reminders</h2>
          <p>Never miss a dose — set a time and NARI will nudge you.</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="rem-summary-stat">
            <strong>{takenCount}/{reminders.length}</strong>
            <span>Taken today</span>
          </div>
          {notifPermission !== "granted" && notifPermission !== "unsupported" && (
            <button className="rem-notif-btn" onClick={requestNotifications}><Bell size={14} />Enable notifications</button>
          )}
        </div>
      </div>

      {isGuest && (
        <div className="rem-guest-note">You're in guest mode — reminders are saved on this device only. Sign in to sync them to your account.</div>
      )}

      {!showForm && (
        <button className="rem-add-btn" onClick={() => setShowForm(true)} style={{ alignSelf: "flex-start" }}>
          <Plus size={16} />Add medication reminder
        </button>
      )}

      {showForm && (
        <form className="rem-form" onSubmit={addReminder}>
          <div className="rem-form-row">
            <label>Medication name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Iron supplement" autoFocus />
          </div>
          <div className="rem-form-row">
            <label>Dose (optional)</label>
            <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 1 tablet, 500mg" />
          </div>
          <div className="rem-form-row">
            <label>Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="rem-form-row">
            <label>Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="rem-form-actions">
            <button type="button" className="qa-btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="rem-add-btn"><Plus size={15} />Save reminder</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted-sm">Loading reminders…</p>
      ) : reminders.length === 0 ? (
        <div className="rem-empty">
          <AlarmClock size={40} />
          <p>No reminders yet. Add your first medication above.</p>
        </div>
      ) : (
        <div className="rem-list">
          {reminders.map((r) => {
            const taken = !!r.log?.[today];
            return (
              <div className={`rem-card ${taken ? "taken" : ""}`} key={r.id}>
                <div className="rem-icon"><Pill size={20} /></div>
                <div className="rem-info">
                  <strong>{r.name}{r.dose ? ` · ${r.dose}` : ""}</strong>
                  <span><Clock size={12} />{r.time} · {r.frequency}</span>
                </div>
                <button
                  className={`rem-check-btn ${taken ? "done" : ""}`}
                  onClick={() => toggleTaken(r.id)}
                  title={taken ? "Taken today" : "Mark as taken"}
                >
                  <CheckCircle2 size={18} />
                </button>
                <button className="rem-delete-btn" onClick={() => removeReminder(r.id)} aria-label="Delete reminder">
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}