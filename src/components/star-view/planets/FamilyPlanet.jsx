import React from "react";
import { Users } from "lucide-react";

export default function FamilyPlanet({ data, isActive, opacity = 1, scale = 1 }) {
  const familyMembers = data?.familyMembers || [];
  const hasFam = familyMembers.length > 0;
  const displayMembers = familyMembers.slice(0, 4);

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300"
      style={{
        width: `${68 * scale}px`,
        height: `${68 * scale}px`,
        opacity,
        borderColor: isActive ? "#34d399" : "#1f3d2f",
        background: isActive
          ? "radial-gradient(circle, #064e3b 0%, #0f172a 100%)"
          : "radial-gradient(circle, #1e293b 0%, #0f172a 100%)",
        boxShadow: isActive ? "0 0 16px 4px rgba(52,211,153,0.25)" : "0 0 6px 2px rgba(52,211,153,0.06)",
      }}
    >
      {hasFam ? (
        <div className="flex flex-col items-center gap-0.5" style={{ transform: `scale(${Math.min(scale, 1.1)})` }}>
          <div className="flex flex-wrap justify-center gap-[2px]">
            {displayMembers.map((member, i) => (
              <div
                key={i}
                className="rounded-full flex items-center justify-center"
                style={{
                  width: "12px",
                  height: "12px",
                  background: member.photo_url ? "transparent" : "#065f46",
                  border: "1px solid #34d399",
                  overflow: "hidden",
                }}
                title={member.name}
              >
                {member.photo_url ? (
                  <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[6px] text-emerald-300 font-bold">{member.name?.charAt(0)}</span>
                )}
              </div>
            ))}
          </div>
          {familyMembers.length <= 2 && (
            <span className="text-[7px] text-emerald-400 leading-tight text-center">
              {displayMembers.map((m) => m.name?.split(" ")[0]).join(", ")}
            </span>
          )}
          {familyMembers.length > 4 && (
            <span className="text-[7px] text-emerald-500">+{familyMembers.length - 4}</span>
          )}
        </div>
      ) : (
        <>
          <Users className="w-4 h-4 text-slate-600" style={{ transform: `scale(${Math.min(scale, 1.2)})` }} />
          <span className="text-[7px] text-slate-600 mt-0.5">No family</span>
        </>
      )}
    </div>
  );
}
