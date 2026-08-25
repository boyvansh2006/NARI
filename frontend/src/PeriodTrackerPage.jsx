import React, { useState, useEffect } from "react";
import {
  Droplets, Calendar, HeartPulse, ShieldCheck, Sparkles, Plus, Trash2,
  AlertCircle, CheckCircle2, ChevronRight, Info, Moon, Sun, Flame, Smile
} from "lucide-react";
import { fetchCycles, logCycle, deleteCycle, getCycleAnalytics } from "./api.js";

const FLOW_OPTIONS = [
  { id: "Spotting", label: "Spotting", color: "#F0ABFC", desc: "Very light trace" },
  { id: "Light", label: "Light Flow", color: "#F472B6", desc: "Minimal absorption" },
  { id: "Medium", label: "Medium Flow", color: "#E11D48", desc: "Normal regular flow" },
  { id: "Heavy", label: "Heavy Flow", color: "#9F1239", desc: "High absorption" },
];

const SYMPTOM_OPTIONS = [
  "Cramps", "Lower back ache", "Bloating", "Tender breasts",
  "Fatigue", "Headache", "Mood changes", "Acne", "Food cravings"
];

const DEFAULT_ANALYTICS = {
  current_day: 18,
  current_phase: "Luteal Phase",
  phase_description: "Progesterone rises to support the uterine lining. Your resting metabolic rate is slightly higher.",
  comfort_tip: "Focus on grounding meals rich in magnesium (pumpkin seeds, dark chocolate, spinach) and gentle restorative yoga.",
  avg_cycle_length: 28,
  avg_period_duration: 5,
  next_period_date: "2026-09-04",
  ovulation_date: "2026-08-20",
  fertile_window_start: "2026-08-15",
  fertile_window_end: "2026-08-21",
  total_logs: 3,
  regularity_score: "Regular",
};

