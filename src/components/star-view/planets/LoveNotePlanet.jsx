import React from "react";
import { Heart } from "lucide-react";

export default function LoveNotePlanet({ data, isActive, opacity = 1, scale = 1 }) {
  const notes = data?.loveNotes || [];
  const hasNotes = notes.length > 0;
  const firstNote = hasNotes ? notes[0] : null;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300"
      style={{
        width: `${64 * scale}px`,
        height: `${64 * scale}px`,
        opacity,
        borderColor: isActive ? "#F472B6" : "#44403c",
        background: isActive
          ? "radial-gradient(circle, #4a1942 0%, #1c1917 100%)"
          : "radial-gradient(circle, #292524 0%, #1c1917 100%)",
        boxShadow: isActive ? "0 0 16px 4px rgba(244,114,182,0.3)" : "0 0 8px 2px rgba(244,114,182,0.08)",
      }}
    >
      {hasNotes ? (
        <>
          <Heart className="w-4 h-4 text-pink-400" fill="currentColor" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span
            className="text-[7px] text-pink-200 mt-0.5 text-center leading-tight px-2 line-clamp-2"
            style={{ transform: `scale(${Math.min(scale, 1.1)})` }}
          >
            {firstNote.content && firstNote.content.length > 30
              ? firstNote.content.slice(0, 27) + "…"
              : firstNote.content}
          </span>
        </>
      ) : (
        <>
          <Heart className="w-4 h-4 text-slate-600" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span className="text-[7px] text-slate-600 mt-0.5 leading-tight text-center px-1">No love notes yet</span>
        </>
      )}
    </div>
  );
}
