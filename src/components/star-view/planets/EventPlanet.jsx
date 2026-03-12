import React from "react";
import { Calendar } from "lucide-react";

export default function EventPlanet({ data, isActive, opacity = 1, scale = 1 }) {
  const nextEvent = data?.nextEvent;
  const birthday = data?.birthday;
  const display = nextEvent || birthday;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300"
      style={{
        width: `${60 * scale}px`,
        height: `${60 * scale}px`,
        opacity,
        borderColor: isActive ? "#a78bfa" : "#312e81",
        background: isActive
          ? "radial-gradient(circle, #2e1065 0%, #0f0a1a 100%)"
          : "radial-gradient(circle, #1e1b4b 0%, #0f0a1a 100%)",
        boxShadow: isActive ? "0 0 14px 4px rgba(167,139,250,0.25)" : "0 0 6px 2px rgba(167,139,250,0.06)",
      }}
    >
      {display ? (
        <div className="flex flex-col items-center" style={{ transform: `scale(${Math.min(scale, 1.1)})` }}>
          <Calendar className="w-3 h-3 text-violet-400 mb-0.5" />
          <span className="text-[8px] text-violet-200 font-semibold leading-tight text-center px-1 line-clamp-1">
            {display.title || "Birthday"}
          </span>
          <span className="text-[7px] text-violet-400">
            {formatDate(display.date)}
          </span>
        </div>
      ) : (
        <>
          <Calendar className="w-4 h-4 text-slate-600" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span className="text-[7px] text-slate-600 mt-0.5 text-center px-1 leading-tight">Nothing on the horizon</span>
        </>
      )}
    </div>
  );
}
