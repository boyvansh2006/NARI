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
        .reminders-shell{ display:flex; flex-direction:column; gap:20px; }
        .rem-summary{
          background:linear-gradient(140deg, #0A3B31 0%, #0F5144 100%); color:#fff; border-radius:20px; padding:24px 28px;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; box-shadow:var(--shadow-card);
        }
        .rem-summary-text h2{ color:#fff; font-size:19px; }
        .rem-summary-text p{ color:rgba(230,244,241,0.85); font-size:13px; margin-top:4px; }
        .rem-summary-stat{ background:rgba(255,255,255,0.12); border-radius:14px; padding:10px 18px; text-align:center; border:1px solid rgba(255,255,255,0.18); }
        .rem-summary-stat strong{ display:block; font-family:var(--font-head); font-size:22px; color:#fff; }
        .rem-summary-stat span{ font-size:11px; color:rgba(230,244,241,0.8); }
        .rem-notif-btn{
          display:inline-flex; align-items:center; gap:7px; background:#fff; color:#0F5144;
          border:none; border-radius:100px; padding:8px 15px; font-family:var(--font-head); font-weight:700; font-size:12px; cursor:pointer;
        }
        .rem-add-btn{
          display:inline-flex; align-items:center; gap:8px; background:#0F5144;
          color:#fff; border:none; border-radius:12px; padding:11px 18px; font-family:var(--font-head); font-weight:700;
          font-size:13px; transition:all .18s ease; cursor:pointer;
        }
        .rem-add-btn:hover{ background:#0A3B31; transform:translateY(-1px); box-shadow:0 4px 12px rgba(15,81,68,0.2); }
        .rem-form{
          background:#fff; border-radius:18px; padding:22px 24px; box-shadow:var(--shadow-card);
          border:1px solid #E2EBE7; display:grid; grid-template-columns:1fr 1fr; gap:14px;
        }
        .rem-form-row{ display:flex; flex-direction:column; gap:6px; }
        .rem-form-row.full{ grid-column:1 / -1; }
        .rem-form-row label{ font-size:12px; font-weight:600; color:#1E3A34; }
        .rem-form-row input, .rem-form-row select{
          border:1.5px solid #E2E8F0; border-radius:10px; padding:9px 12px; font-size:13.5px; font-family:inherit; outline:none;
        }
        .rem-form-row input:focus, .rem-form-row select:focus{ border-color:#0F5144; }
        .rem-form-actions{ grid-column:1 / -1; display:flex; gap:10px; justify-content:flex-end; }
        .rem-cancel-btn{
          background:#FAFCFB; border:1px solid #CBD5E1; color:#527068; border-radius:10px; padding:9px 16px;
          font-family:var(--font-head); font-weight:700; font-size:13px; cursor:pointer;
        }
        .rem-list{ display:flex; flex-direction:column; gap:12px; }
        .rem-card{
          background:#fff; border-radius:16px; padding:16px 20px; box-shadow:var(--shadow-card);
          border:1px solid #E2EBE7; display:flex; align-items:center; gap:14px; transition:all .18s ease;
        }
        .rem-card:hover{ border-color:#10B981; transform:translateY(-1px); }
        .rem-card.taken{ opacity:0.65; background:#FAFCFB; }
        .rem-icon{
          width:42px; height:42px; border-radius:12px; background:#E6F4F1;
          display:flex; align-items:center; justify-content:center; color:#0F5144; flex-shrink:0;
        }
        .rem-info{ flex:1; min-width:0; }
        .rem-info strong{ display:block; font-family:var(--font-head); font-size:14px; color:#0F2922; }
        .rem-info span{ font-size:12px; color:#527068; display:flex; align-items:center; gap:5px; margin-top:2px; flex-wrap:wrap; }
        .rem-check-btn{
          width:36px; height:36px; border-radius:50%; border:1.5px solid #CBD5E1; background:#fff;
          display:flex; align-items:center; justify-content:center; color:#83A69C; flex-shrink:0; transition:all .2s ease; cursor:pointer;
        }
        .rem-check-btn.done{ background:#059669; border-color:#059669; color:#fff; }
        .rem-delete-btn{
          width:32px; height:32px; border-radius:50%; border:none; background:none; color:#94A3B8;
          display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:color .18s ease; cursor:pointer;
        }
        .rem-delete-btn:hover{ color:#DC2626; background:#FEF2F2; }
        .rem-empty{ text-align:center; padding:48px 20px; color:#527068; }
        .rem-empty svg{ color:#83A69C; margin-bottom:12px; }
        .rem-guest-note{ font-size:12px; color:#527068; background:#E6F4F1; border-radius:12px; padding:10px 16px; border:1px solid #D1FAE5; }
      `}</style>

      <div className="rem-summary">
        <div className="rem-summary-text">
          <h2>Medication &amp; Prescription Reminders</h2>
          <p>Automated alerts and interaction safety monitoring across your routine.</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="rem-summary-stat">
            <strong>{takenCount}/{reminders.length}</strong>
            <span>Taken today</span>
          </div>
          {notifPermission !== "granted" && notifPermission !== "unsupported" && (
            <button className="rem-notif-btn" onClick={requestNotifications}><Bell size={13} />Enable browser alerts</button>
          )}
        </div>
      </div>

      {isGuest && (
        <div className="rem-guest-note">
          You are in guest mode — reminders are saved locally in your browser. Sign in to synchronize them to your profile.
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
            <label>Medication name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ferrous sulfate (Iron)" autoFocus required />
          </div>
          <div className="rem-form-row">
            <label>Dose (optional)</label>
            <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 1 tablet, 200mg" />
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
          <AlarmClock size={36} />
          <p>No medication reminders configured. Add your first prescription above.</p>
        </div>
      ) : (
        <div className="rem-list">
          {reminders.map((r) => {
            const taken = !!r.log?.[today];
            return (
              <div className={`rem-card ${taken ? "taken" : ""}`} key={r.id}>
                <div className="rem-icon"><Pill size={18} /></div>
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