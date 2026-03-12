import React from "react";
import { Camera } from "lucide-react";

export default function MomentPlanet({ data, isActive, opacity = 1, scale = 1 }) {
  const moments = data?.moments || [];
  const hasMoments = moments.length > 0;
  const firstPhoto = hasMoments
    ? moments.find((m) => m.media_urls && m.media_urls.length > 0)
    : null;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border-2 overflow-hidden transition-all duration-300"
      style={{
        width: `${64 * scale}px`,
        height: `${64 * scale}px`,
        opacity,
        borderColor: isActive ? "#60A5FA" : "#334155",
        background: isActive
          ? "radial-gradient(circle, #1e3a5f 0%, #0f172a 100%)"
          : "radial-gradient(circle, #1e293b 0%, #0f172a 100%)",
        boxShadow: isActive ? "0 0 16px 4px rgba(96,165,250,0.3)" : "0 0 8px 2px rgba(96,165,250,0.1)",
      }}
    >
      {firstPhoto ? (
        <img
          src={firstPhoto.media_urls[0]}
          alt=""
          className="w-full h-full object-cover"
          style={{ borderRadius: "50%" }}
        />
      ) : hasMoments ? (
        <>
          <Camera className="w-4 h-4 text-blue-400" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span className="text-[8px] text-blue-300 mt-0.5 font-medium">{moments.length}</span>
        </>
      ) : (
        <>
          <Camera className="w-4 h-4 text-slate-600" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span className="text-[7px] text-slate-600 mt-0.5 leading-tight text-center px-1">No moments yet</span>
        </>
      )}
    </div>
  );
}
