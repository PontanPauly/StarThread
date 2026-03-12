import React from "react";
import { Flame } from "lucide-react";

export default function EssencePlanet({ data, isActive, opacity = 1, scale = 1 }) {
  const essence = data?.essence;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300"
      style={{
        width: `${64 * scale}px`,
        height: `${64 * scale}px`,
        opacity,
        borderColor: isActive ? "#FBBF24" : "#44403c",
        background: isActive
          ? "radial-gradient(circle, #451a03 0%, #1c1917 100%)"
          : "radial-gradient(circle, #292524 0%, #1c1917 100%)",
        boxShadow: isActive ? "0 0 16px 4px rgba(251,191,36,0.3)" : "0 0 8px 2px rgba(251,191,36,0.08)",
      }}
    >
      {essence ? (
        <span
          className="text-[8px] text-amber-200 text-center leading-tight px-2 line-clamp-3 font-medium"
          style={{ transform: `scale(${Math.min(scale, 1.1)})` }}
        >
          {essence.length > 40 ? essence.slice(0, 37) + "…" : essence}
        </span>
      ) : (
        <>
          <Flame className="w-4 h-4 text-slate-600" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span className="text-[7px] text-slate-600 mt-0.5 leading-tight text-center px-1">Still forming</span>
        </>
      )}
    </div>
  );
}
