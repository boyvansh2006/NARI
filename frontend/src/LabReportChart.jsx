import React from "react";

const STATUS_COLOR = { HIGH: "#F5A6C2", LOW: "#F6C453", NORMAL: "#8FD6C4", UNSPECIFIED: "#C9B8EA" };

/** Renders a horizontal bar per biomarker, colored by status, with the
 * numeric value labeled. Purely illustrative (not to clinical scale —
 * reference ranges differ per biomarker), designed to give an at-a-glance
 * "how many things are flagged" view next to the numeric table. */
export default function LabReportChart({ metrics = [] }) {
  const numeric = metrics
    .map((m) => ({ ...m, num: parseFloat(m.value) }))
    .filter((m) => !Number.isNaN(m.num));

  if (numeric.length === 0) {
    return <p className="muted-sm">No numeric values available to chart for this report.</p>;
  }

  const max = Math.max(...numeric.map((m) => m.num), 1);

  return (
    <div className="lab-chart">
      <style>{`
        .lab-chart{ display:flex; flex-direction:column; gap:12px; margin:16px 0; }
        .lab-chart-row{ display:grid; grid-template-columns:150px 1fr 70px; align-items:center; gap:10px; }
        .lab-chart-label{ font-size:12.5px; color:var(--ink-soft,#6B5A8E); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .lab-chart-track{ background:#F0E9FF; border-radius:8px; height:14px; overflow:hidden; }
        .lab-chart-fill{ height:100%; border-radius:8px; transition: width .6s cubic-bezier(.2,.8,.2,1); }
        .lab-chart-value{ font-size:12px; font-weight:700; color:var(--deep-violet,#3B2159); text-align:right; }
        .lab-chart-legend{ display:flex; gap:14px; font-size:11px; color:var(--ink-soft,#6B5A8E); margin-top:2px; }
        .lab-chart-legend span{ display:inline-flex; align-items:center; gap:5px; }
        .legend-dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
      `}</style>

      {numeric.map((m, i) => (
        <div className="lab-chart-row" key={`${m.biomarker_name}-${i}`}>
          <div className="lab-chart-label" title={m.biomarker_name}>{m.biomarker_name}</div>
          <div className="lab-chart-track">
            <div
              className="lab-chart-fill"
              style={{
                width: `${Math.max(4, (m.num / max) * 100)}%`,
                background: STATUS_COLOR[m.status] || STATUS_COLOR.UNSPECIFIED,
              }}
            />
          </div>
          <div className="lab-chart-value">{m.value}{m.unit ? ` ${m.unit}` : ""}</div>
        </div>
      ))}

      <div className="lab-chart-legend">
        <span><i className="legend-dot" style={{ background: STATUS_COLOR.HIGH }} />High</span>
        <span><i className="legend-dot" style={{ background: STATUS_COLOR.LOW }} />Low</span>
        <span><i className="legend-dot" style={{ background: STATUS_COLOR.NORMAL }} />Normal</span>
      </div>
    </div>
  );
}