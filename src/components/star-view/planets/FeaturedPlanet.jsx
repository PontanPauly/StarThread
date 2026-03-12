import React from "react";
import { Star } from "lucide-react";

export default function FeaturedPlanet({ data, isActive, opacity = 1, scale = 1 }) {
  const featured = data?.featured;
  const hasPhoto = featured?.media_urls && featured.media_urls.length > 0;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300 overflow-hidden"
      style={{
        width: `${62 * scale}px`,
        height: `${62 * scale}px`,
        opacity,
        borderColor: isActive ? "#f59e0b" : "#78350f",
        background: isActive
          ? "radial-gradient(circle, #451a03 0%, #1c1917 100%)"
          : "radial-gradient(circle, #292524 0%, #1c1917 100%)",
        boxShadow: isActive ? "0 0 16px 4px rgba(245,158,11,0.3)" : "0 0 6px 2px rgba(245,158,11,0.06)",
      }}
    >
      {featured ? (
        hasPhoto ? (
          <img
            src={featured.media_urls[0]}
            alt=""
            className="w-full h-full object-cover"
            style={{ borderRadius: "50%" }}
          />
        ) : (
          <div className="flex flex-col items-center" style={{ transform: `scale(${Math.min(scale, 1.1)})` }}>
            <Star className="w-3 h-3 text-amber-400 mb-0.5 fill-amber-400" />
            <span className="text-[8px] text-amber-200 text-center leading-tight px-1.5 line-clamp-2 font-medium">
              {featured.content
                ? featured.content.length > 30
                  ? featured.content.slice(0, 27) + "…"
                  : featured.content
                : "Featured"}
            </span>
          </div>
        )
      ) : (
        <>
          <Star className="w-4 h-4 text-slate-600" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span className="text-[7px] text-slate-600 mt-0.5 text-center px-1 leading-tight">No feature</span>
        </>
      )}
    </div>
  );
}
