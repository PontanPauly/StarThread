import React, { useState, useEffect, useCallback } from "react";
import { Check, X, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PendingRelationships({ onCountChange }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/relationships/pending", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPending(data);
      onCountChange?.(data.length);
    } catch {
      setPending([]);
      onCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAction = async (relationshipId, action) => {
    setActionLoading((prev) => ({ ...prev, [relationshipId]: action }));
    try {
      const res = await fetch(`/api/relationships/verify/${relationshipId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to verify");
      setPending((prev) => {
        const next = prev.filter((r) => r.id !== relationshipId);
        onCountChange?.(next.length);
        return next;
      });
    } catch {
      // silent
    } finally {
      setActionLoading((prev) => ({ ...prev, [relationshipId]: null }));
    }
  };

  if (loading) return null;
  if (pending.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-cyan-400" />
        Pending Relationships
        <span className="ml-auto text-sm font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          {pending.length}
        </span>
      </h3>
      <div className="space-y-3">
        {pending.map((rel) => (
          <div
            key={rel.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50"
          >
            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-cyan-400/30 shrink-0">
              {rel.person_photo ? (
                <img
                  src={rel.person_photo}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-medium text-slate-400">
                  {rel.person_name?.charAt(0) || "?"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-100 font-medium truncate">
                {rel.person_name || "Unknown"}
              </p>
              <p className="text-sm text-cyan-300 capitalize">
                {rel.relationship_type?.replace(/_/g, " ") || "Relationship"}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => handleAction(rel.id, "confirm")}
                disabled={!!actionLoading[rel.id]}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                {actionLoading[rel.id] === "confirm" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span className="ml-1 hidden sm:inline">Confirm</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(rel.id, "deny")}
                disabled={!!actionLoading[rel.id]}
                className="border-slate-600 text-slate-300 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40"
              >
                {actionLoading[rel.id] === "deny" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                <span className="ml-1 hidden sm:inline">Deny</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
