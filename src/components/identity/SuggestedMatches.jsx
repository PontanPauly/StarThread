import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Check, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export default function SuggestedMatches() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(null);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["identity-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/identity/suggestions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const handleAccept = async (id) => {
    setLoading(id);
    try {
      const res = await fetch(`/api/identity/suggestions/${id}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Star claimed!", description: "Your profile has been linked to this person." });
      queryClient.invalidateQueries({ queryKey: ["identity-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["myPerson"] });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleDismiss = async (id, permanent = false) => {
    setLoading(id);
    try {
      const res = await fetch(`/api/identity/suggestions/${id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permanent }),
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      queryClient.invalidateQueries({ queryKey: ["identity-suggestions"] });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  if (isLoading || suggestions.length === 0) return null;

  return (
    <div className="glass-card rounded-xl p-5 border border-cyan-500/30 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-cyan-400" />
        <h3 className="text-sm font-semibold text-slate-100">Is one of these your star?</h3>
      </div>
      <p className="text-xs text-slate-400">
        We found people in StarThread that might be you. Claiming your star links your account to an existing profile.
      </p>

      <div className="space-y-2">
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            loading={loading === s.id}
            onAccept={() => handleAccept(s.id)}
            onDismiss={(permanent) => handleDismiss(s.id, permanent)}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, loading, onAccept, onDismiss }) {
  const [showDismissOptions, setShowDismissOptions] = useState(false);

  const confidenceStyle = {
    high: "border-amber-500/40 bg-amber-500/5",
    medium: "border-slate-600/40",
    low: "border-slate-700/30",
  };

  return (
    <div className={`rounded-lg p-3 border ${confidenceStyle[suggestion.confidence] || confidenceStyle.low}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center overflow-hidden shrink-0">
          {suggestion.photo_url ? (
            <img src={suggestion.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Star className="w-5 h-5 text-cyan-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-200 truncate">{suggestion.name}</p>
            {suggestion.confidence === "high" && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold shrink-0">
                Strong match
              </span>
            )}
            {suggestion.confidence === "medium" && (
              <span className="px-1.5 py-0.5 rounded bg-slate-600/30 text-slate-300 text-[10px] font-semibold shrink-0">
                Possible
              </span>
            )}
          </div>
          {suggestion.explanations && suggestion.explanations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {suggestion.explanations.slice(0, 4).map((exp, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                  {exp}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          onClick={onAccept}
          disabled={loading}
          className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8"
        >
          <Check className="w-3.5 h-3.5 mr-1" />
          This is me
        </Button>
        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDismissOptions(!showDismissOptions)}
            disabled={loading}
            className="border-slate-600 text-slate-300 text-xs h-8"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Not me
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
          {showDismissOptions && (
            <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 min-w-[160px]">
              <button
                onClick={() => { onDismiss(false); setShowDismissOptions(false); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 rounded-t-lg"
              >
                Hide for now
              </button>
              <button
                onClick={() => { onDismiss(true); setShowDismissOptions(false); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-700 rounded-b-lg border-t border-slate-700"
              >
                Never show again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
