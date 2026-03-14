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
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Loader2,
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

      <DatabaseWipeSection />
    </div>
  );
}

function DatabaseWipeSection() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const confirmMessages = [
    "This will permanently delete ALL data except the admin account.",
    "All users, families, relationships, trips, moments, messages, and every other record will be gone forever.",
    "This CANNOT be undone. Are you absolutely sure?",
  ];

  const handleConfirm = () => {
    setError("");
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleRequestCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/database-wipe/request-code", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteWipe = async () => {
    if (!code.trim()) {
      setError("Please enter the verification code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/database-wipe/execute", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setStep(0);
    setCode("");
    setError("");
  };

  if (done) {
    return (
      <div className="bg-green-950/30 border border-green-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldAlert className="w-5 h-5 text-green-400" />
          <h3 className="text-sm font-semibold text-green-300">Database Cleared</h3>
        </div>
        <p className="text-sm text-green-400/80">
          All data has been removed. Only the admin account remains.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-red-600/15 flex items-center justify-center">
          <Trash2 className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-300">Danger Zone</h3>
          <p className="text-xs text-red-400/60">Database reset with verification</p>
        </div>
      </div>

      {step === 0 && (
        <button
          onClick={handleConfirm}
          className="px-4 py-2 bg-red-600/20 border border-red-700/50 rounded-lg text-sm text-red-300 hover:bg-red-600/30 transition-colors"
        >
          Reset Database...
        </button>
      )}

      {step >= 1 && step <= 3 && (
        <div className="space-y-4">
          <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-200 font-medium mb-1">
                  Confirmation {step} of 3
                </p>
                <p className="text-sm text-red-300/80">
                  {confirmMessages[step - 1]}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            {step < 3 ? (
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-red-600/30 border border-red-600/50 rounded-lg text-sm text-red-300 hover:bg-red-600/40 transition-colors"
              >
                Yes, Continue
              </button>
            ) : (
              <button
                onClick={handleRequestCode}
                disabled={loading}
                className="px-4 py-2 bg-red-600 rounded-lg text-sm text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Send Verification Code to Email
              </button>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-200 font-medium mb-1">
                  Enter Verification Code
                </p>
                <p className="text-sm text-red-300/80">
                  A 6-digit code was sent to your admin email. Enter it below to complete the wipe.
                </p>
              </div>
            </div>
          </div>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="w-40 px-4 py-2.5 bg-slate-900 border border-red-700/50 rounded-lg text-center text-lg font-mono text-slate-100 tracking-[0.3em] focus:outline-none focus:border-red-500"
          />

          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteWipe}
              disabled={loading || code.length !== 6}
              className="px-4 py-2 bg-red-600 rounded-lg text-sm text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Wipe Database
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
