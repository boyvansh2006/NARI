import React from "react";

const STATUS_COLOR = {
  HIGH: "#C74D4D",
  LOW: "#C27B2B",
  NORMAL: "#2A856A",
  UNSPECIFIED: "#8A9E96",
};

/** Material 3 rounded linear indicator for biomarker observation */
export default function LabReportChart({ metrics = [] }) {
  const numeric = metrics
    .map((m) => ({ ...m, num: parseFloat(m.value) }))
    .filter((m) => !Number.isNaN(m.num));

  if (numeric.length === 0) {
    return <p className="muted-sm">No numeric parameters available to chart for this report.</p>;
  }

  const max = Math.max(...numeric.map((m) => m.num), 1);

  return (
    <div className="lab-chart">
      <style>{`
        .lab-chart{ display:flex; flex-direction:column; gap:14px; margin:16px 0; }
        .lab-chart-row{ display:grid; grid-template-columns:160px 1fr 80px; align-items:center; gap:12px; }
        .lab-chart-label{ font-size:13px; color:#16362F; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .lab-chart-track{ background:#E8F0EC; border-radius:999px; height:10px; overflow:hidden; }
        .lab-chart-fill{ height:100%; border-radius:999px; transition: width .5s ease; }
        .lab-chart-value{ font-size:12px; font-weight:700; color:#0D2C24; text-align:right; font-variant-numeric: tabular-nums; }
        .lab-chart-legend{ display:flex; gap:18px; font-size:12px; color:#4E6D64; margin-top:6px; font-weight:500; }
        .lab-chart-legend span{ display:inline-flex; align-items:center; gap:6px; }
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
        <span><i className="legend-dot" style={{ background: STATUS_COLOR.NORMAL }} />Optimal</span>
        <span><i className="legend-dot" style={{ background: STATUS_COLOR.LOW }} />Lower than range</span>
        <span><i className="legend-dot" style={{ background: STATUS_COLOR.HIGH }} />Elevated</span>
      </div>
    </div>
  );
}