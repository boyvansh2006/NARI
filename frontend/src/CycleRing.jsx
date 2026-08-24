import React from "react";

/** A ring of soft petals, one per logged cycle, sized by length.
 * Clean, clinical botanical visualization of menstrual cycle variance. */
export default function CycleRing({ lengths = [] }) {
  const size = 220, center = size / 2, maxR = 92, minR = 40;
  const max = Math.max(...lengths, 1);
  const colors = ["#0F5144", "#10B981", "#059669", "#E06D63", "#047857", "#34D399"];
  const darkFills = new Set(["#0F5144", "#047857", "#059669", "#E06D63"]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 240, display: "block", margin: "8px auto" }}>
      <circle cx={center} cy={center} r={maxR + 14} fill="#F0F7F4" />
      {lengths.map((len, i) => {
        const angle = (i / lengths.length) * 2 * Math.PI - Math.PI / 2;
        const r = minR + (len / max) * (maxR - minR);
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        const petalR = 16 + (len / max) * 10;
        const fill = colors[i % colors.length];
        const textColor = darkFills.has(fill) ? "#FFFFFF" : "#0F2922";
        return (
          <g key={i}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="#10B981" strokeWidth="1.5" opacity="0.3" />
            <circle cx={x} cy={y} r={petalR} fill={fill} opacity="0.9" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={textColor} fontFamily="'Plus Jakarta Sans', sans-serif">
              {len}
            </text>
          </g>
        );
      })}
      <circle cx={center} cy={center} r={26} fill="#0F5144" />
      <text x={center} y={center + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#E6F4F1" fontFamily="'Plus Jakarta Sans', sans-serif">
        cycles
      </text>
    </svg>
  );
}