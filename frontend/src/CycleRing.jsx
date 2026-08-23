import React from "react";

/** A ring of soft petals, one per logged cycle, sized by length. More
 * "bloom"-appropriate than a bar chart for cycle-length visualization. */
export default function CycleRing({ lengths = [] }) {
  const size = 220, center = size / 2, maxR = 92, minR = 40;
  const max = Math.max(...lengths, 1);
  const colors = ["#F5A6C2", "#E7CFFF", "#8FD6C4", "#F6C453", "#7C5CD6", "#FFB6C7"];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 240, display: "block", margin: "8px auto" }}>
      <circle cx={center} cy={center} r={maxR + 14} fill="#FFF7F0" />
      {lengths.map((len, i) => {
        const angle = (i / lengths.length) * 2 * Math.PI - Math.PI / 2;
        const r = minR + (len / max) * (maxR - minR);
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        const petalR = 16 + (len / max) * 10;
        return (
          <g key={i}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="#E7CFFF" strokeWidth="1.5" opacity="0.5" />
            <circle cx={x} cy={y} r={petalR} fill={colors[i % colors.length]} opacity="0.88" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#3B2159" fontFamily="Plus Jakarta Sans, sans-serif">
              {len}
            </text>
          </g>
        );
      })}
      <circle cx={center} cy={center} r={26} fill="#7C5CD6" />
      <text x={center} y={center + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="Plus Jakarta Sans, sans-serif">
        cycles
      </text>
    </svg>
  );
}