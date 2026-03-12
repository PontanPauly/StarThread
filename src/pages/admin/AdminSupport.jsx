import React, { useState, useEffect, useRef } from "react";
import {
  Headphones,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Calendar,
  MapPin,
  Heart,
  X,
  Key,
} from "lucide-react";

function CountdownTimer({ expiresAt }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}m ${secs.toString().padStart(2, "0")}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isLow = new Date(expiresAt) - Date.now() < 300000;

  return (
    <span className={`font-mono text-sm ${isLow ? "text-red-400" : "text-emerald-400"}`}>
      <Clock className="w-3.5 h-3.5 inline mr-1" />
      {remaining}
    </span>
  );
}

export default function AdminSupport() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [activeTokens, setActiveTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    setTokensLoading(true);
    try {
      const res = await fetch("/api/admin/support-tokens", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tokens");
      const data = await res.json();
      setActiveTokens(data);
    } catch (e) {
      console.error(e);
    } finally {
      setTokensLoading(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/support-tokens/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }
      setActiveSession(data);
      setCode("");
      fetchTokens();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (tokenId) => {
    try {
      await fetch(`/api/admin/support-tokens/${tokenId}/resolve`, {
        method: "POST",
        credentials: "include",
      });
      if (activeSession?.token_id === tokenId) {
        setActiveSession(null);
      }
      fetchTokens();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 6 || !activeSession?.user?.id) return;
    try {
      const res = await fetch(`/api/admin/users/${activeSession.user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ new_password: resetPassword }),
      });
      if (res.ok) {
        setResetPassword("");
        setShowResetPassword(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <form onSubmit={handleActivate} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Headphones className="w-4 h-4 text-blue-400" />
          Enter Support Code
        </h3>
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            maxLength={6}
            className="flex-1 max-w-[200px] px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-lg text-slate-100 text-center tracking-[0.3em] text-lg font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            type="submit"
            disabled={code.length !== 6 || loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" /> Activate
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
      </form>

      {activeSession && (
        <div className="bg-slate-900/60 border border-blue-500/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Active Support Session
            </h3>
            <CountdownTimer expiresAt={activeSession.expires_at} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-slate-500 uppercase">Account Info</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-300">{activeSession.user.full_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-300">{activeSession.user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400">Joined {new Date(activeSession.user.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded capitalize">{activeSession.user.subscription_tier || "free"}</span>
                </div>
              </div>
            </div>

            {activeSession.person && (
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-slate-500 uppercase">Profile</h4>
                <div className="space-y-2">
                  <div className="text-sm text-slate-300">{activeSession.person.name}</div>
                  {activeSession.person.birth_date && (
                    <div className="text-xs text-slate-500">Born: {new Date(activeSession.person.birth_date).toLocaleDateString()}</div>
                  )}
                  {activeSession.person.city && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3 h-3" />
                      {[activeSession.person.city, activeSession.person.state].filter(Boolean).join(", ")}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 capitalize">Privacy: {activeSession.person.privacy_level || "public"}</div>
                </div>
              </div>
            )}
          </div>

          {activeSession.relationships?.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Relationships</h4>
              <div className="flex flex-wrap gap-2">
                {activeSession.relationships.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800/50 rounded text-xs text-slate-400">
                    <Heart className="w-3 h-3" />
                    {r.related_name}
                    <span className="text-slate-600">({r.relationship_type})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-3">
            {showResetPassword ? (
              <div className="flex gap-2 items-center w-full">
                <Key className="w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="flex-1 max-w-xs px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
                />
                <button
                  onClick={handleResetPassword}
                  disabled={resetPassword.length < 6}
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-30 px-2"
                >
                  Reset
                </button>
                <button onClick={() => { setShowResetPassword(false); setResetPassword(""); }} className="text-xs text-slate-500">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowResetPassword(true)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
                <Key className="w-4 h-4" /> Reset Password
              </button>
            )}

            <button
              onClick={() => handleResolve(activeSession.token_id)}
              className="ml-auto px-4 py-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg text-sm font-medium transition-colors"
            >
              Resolve Session
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Active Support Tokens</h3>
        {tokensLoading ? (
          <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTokens.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No active support tokens</p>
        ) : (
          <div className="space-y-2">
            {activeTokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm text-slate-200">{t.user_name} ({t.user_email})</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${t.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                      {t.status}
                    </span>
                    <CountdownTimer expiresAt={t.expires_at} />
                    {t.admin_name && <span className="text-xs text-slate-500">by {t.admin_name}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleResolve(t.id)}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
