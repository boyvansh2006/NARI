import React from "react";

/** A ring of soft petals, one per logged cycle, sized by length. More
 * "bloom"-appropriate than a bar chart for cycle-length visualization. */
export default function CycleRing({ lengths = [] }) {
  const size = 220, center = size / 2, maxR = 92, minR = 40;
  const max = Math.max(...lengths, 1);
  const colors = ["#694CD0", "#E7A1A8", "#3F8F87", "#34205F", "#E1C3FF", "#F4CE45"];
  const darkFills = new Set(["#694CD0", "#34205F", "#3F8F87"]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 240, display: "block", margin: "8px auto" }}>
      <circle cx={center} cy={center} r={maxR + 14} fill="#FFF9EF" />
      {lengths.map((len, i) => {
        const angle = (i / lengths.length) * 2 * Math.PI - Math.PI / 2;
        const r = minR + (len / max) * (maxR - minR);
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        const petalR = 16 + (len / max) * 10;
        const fill = colors[i % colors.length];
        const textColor = darkFills.has(fill) ? "#FFF9EF" : "#34205F";
        return (
          <g key={i}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="#E1C3FF" strokeWidth="1.5" opacity="0.5" />
            <circle cx={x} cy={y} r={petalR} fill={fill} opacity="0.88" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={textColor} fontFamily="Sora, sans-serif">
              {len}
            </text>
          </g>
        );
      })}
      <circle cx={center} cy={center} r={26} fill="#694CD0" />
      <text x={center} y={center + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="Sora, sans-serif">
        cycles
      </text>
    </svg>
  );
}