export default function PeriodTrackerPage({ isGuest = false }) {
  const [cycles, setCycles] = useState([]);
  const [analytics, setAnalytics] = useState(DEFAULT_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);

  // Form State
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [flow, setFlow] = useState("Medium");
  const [painSeverity, setPainSeverity] = useState(3);
  const [selectedSymptoms, setSelectedSymptoms] = useState(["Cramps"]);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      if (!isGuest) {
        const [cData, aData] = await Promise.all([fetchCycles(), getCycleAnalytics()]);
        if (Array.isArray(cData)) setCycles(cData);
        if (aData) setAnalytics(aData);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isGuest]);

  const toggleSymptom = (sym) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!startDate) return;
    setSubmitting(true);
    setStatusMsg("");

    const payload = {
      start_date: startDate,
      end_date: endDate || null,
      flow,
      pain_severity: parseInt(painSeverity, 10),
      symptoms: selectedSymptoms.join(", "),
    };

    try {
      if (isGuest) {
        const guestEntry = {
          id: `guest-${Date.now()}`,
          ...payload,
          created_at: new Date().toISOString(),
        };
        setCycles((prev) => [guestEntry, ...prev]);
        setShowLogModal(false);
        setStatusMsg("Cycle entry logged in guest session");
      } else {
        await logCycle(payload);
        await loadData();
        setShowLogModal(false);
        setStatusMsg("Period logged securely to your private health twin");
      }
    } catch (err) {
      setStatusMsg("Failed to save entry. Please try again.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setStatusMsg(""), 3500);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this cycle entry?")) return;
    try {
      if (isGuest) {
        setCycles((prev) => prev.filter((c) => c.id !== id));
      } else {
        await deleteCycle(id);
        await loadData();
      }
      setStatusMsg("Entry removed");
      setTimeout(() => setStatusMsg(""), 2500);
    } catch {
      setStatusMsg("Unable to delete entry");
    }
  };

  const painLabel = (val) => {
    if (val === 0) return "No pain";
    if (val <= 3) return "Mild discomfort";
    if (val <= 6) return "Moderate cramps";
    if (val <= 8) return "Intense pain";
    return "Severe discomfort";
  };

  return (
    <div className="period-shell">
      <style>{`
        .period-shell{ display:flex; flex-direction:column; gap:24px; font-family:'Plus Jakarta Sans','DM Sans',sans-serif; }
        .period-shell *{ box-sizing:border-box; }
        
        .period-hero{
          background:linear-gradient(150deg, #02182E 0%, #022F56 60%, #234D6D 100%);
          border-radius:24px; padding:32px 34px; color:#fff; display:flex; justify-content:space-between;
          align-items:center; flex-wrap:wrap; gap:20px; box-shadow:0 4px 16px rgba(2,24,46,0.15);
        }
        .period-hero h1{ color:#fff; font-size:25px; font-weight:800; font-family:'Sora',sans-serif; margin:0 0 6px; }
        .period-hero p{ color:rgba(235,244,246,0.92); font-size:14px; margin:0; line-height:1.6; max-width:580px; }
        
        .period-actions{ display:flex; gap:12px; align-items:center; }
        .period-btn-add{
          display:inline-flex; align-items:center; gap:8px; background:#CCDEE4; color:#061D33;
          border:none; border-radius:999px; padding:12px 22px; font-weight:700; font-size:13.5px;
          cursor:pointer; transition:all .18s ease; font-family:'Sora',sans-serif;
          box-shadow:0 2px 8px rgba(0,0,0,0.1);
        }
        .period-btn-add:hover{ background:#fff; transform:translateY(-1px); }

        .security-badge-banner{
          background:#FFFFFF; border:1px solid #D5DFE2; border-radius:18px; padding:14px 20px;
          display:flex; align-items:center; gap:12px; font-size:12.5px; color:#1E2D3A; line-height:1.55;
          box-shadow:0 1px 3px rgba(0,0,0,0.02);
        }
        .security-badge-banner svg{ color:#022F56; flex-shrink:0; }

        /* Grid Layout */
        .period-grid{ display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .period-card{ background:#FFFFFF; border:1px solid #E0E8EA; border-radius:22px; padding:26px; box-shadow:0 1px 4px rgba(0,0,0,0.02); }
        .period-card-wide{ grid-column:1 / -1; }
        
        .period-card-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
        .period-card-head-left{ display:flex; align-items:center; gap:9px; color:#022F56; font-weight:700; font-family:'Sora',sans-serif; font-size:15px; }
        
        /* Phase Indicator */
        .phase-display{ display:flex; align-items:center; gap:20px; margin-bottom:20px; }
        .phase-day-ring{
          width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#CCDEE4 0%,#EDF3F5 100%);
          border:3px solid #022F56; display:flex; flex-direction:column; align-items:center; justify-content:center;
          color:#061D33; flex-shrink:0; text-align:center;
        }
        .phase-day-ring span:first-child{ font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#022F56; }
        .phase-day-ring strong{ font-size:22px; font-family:'Sora',sans-serif; font-weight:800; line-height:1.1; }
        .phase-info{ display:flex; flex-direction:column; gap:4px; }
        .phase-tag{
          display:inline-flex; align-items:center; gap:6px; background:#CCDEE4; color:#061D33;
          border-radius:999px; padding:4px 12px; font-size:12px; font-weight:700; width:max-content;
        }
        .phase-desc{ font-size:13px; color:#4E606D; line-height:1.55; margin:4px 0 0; }
        
        .comfort-tip-box{
          background:#EDF3F5; border-left:4px solid #022F56; border-radius:12px; padding:12px 16px;
          font-size:12.5px; color:#1E2D3A; line-height:1.6; display:flex; align-items:flex-start; gap:8px;
        }
        .comfort-tip-box svg{ color:#022F56; flex-shrink:0; margin-top:2px; }

        /* Metric Pill Rows */
        .period-metrics{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:16px; }
        .p-metric{ background:#FBFDFD; border:1px solid #E0E8EA; border-radius:16px; padding:14px; text-align:center; }
        .p-metric span{ font-size:11.5px; color:#4E606D; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }
        .p-metric strong{ display:block; font-size:17px; font-family:'Sora',sans-serif; font-weight:800; color:#0D1D2C; margin-top:4px; }

        /* Timeline / History */
        .cycle-list{ display:flex; flex-direction:column; gap:10px; }
        .cycle-row{
          display:flex; align-items:center; justify-content:space-between; padding:14px 18px;
          border:1px solid #E0E8EA; border-radius:16px; background:#FAFCFC; transition:all .18s ease;
        }
        .cycle-row:hover{ border-color:#022F56; background:#fff; }
        .cycle-row-left{ display:flex; align-items:center; gap:14px; }
        .cycle-dot{ width:12px; height:12px; border-radius:50%; background:#022F56; }
        .cycle-date-text strong{ display:block; font-size:14px; color:#0D1D2C; font-weight:700; }
        .cycle-date-text span{ font-size:12px; color:#4E606D; }
        .cycle-tags{ display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
        .c-tag{ font-size:11px; padding:2px 8px; border-radius:999px; background:#EDF3F5; color:#022F56; font-weight:600; }
        .c-flow-tag{ font-size:11px; padding:2px 8px; border-radius:999px; font-weight:700; background:#FFF1F2; color:#9F1239; }
        
        .cycle-del-btn{
          background:none; border:none; color:#9CA3AF; cursor:pointer; padding:6px;
          border-radius:8px; transition:all .15s ease;
        }
        .cycle-del-btn:hover{ color:#DC2626; background:#FEE2E2; }

        /* Modal */
        .modal-backdrop{
          position:fixed; inset:0; background:rgba(13,29,44,0.45); backdrop-filter:blur(4px);
          display:flex; align-items:center; justify-content:center; z-index:50; padding:20px;
        }
        .modal-card{
          background:#FFFFFF; border-radius:24px; padding:32px; width:100%; max-width:480px;
          box-shadow:0 16px 40px rgba(0,0,0,0.15); max-height:90vh; overflow-y:auto;
        }
        .modal-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .modal-head h2{ font-size:20px; font-weight:800; color:#0D1D2C; font-family:'Sora',sans-serif; margin:0; }
        .modal-close{ background:none; border:none; color:#4E606D; cursor:pointer; font-size:18px; font-weight:700; }
        
        .form-group{ margin-bottom:18px; }
        .form-group label{ display:block; font-size:13px; font-weight:700; color:#162736; margin-bottom:6px; }
        .form-input{
          width:100%; border:1.5px solid #D5DFE2; border-radius:12px; padding:11px 14px;
          font-size:14px; font-family:inherit; outline:none; background:#FBFDFD;
        }
        .form-input:focus{ border-color:#022F56; background:#fff; }

        .chip-grid{ display:flex; flex-wrap:wrap; gap:8px; }
        .flow-chip{
          border:1.5px solid #D5DFE2; background:#fff; border-radius:999px; padding:8px 16px;
          font-size:12.5px; font-weight:600; color:#1E2D3A; cursor:pointer; transition:all .18s ease;
        }
        .flow-chip.active{ background:#022F56; color:#fff; border-color:#022F56; }
        
        .symptom-chip{
          border:1px solid #D5DFE2; background:#FAFCFC; border-radius:999px; padding:6px 12px;
          font-size:12px; color:#4E606D; cursor:pointer; transition:all .15s ease;
        }
        .symptom-chip.active{ background:#CCDEE4; color:#061D33; border-color:#022F56; font-weight:700; }

        .range-slider{ width:100%; accent-color:#022F56; cursor:pointer; }
        
        .modal-actions{ display:flex; gap:10px; margin-top:24px; }
        .modal-btn-submit{
          flex:1; background:#022F56; color:#fff; border:none; border-radius:999px;
          padding:13px 0; font-weight:700; font-size:14px; cursor:pointer; transition:all .18s ease;
          font-family:'Sora',sans-serif;
        }
        .modal-btn-submit:hover{ background:#02182E; }
        .modal-btn-cancel{
          background:none; border:1px solid #D5DFE2; border-radius:999px; padding:13px 20px;
          font-weight:600; font-size:13.5px; color:#4E606D; cursor:pointer;
        }

        @media (max-width:768px){
          .period-grid{ grid-template-columns:1fr; }
          .period-metrics{ grid-template-columns:1fr; }
        }
      `}</style>

      {/* Hero Overview */}
      <section className="period-hero">
        <div>
          <h1>Menstrual &amp; Hormonal Cycle Tracker</h1>
          <p>
            Track period start dates, flow variations, and physical symptoms in a completely private and secure space.
            Your cycle data grounds NARI's clinical predictions.
          </p>
        </div>
        <div className="period-actions">
          <button className="period-btn-add" onClick={() => setShowLogModal(true)}>
            <Plus size={16} /> Log Period Entry
          </button>
        </div>
      </section>

      {/* Security Guarantee Banner */}
      <div className="security-badge-banner">
        <ShieldCheck size={20} />
        <div>
          <strong>End-to-End User Data Isolation</strong>
          <div>Your reproductive health records are encrypted and strictly bound to your authenticated account ID. Never shared with third parties or advertisers.</div>
        </div>
      </div>

      {statusMsg && (
        <div style={{ background: "#CCDEE4", color: "#061D33", padding: "12px 18px", borderRadius: "12px", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle2 size={16} /> {statusMsg}
        </div>
      )}

      {/* Analytics Grid */}
      <div className="period-grid">
        {/* Active Phase Card */}
        <div className="period-card">
          <div className="period-card-head">
            <div className="period-card-head-left"><HeartPulse size={17} /> Current Hormonal Phase</div>
            <span className="phase-tag">{analytics.current_phase}</span>
          </div>

          <div className="phase-display">
            <div className="phase-day-ring">
              <span>Day</span>
              <strong>{analytics.current_day}</strong>
            </div>
            <div className="phase-info">
              <div className="phase-tag">{analytics.current_phase}</div>
              <p className="phase-desc">{analytics.phase_description}</p>
            </div>
          </div>

          <div className="comfort-tip-box">
            <Sparkles size={16} />
            <div>
              <strong>Cycle Wellness Tip:</strong> {analytics.comfort_tip}
            </div>
          </div>
        </div>

        {/* Prediction Insights Card */}
        <div className="period-card">
          <div className="period-card-head">
            <div className="period-card-head-left"><Calendar size={17} /> Predictive Cycle Metrics</div>
            <span style={{ fontSize: "12px", color: "#4E606D", fontWeight: "600" }}>{analytics.regularity_score}</span>
          </div>

          <div className="period-metrics">
            <div className="p-metric">
              <span>Next Expected Period</span>
              <strong>{analytics.next_period_date ? String(analytics.next_period_date) : "Calculating…"}</strong>
            </div>
            <div className="p-metric">
              <span>Avg Cycle Length</span>
              <strong>{analytics.avg_cycle_length} Days</strong>
            </div>
            <div className="p-metric">
              <span>Avg Period Duration</span>
              <strong>{analytics.avg_period_duration} Days</strong>
            </div>
          </div>

          <div style={{ marginTop: "16px", padding: "12px 14px", background: "#FAFCFC", border: "1px solid #E0E8EA", borderRadius: "14px", fontSize: "12.5px", color: "#4E606D" }}>
            <strong>Fertile Window:</strong> {analytics.fertile_window_start ? `${analytics.fertile_window_start} to ${analytics.fertile_window_end}` : "Awaiting more cycle entries"}
          </div>
        </div>

        {/* Historical Logs List */}
        <div className="period-card period-card-wide">
          <div className="period-card-head">
            <div className="period-card-head-left"><Droplets size={17} /> Cycle History &amp; Recorded Logs</div>
            <span style={{ fontSize: "12.5px", color: "#4E606D" }}>{cycles.length} recorded cycles</span>
          </div>

          {cycles.length === 0 ? (
            <p style={{ color: "#4E606D", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
              No period entries logged yet. Click <strong>Log Period Entry</strong> above to record your first cycle date.
            </p>
          ) : (
            <div className="cycle-list">
              {cycles.map((c) => (
                <div key={c.id} className="cycle-row">
                  <div className="cycle-row-left">
                    <div className="cycle-dot" />
                    <div className="cycle-date-text">
                      <strong>Started: {c.start_date} {c.end_date ? `— Ended: ${c.end_date}` : ""}</strong>
                      <div className="cycle-tags">
                        {c.flow && <span className="c-flow-tag">{c.flow}</span>}
                        {c.pain_severity !== null && <span className="c-tag">Pain: {c.pain_severity}/10 ({painLabel(c.pain_severity)})</span>}
                        {c.symptoms && c.symptoms.split(",").map((s, i) => (
                          <span key={i} className="c-tag">{s.trim()}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button className="cycle-del-btn" onClick={() => handleDelete(c.id)} title="Delete log">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Period Modal */}
      {showLogModal && (
        <div className="modal-backdrop" onClick={() => setShowLogModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Log Period &amp; Cycle</h2>
              <button className="modal-close" onClick={() => setShowLogModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Period Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Period End Date (Optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Flow Intensity</label>
                <div className="chip-grid">
                  {FLOW_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      className={`flow-chip ${flow === opt.id ? "active" : ""}`}
                      onClick={() => setFlow(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Cramps &amp; Discomfort Level: {painSeverity}/10 ({painLabel(painSeverity)})</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={painSeverity}
                  onChange={(e) => setPainSeverity(e.target.value)}
                  className="range-slider"
                />
              </div>

              <div className="form-group">
                <label>Physical &amp; Mood Symptoms</label>
                <div className="chip-grid">
                  {SYMPTOM_OPTIONS.map((sym) => (
                    <button
                      type="button"
                      key={sym}
                      className={`symptom-chip ${selectedSymptoms.includes(sym) ? "active" : ""}`}
                      onClick={() => toggleSymptom(sym)}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="modal-btn-submit" disabled={submitting}>
                  {submitting ? "Saving Securely…" : "Save Cycle Entry"}
                </button>
                <button type="button" className="modal-btn-cancel" onClick={() => setShowLogModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
