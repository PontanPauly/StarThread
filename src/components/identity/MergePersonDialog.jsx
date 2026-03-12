import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Star, Merge, Search, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useMyPerson } from "@/hooks/useMyPerson";

export default function MergePersonDialog() {
  const queryClient = useQueryClient();
  const { data: myPerson } = useMyPerson();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: searchQuery.trim() });
      const res = await fetch(`/api/entities/Person/search?${params}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const results = (data.matches || data).filter(p => p.id !== myPerson?.id);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedPerson || !myPerson) return;
    setMerging(true);
    try {
      const res = await fetch("/api/identity/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          keepPersonId: myPerson.id,
          mergePersonId: selectedPerson.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast({
            title: "Merge requires review",
            description: data.error,
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }
      toast({ title: "Merge complete", description: "Records have been combined successfully." });
      queryClient.invalidateQueries({ queryKey: ["myPerson"] });
      setSelectedPerson(null);
      setConfirmOpen(false);
      setSearchResults([]);
      setSearchQuery("");
    } catch (err) {
      toast({ title: "Merge failed", description: err.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Merge className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-100">Merge Duplicate Profiles</h3>
          <p className="text-xs text-slate-400">Combine a duplicate person record into your profile</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search for the duplicate by name..."
          className="bg-slate-800/50 border-slate-700 text-slate-200"
        />
        <Button
          onClick={handleSearch}
          disabled={searching || searchQuery.trim().length < 2}
          className="bg-slate-700 hover:bg-slate-600"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {searchResults.length > 0 && !selectedPerson && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {searchResults.map((person) => (
            <button
              key={person.id}
              onClick={() => { setSelectedPerson(person); setConfirmOpen(true); }}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center overflow-hidden shrink-0">
                {person.photo_url ? (
                  <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Star className="w-4 h-4 text-purple-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium truncate">{person.name}</p>
                {person.explanations && person.explanations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {person.explanations.slice(0, 3).map((exp, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-400">{exp}</span>
                    ))}
                  </div>
                )}
              </div>
              {person.confidence && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                  person.confidence === 'high' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-600/30 text-slate-400'
                }`}>
                  {person.score}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {confirmOpen && selectedPerson && myPerson && (
        <div className="border border-amber-500/30 rounded-lg p-4 space-y-3 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Confirm merge
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 p-3 rounded-lg bg-slate-800/50 border border-emerald-500/30">
              <p className="text-[10px] text-emerald-400 font-semibold uppercase mb-1">Keep</p>
              <p className="text-sm text-slate-200 font-medium">{myPerson.name}</p>
              {myPerson.city && <p className="text-xs text-slate-400">{myPerson.city}, {myPerson.state}</p>}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1 p-3 rounded-lg bg-slate-800/50 border border-red-500/30">
              <p className="text-[10px] text-red-400 font-semibold uppercase mb-1">Merge into above</p>
              <p className="text-sm text-slate-200 font-medium">{selectedPerson.name}</p>
              {selectedPerson.city && <p className="text-xs text-slate-400">{selectedPerson.city}, {selectedPerson.state}</p>}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            All relationships, moments, and data from "{selectedPerson.name}" will be transferred to your profile. 
            Empty fields on your profile will be filled from the merged record. This action cannot be undone.
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleMerge}
              disabled={merging}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {merging ? "Merging..." : "Confirm Merge"}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setConfirmOpen(false); setSelectedPerson(null); }}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
