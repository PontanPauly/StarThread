import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  Home,
  Headphones,
  Heart,
  MapPin,
  Camera,
  BookOpen,
  MessageCircle,
  Calendar,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const STAT_ICONS = {
  total_users: Users,
  total_people: UserCheck,
  total_households: Home,
  active_support_tokens: Headphones,
};

const CONTENT_ICONS = {
  relationships: TrendingUp,
  trips: MapPin,
  moments: Camera,
  love_notes: Heart,
  stories: BookOpen,
  conversations: MessageCircle,
  messages: MessageCircle,
  calendar_events: Calendar,
  traditions: Sparkles,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then(setStats)
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

  if (!stats) {
    return <div className="text-slate-400 text-center py-20">Failed to load stats</div>;
  }

  const primaryStats = [
    { key: "total_users", label: "Users", value: stats.total_users },
    { key: "total_people", label: "People", value: stats.total_people },
    { key: "total_households", label: "Households", value: stats.total_households },
    { key: "active_support_tokens", label: "Active Support", value: stats.active_support_tokens },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryStats.map(({ key, label, value }) => {
          const Icon = STAT_ICONS[key];
          return (
            <div key={key} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-blue-600/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-100">{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Content Stats</h3>
          <div className="space-y-3">
            {Object.entries(stats.content_stats).map(([key, count]) => {
              const Icon = CONTENT_ICONS[key] || TrendingUp;
              const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-sm text-slate-400">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </div>
                  <span className="text-sm font-medium text-slate-200">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">Recent Users</h3>
            <button
              onClick={() => navigate("/admin/users")}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              View All
            </button>
          </div>
          <div className="space-y-2.5">
            {stats.recent_users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm text-slate-200 truncate">{u.full_name}</div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>
                <div className="text-xs text-slate-600 shrink-0 ml-3">
                  {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats.subscriptions.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Subscription Breakdown</h3>
          <div className="flex gap-4 flex-wrap">
            {stats.subscriptions.map((s) => (
              <div key={s.subscription_tier} className="bg-slate-800/50 rounded-lg px-4 py-3 min-w-[120px]">
                <div className="text-lg font-bold text-slate-100">{s.count}</div>
                <div className="text-xs text-slate-400 capitalize">{s.subscription_tier || "free"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
