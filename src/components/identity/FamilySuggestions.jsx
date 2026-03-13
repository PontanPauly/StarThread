import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, ChevronRight, Sparkles } from "lucide-react";

export default function FamilySuggestions() {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["family-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/identity/family-suggestions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || suggestions.length === 0) return null;

  return (
    <div className="glass-card rounded-xl p-5 border border-purple-500/30 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h3 className="text-sm font-semibold text-slate-100">People you might know</h3>
      </div>
      <p className="text-xs text-slate-400">
        Potential matches found for your family members.
      </p>

      <div className="space-y-2">
        {suggestions.slice(0, 5).map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-700/40 bg-slate-800/40"
          >
            <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center overflow-hidden shrink-0">
              {s.photo_url ? (
                <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-4 h-4 text-purple-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{s.name}</p>
              {s.for_family_member_name && (
                <p className="text-[10px] text-slate-500">
                  May match {s.for_family_member_name}
                </p>
              )}
              {s.confidence === "high" && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                  Strong match
                </span>
              )}
            </div>
            <Link
              to={`/star/${s.suggested_person_id}`}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
