import React from "react";
import { Sparkles } from "lucide-react";

const INTEREST_COLORS = [
  { bg: "#7c3aed", border: "#a78bfa", text: "#ddd6fe" },
  { bg: "#0891b2", border: "#22d3ee", text: "#cffafe" },
  { bg: "#059669", border: "#34d399", text: "#a7f3d0" },
  { bg: "#d97706", border: "#fbbf24", text: "#fef3c7" },
  { bg: "#dc2626", border: "#f87171", text: "#fecaca" },
  { bg: "#7c3aed", border: "#c084fc", text: "#e9d5ff" },
];

export default function InterestPlanet({ data, isActive, opacity = 1, scale = 1, index = 0 }) {
  const interests = data?.interests || [];
  const colorScheme = INTEREST_COLORS[index % INTEREST_COLORS.length];
  const displayInterest = interests.length > 0 ? interests[0] : null;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300"
      style={{
        width: `${56 * scale}px`,
        height: `${56 * scale}px`,
        opacity,
        borderColor: isActive ? colorScheme.border : "#374151",
        background: isActive
          ? `radial-gradient(circle, ${colorScheme.bg}40 0%, #111827 100%)`
          : "radial-gradient(circle, #1f2937 0%, #111827 100%)",
        boxShadow: isActive ? `0 0 14px 3px ${colorScheme.border}30` : "none",
      }}
    >
      {displayInterest ? (
        <span
          className="text-[9px] font-semibold text-center leading-tight px-1.5 line-clamp-2"
          style={{ color: isActive ? colorScheme.text : "#9ca3af", transform: `scale(${Math.min(scale, 1.1)})` }}
        >
          {displayInterest}
        </span>
      ) : (
        <Sparkles className="w-3.5 h-3.5 text-slate-600" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
      )}
    </div>
  );
}
