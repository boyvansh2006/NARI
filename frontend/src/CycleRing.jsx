import React from "react";

/** Soft botanical cycle ring with soothing Material 3 tonal styling */
export default function CycleRing({ lengths = [] }) {
  const size = 220, center = size / 2, maxR = 92, minR = 40;
  const max = Math.max(...lengths, 1);
  const colors = ["#1E5C4E", "#34A883", "#4D9A83", "#E07A6F", "#277564", "#52BA98"];
  const darkFills = new Set(["#1E5C4E", "#277564", "#34A883", "#E07A6F"]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 240, display: "block", margin: "8px auto" }}>
      <circle cx={center} cy={center} r={maxR + 14} fill="#EDF5F1" />
      {lengths.map((len, i) => {
        const angle = (i / lengths.length) * 2 * Math.PI - Math.PI / 2;
        const r = minR + (len / max) * (maxR - minR);
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        const petalR = 16 + (len / max) * 10;
        const fill = colors[i % colors.length];
        const textColor = darkFills.has(fill) ? "#FFFFFF" : "#0D2C24";
        return (
          <g key={i}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="#34A883" strokeWidth="1.5" opacity="0.22" />
            <circle cx={x} cy={y} r={petalR} fill={fill} opacity="0.92" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={textColor} fontFamily="'Plus Jakarta Sans', sans-serif">
              {len}
            </text>
          </g>
        );
      })}
      <circle cx={center} cy={center} r={26} fill="#1E5C4E" />
      <text x={center} y={center + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#E8F4F0" fontFamily="'Plus Jakarta Sans', sans-serif">
        cycles
      </text>
    </svg>
  );
}