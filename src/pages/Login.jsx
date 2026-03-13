import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, Link2, AlertCircle, ArrowLeft } from "lucide-react";
import AnimatedStarfield from "@/components/AnimatedStarfield";

const GOOGLE_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const INVITE_RELATIONSHIP_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "sibling", label: "Sibling" },
  { value: "partner", label: "Partner" },
  { value: "spouse", label: "Spouse" },
  { value: "grandparent", label: "Grandparent" },
  { value: "grandchild", label: "Grandchild" },
  { value: "aunt_uncle", label: "Aunt/Uncle" },
  { value: "niece_nephew", label: "Niece/Nephew" },
  { value: "cousin", label: "Cousin" },
  { value: "in_law", label: "In-Law" },
  { value: "step_parent", label: "Step-Parent" },
  { value: "step_child", label: "Step-Child" },
  { value: "step_sibling", label: "Step-Sibling" },
  { value: "half_sibling", label: "Half-Sibling" },
  { value: "guardian", label: "Guardian" },
  { value: "godparent", label: "Godparent" },
  { value: "chosen_family", label: "Chosen Family" },
  { value: "extended", label: "Extended Family" },
];

export default function Login() {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite') || '';
  const googleError = searchParams.get('error') || '';

  const startAsSignup = searchParams.get('signup') === 'true';
  const [isLogin, setIsLogin] = useState(!inviteCode && !startAsSignup);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [selectedRelationship, setSelectedRelationship] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const { data: inviteInfo } = useQuery({
    queryKey: ['invite-info', inviteCode],
    queryFn: async () => {
      const res = await fetch(`/api/auth/invite-info?code=${encodeURIComponent(inviteCode)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!inviteCode,
    staleTime: 60000,
  });

  const needsRelationshipSelection = inviteCode && inviteInfo?.valid && !inviteInfo?.has_relationship_type;

  const { data: googleEnabled } = useQuery({
    queryKey: ['googleAuthEnabled'],
    queryFn: async () => {
      const res = await fetch('/api/auth/google/enabled');
      if (!res.ok) return { enabled: false };
      return res.json();
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (googleError) {
      const messages = {
        google_denied: 'Google sign-in was cancelled',
        google_token_failed: 'Failed to complete Google sign-in',
        google_profile_failed: 'Could not retrieve your Google profile',
        google_failed: 'Google sign-in failed. Please try again.',
      };
      setError(messages[googleError] || 'Sign-in failed');
    }
  }, [googleError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!isLogin && needsRelationshipSelection && !selectedRelationship) {
        setError("Please select how you are related to the person who invited you.");
        setLoading(false);
        return;
      }
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.email, formData.password, formData.fullName, inviteCode, selectedRelationship || undefined);
      }
      navigate("/");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="login-nebula-bg" />
      <div className="login-nebula-accent login-nebula-accent--1" />
      <div className="login-nebula-accent login-nebula-accent--2" />
      <div className="login-nebula-accent login-nebula-accent--3" />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[1] pointer-events-none"
      />
      <AnimatedStarfield canvasRef={canvasRef} />

      <div className="login-vignette" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="group inline-block">
            <div className="relative w-24 h-24 mx-auto mb-5">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-purple-500/10 animate-pulse blur-xl" />
              <img src="/logo.png" alt="StarThread" className="relative w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(0,200,255,0.3)]" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent mb-3 tracking-tight group-hover:from-amber-100 group-hover:to-amber-200 transition-all">
              StarThread
            </h1>
          </Link>
          <p className="text-lg text-amber-200/70 font-light tracking-wide">
            Every family is a galaxy of stories
          </p>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400/80 mt-2 hover:text-amber-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
        </div>

        <div className="login-card rounded-2xl p-8">
          <div className="flex gap-2 mb-6">
            <Button
              type="button"
              variant={isLogin ? "default" : "ghost"}
              className={
                isLogin
                  ? "flex-1 bg-amber-500/90 hover:bg-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/20 border-0"
                  : "flex-1 text-slate-400 hover:text-amber-200 border-0"
              }
              onClick={() => setIsLogin(true)}
            >
              Sign In
            </Button>
            <Button
              type="button"
              variant={!isLogin ? "default" : "ghost"}
              className={
                !isLogin
                  ? "flex-1 bg-amber-500/90 hover:bg-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/20 border-0"
                  : "flex-1 text-slate-400 hover:text-amber-200 border-0"
              }
              onClick={() => setIsLogin(false)}
            >
              Register
            </Button>
          </div>

          {inviteCode && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
              <Link2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">You've been invited to join a family. Register to connect.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                  <Input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-amber-400/20 backdrop-blur-sm"
                    placeholder="Your name"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-amber-400/20 backdrop-blur-sm"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-amber-400/20 backdrop-blur-sm"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            {needsRelationshipSelection && !isLogin && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">How are you related to the person who invited you?</Label>
                <select
                  value={selectedRelationship}
                  onChange={(e) => setSelectedRelationship(e.target.value)}
                  className="w-full h-10 rounded-md bg-slate-800/60 border border-slate-600/50 text-slate-100 px-3 text-sm focus:border-amber-400/60 focus:ring-amber-400/20 focus:outline-none"
                  required
                >
                  <option value="">Select relationship...</option>
                  {INVITE_RELATIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm backdrop-blur-sm">
                {error}
              </div>
            )}

            {isLogin && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-amber-400/70 hover:text-amber-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/25 border-0 h-11"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : isLogin ? (
                "Enter the Universe"
              ) : (
                "Create Your Star"
              )}
            </Button>
          </form>

          {googleEnabled?.enabled && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-slate-700/50" />
                <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-700/50" />
              </div>

              <a
                href={`/api/auth/google${inviteCode ? `?invite=${encodeURIComponent(inviteCode)}${selectedRelationship ? `&relationship_type=${encodeURIComponent(selectedRelationship)}` : ''}` : ''}`}
                className="flex items-center justify-center gap-3 w-full h-11 rounded-md bg-white hover:bg-gray-50 text-slate-800 font-medium text-sm transition-colors border border-slate-200 shadow-sm"
              >
                {GOOGLE_ICON}
                {isLogin ? "Sign in with Google" : "Sign up with Google"}
              </a>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-500/60 mt-6">
          A private universe for your family
        </p>
      </div>
    </div>
  );
}
