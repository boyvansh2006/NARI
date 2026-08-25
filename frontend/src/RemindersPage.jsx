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
    /* ignore */
  }
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

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
      const next = [...reminders, { id: `local-${Date.now()}`, ...payload, log: {} }];
      setReminders(next);
      saveLocal(next);
      setName(""); setDose(""); setShowForm(false);
      return;
    }

    try {
      const created = await createReminderApi(payload);
      setReminders((prev) => [...prev, normalize(created.reminder || created)]);
      setName(""); setDose(""); setShowForm(false);
      if (created.warnings && created.warnings.length > 0) {
        alert(created.warnings.join("\n"));
      }
    } catch (err) {
      alert(err.message || "Failed to create reminder");
    }
  };

  const toggleTaken = async (id) => {
    const today = todayKey();
    const current = reminders.find((r) => r.id === id);
    if (!current) return;
    const nextTaken = !current.log?.[today];

    const updatedList = reminders.map((r) =>
      r.id === id ? { ...r, log: { ...r.log, [today]: nextTaken } } : r
    );
    setReminders(updatedList);

    if (isGuest) {
      saveLocal(updatedList);
      if (nextTaken && onTaken) onTaken(current.name);
      return;
    }

    try {
      await toggleReminderApi(id, today, nextTaken);
      if (nextTaken && onTaken) onTaken(current.name);
    } catch {
      /* optimistic update kept */
    }
  };

  const removeReminder = async (id) => {
    const updated = reminders.filter((r) => r.id !== id);
    setReminders(updated);
    if (isGuest) {
      saveLocal(updated);
    } else {
      try {
        await deleteReminderApi(id);
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
        .reminders-shell{ display:flex; flex-direction:column; gap:22px; font-family:'Plus Jakarta Sans','DM Sans',sans-serif; }
        .rem-summary{
          background:linear-gradient(150deg, #02182E 0%, #022F56 100%); color:#fff; border-radius:24px; padding:26px 30px;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; box-shadow:0 4px 18px rgba(2,47,86,0.12);
        }
        .rem-summary-text h2{ color:#fff; font-size:20px; font-weight:700; margin:0; }
        .rem-summary-text p{ color:rgba(235,244,246,0.9); font-size:13.5px; margin:4px 0 0; }
        .rem-summary-stat{ background:rgba(255,255,255,0.12); border-radius:18px; padding:12px 20px; text-align:center; border:1px solid rgba(255,255,255,0.2); }
        .rem-summary-stat strong{ display:block; font-size:24px; color:#fff; font-weight:800; }
        .rem-summary-stat span{ font-size:11.5px; color:rgba(235,244,246,0.85); font-weight:500; }
        .rem-notif-btn{
          display:inline-flex; align-items:center; gap:7px; background:#fff; color:#022F56;
          border:none; border-radius:999px; padding:8px 16px; font-weight:700; font-size:12.5px; cursor:pointer;
          box-shadow:0 2px 8px rgba(0,0,0,0.08); transition:all .18s ease;
        }
        .rem-notif-btn:hover{ transform:translateY(-1px); }
        
        .rem-add-btn{
          display:inline-flex; align-items:center; gap:8px; background:#022F56;
          color:#fff; border:none; border-radius:999px; padding:12px 22px; font-weight:700;
          font-size:13.5px; transition:all .18s ease; cursor:pointer; box-shadow:0 2px 10px rgba(2,47,86,0.18);
        }
        .rem-add-btn:hover{ background:#02182E; transform:translateY(-1px); box-shadow:0 4px 14px rgba(2,47,86,0.25); }
        
        .rem-form{
          background:#fff; border-radius:20px; padding:24px; box-shadow:0 2px 10px rgba(0,0,0,0.04);
          border:1px solid #E0E8EA; display:grid; grid-template-columns:1fr 1fr; gap:16px;
          animation:remFormIn .22s ease;
        }
        @keyframes remFormIn{ from{ opacity:0; transform:translateY(-6px); } to{ opacity:1; transform:translateY(0); } }
        .rem-form-row{ display:flex; flex-direction:column; gap:6px; }
        .rem-form-row.full{ grid-column:1 / -1; }
        .rem-form-row label{ font-size:12.5px; font-weight:600; color:#162736; }
        .rem-form-row input, .rem-form-row select{
          border:1.5px solid #D5DFE2; border-radius:12px; padding:10px 14px; font-size:13.5px; font-family:inherit; outline:none;
          background:#FBFDFD;
        }
        .rem-form-row input:focus, .rem-form-row select:focus{ border-color:#022F56; background:#fff; box-shadow:0 0 0 3px rgba(2,47,86,0.1); }
        .rem-form-actions{ grid-column:1 / -1; display:flex; gap:10px; justify-content:flex-end; }
        .rem-cancel-btn{
          background:#F4F7F8; border:1.5px solid #D5DFE2; color:#4E606D; border-radius:999px; padding:10px 18px;
          font-weight:700; font-size:13px; cursor:pointer;
        }
        .rem-cancel-btn:hover{ background:#EDF3F5; }
        
        .rem-list{ display:flex; flex-direction:column; gap:12px; }
        .rem-card{
          background:#fff; border-radius:18px; padding:18px 22px; box-shadow:0 1px 3px rgba(0,0,0,0.03);
          border:1px solid #E0E8EA; display:flex; align-items:center; gap:16px; transition:all .18s ease;
        }
        .rem-card:hover{ border-color:#347BA8; transform:translateY(-1px); box-shadow:0 4px 14px rgba(2,47,86,0.06); }
        .rem-card.taken{ opacity:0.68; background:#F8FAFA; }
        .rem-icon{
          width:44px; height:44px; border-radius:14px; background:#CCDEE4;
          display:flex; align-items:center; justify-content:center; color:#061D33; flex-shrink:0;
        }
        .rem-info{ flex:1; min-width:0; }
        .rem-info strong{ display:block; font-size:14.5px; color:#0D1D2C; font-weight:700; }
        .rem-info span{ font-size:12.5px; color:#4E606D; display:flex; align-items:center; gap:5px; margin-top:2px; flex-wrap:wrap; }
        
        .rem-check-btn{
          width:38px; height:38px; border-radius:50%; border:1.5px solid #CBD5E1; background:#fff;
          display:flex; align-items:center; justify-content:center; color:#022F56; flex-shrink:0; transition:all .2s ease; cursor:pointer;
        }
        .rem-check-btn.done{ background:#2A5F85; border-color:#2A5F85; color:#fff; }
        .rem-check-btn:hover{ border-color:#2A5F85; transform:translateY(-1px); }
        .rem-delete-btn{
          width:34px; height:34px; border-radius:50%; border:none; background:none; color:#4E606D;
          display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:color .18s ease; cursor:pointer;
        }
        .rem-delete-btn:hover{ color:#C74D4D; background:#FEF2F2; }
        .rem-empty{ text-align:center; padding:52px 20px; color:#4E606D; }
        .rem-empty svg{ color:#748C99; margin-bottom:12px; }
        .rem-guest-note{ font-size:12.5px; color:#4E606D; background:#CCDEE4; border-radius:16px; padding:12px 18px; border:1px solid #C0D7DF; line-height:1.5; }

        .reminders-shell button:active{ transform:scale(0.96); }
        .reminders-shell button, .reminders-shell input, .reminders-shell select{ font-family:inherit; }
        .reminders-shell *:focus-visible{ outline:2px solid #022F56; outline-offset:2px; border-radius:6px; }

        @media (max-width:640px){
          .rem-summary{ padding:22px 20px; border-radius:20px; }
          .rem-summary-text h2{ font-size:17px; }
          .rem-summary-stat{ padding:10px 16px; }
          .rem-form{ grid-template-columns:1fr; padding:20px; }
          .rem-form-actions{ flex-direction:column-reverse; }
          .rem-form-actions button{ width:100%; justify-content:center; }
          .rem-card{ padding:16px; gap:12px; flex-wrap:wrap; }
          .rem-info{ min-width:140px; }
        }

        @media (max-width:400px){
          .rem-summary{ flex-direction:column; align-items:flex-start; }
          .rem-summary > div:last-child{ width:100%; justify-content:space-between; }
        }
      `}</style>

      <div className="rem-summary">
        <div className="rem-summary-text">
          <h2>Medication &amp; Prescription Reminders</h2>
          <p>Gentle reminders and safety checks across your daily routine.</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="rem-summary-stat">
            <strong>{takenCount}/{reminders.length}</strong>
            <span>Taken today</span>
          </div>
          {notifPermission !== "granted" && notifPermission !== "unsupported" && (
            <button className="rem-notif-btn" onClick={requestNotifications}><Bell size={13} />Enable reminders</button>
          )}
        </div>
      </div>

      {isGuest && (
        <div className="rem-guest-note">
          You are currently in guest mode — your reminders are saved locally in your browser.
        </div>
      )}

      {!showForm && (
        <button className="rem-add-btn" onClick={() => setShowForm(true)} style={{ alignSelf: "flex-start" }}>
          <Plus size={15} /> Add medication reminder
        </button>
      )}

      {showForm && (
        <form className="rem-form" onSubmit={addReminder}>
          <div className="rem-form-row">
            <label>Medication or Supplement Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Iron (Ferrous sulfate), Vitamin D" autoFocus required />
          </div>
          <div className="rem-form-row">
            <label>Dosage (optional)</label>
            <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 1 capsule with food" />
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
            <button type="button" className="rem-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="rem-add-btn"><Plus size={14} />Save reminder</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted-sm">Loading reminders…</p>
      ) : reminders.length === 0 ? (
        <div className="rem-empty">
          <AlarmClock size={38} />
          <p>No reminders configured yet. Add your daily vitamins or prescriptions above.</p>
        </div>
      ) : (
        <div className="rem-list">
          {reminders.map((r) => {
            const taken = !!r.log?.[today];
            return (
              <div className={`rem-card ${taken ? "taken" : ""}`} key={r.id}>
                <div className="rem-icon"><Pill size={19} /></div>
                <div className="rem-info">
                  <strong>{r.name}{r.dose ? ` · ${r.dose}` : ""}</strong>
                  <span><Clock size={12} />{r.time} · {r.frequency}</span>
                </div>
                <button
                  className={`rem-check-btn ${taken ? "done" : ""}`}
                  onClick={() => toggleTaken(r.id)}
                  title={taken ? "Taken today" : "Mark as taken"}
                >
                  <CheckCircle2 size={19} />
                </button>
                <button className="rem-delete-btn" onClick={() => removeReminder(r.id)} aria-label="Delete reminder">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}