import React from "react";
import { BookOpen } from "lucide-react";

export default function StoryPlanet({ data, isActive, opacity = 1, scale = 1 }) {
  const stories = data?.stories || [];
  const hasStories = stories.length > 0;
  const firstStory = hasStories ? stories[0] : null;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300"
      style={{
        width: `${64 * scale}px`,
        height: `${64 * scale}px`,
        opacity,
        borderColor: isActive ? "#A78BFA" : "#44403c",
        background: isActive
          ? "radial-gradient(circle, #2e1065 0%, #1c1917 100%)"
          : "radial-gradient(circle, #292524 0%, #1c1917 100%)",
        boxShadow: isActive ? "0 0 16px 4px rgba(167,139,250,0.3)" : "0 0 8px 2px rgba(167,139,250,0.08)",
      }}
    >
      {hasStories ? (
        <>
          <BookOpen className="w-4 h-4 text-violet-400" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span
            className="text-[7px] text-violet-200 mt-0.5 text-center leading-tight px-2 line-clamp-2"
            style={{ transform: `scale(${Math.min(scale, 1.1)})` }}
          >
            {firstStory.title && firstStory.title.length > 30
              ? firstStory.title.slice(0, 27) + "…"
              : firstStory.title}
          </span>
        </>
      ) : (
        <>
          <BookOpen className="w-4 h-4 text-slate-600" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span className="text-[7px] text-slate-600 mt-0.5 leading-tight text-center px-1">No stories told yet</span>
        </>
      )}
    </div>
  );
}
