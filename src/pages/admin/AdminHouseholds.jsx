import React, { useState, useEffect } from "react";
import { Home, Users } from "lucide-react";

export default function AdminHouseholds() {
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/households", { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setHouseholds)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="text-xs text-slate-500">{households.length} households</div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Household</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Members</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Created</th>
            </tr>
          </thead>
          <tbody>
            {households.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-slate-500">No households</td></tr>
            ) : households.map((h) => (
              <tr key={h.id} className="border-b border-slate-800/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-slate-600" />
                    <div>
                      <div className="text-slate-200">{h.name}</div>
                      {h.description && <div className="text-xs text-slate-500">{h.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Users className="w-3.5 h-3.5" /> {h.member_count}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-600">
                  {new Date(h.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
