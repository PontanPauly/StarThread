import React from "react";
import { Compass } from "lucide-react";

export default function TripPlanet({ data, isActive, opacity = 1, scale = 1 }) {
  const trips = data?.trips || [];
  const hasTrips = trips.length > 0;
  const firstTrip = hasTrips ? trips[0] : null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300"
      style={{
        width: `${64 * scale}px`,
        height: `${64 * scale}px`,
        opacity,
        borderColor: isActive ? "#34D399" : "#44403c",
        background: isActive
          ? "radial-gradient(circle, #064e3b 0%, #1c1917 100%)"
          : "radial-gradient(circle, #292524 0%, #1c1917 100%)",
        boxShadow: isActive ? "0 0 16px 4px rgba(52,211,153,0.3)" : "0 0 8px 2px rgba(52,211,153,0.08)",
      }}
    >
      {hasTrips ? (
        <>
          <Compass className="w-4 h-4 text-emerald-400" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span
            className="text-[7px] text-emerald-200 mt-0.5 text-center leading-tight px-2 line-clamp-2"
            style={{ transform: `scale(${Math.min(scale, 1.1)})` }}
          >
            {firstTrip.name && firstTrip.name.length > 25
              ? firstTrip.name.slice(0, 22) + "…"
              : firstTrip.name}
            {firstTrip.start_date && (
              <span className="block text-[6px] text-emerald-300/70">{formatDate(firstTrip.start_date)}</span>
            )}
          </span>
        </>
      ) : (
        <>
          <Compass className="w-4 h-4 text-slate-600" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span className="text-[7px] text-slate-600 mt-0.5 leading-tight text-center px-1">No adventures yet</span>
        </>
      )}
    </div>
  );
}
