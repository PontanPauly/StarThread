import React, { useState, useRef, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ArrowLeft, CheckCircle } from "lucide-react";

function AnimatedStarfield({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let stars = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const STAR_COUNT = 200;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 1.0,
        color: Math.random() > 0.7 ? `rgba(251,191,36,` : `rgba(255,255,255,`,
      });
    }

    const draw = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const twinkle = Math.sin(time * 0.001 * s.speed + s.phase) * 0.3 + 0.7;
        const a = s.alpha * twinkle;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color + a + ")";
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
  return null;
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="login-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="login-nebula-bg" />
        <canvas ref={canvasRef} className="absolute inset-0 z-[1] pointer-events-none" />
        <AnimatedStarfield canvasRef={canvasRef} />
        <div className="login-vignette" />
        <div className="w-full max-w-md relative z-10 text-center">
          <div className="login-card rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Invalid Reset Link</h2>
            <p className="text-sm text-slate-400 mb-6">This password reset link is invalid or has expired.</p>
            <Link to="/forgot-password">
              <Button className="bg-amber-500/90 hover:bg-amber-500 text-slate-900 font-semibold">
                Request a New Link
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="login-nebula-bg" />
      <div className="login-nebula-accent login-nebula-accent--1" />
      <div className="login-nebula-accent login-nebula-accent--2" />

      <canvas ref={canvasRef} className="absolute inset-0 z-[1] pointer-events-none" />
      <AnimatedStarfield canvasRef={canvasRef} />
      <div className="login-vignette" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-purple-500/10 animate-pulse blur-xl" />
            <img src="/logo.png" alt="StarThread" className="relative w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(0,200,255,0.3)]" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent mb-2">
            Set New Password
          </h1>
        </div>

        <div className="login-card rounded-2xl p-8">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-100 mb-2">Password Reset</h2>
              <p className="text-sm text-slate-400 mb-6">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <Link to="/login">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/25 h-11">
                  Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-amber-400/20 backdrop-blur-sm"
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-amber-400/20 backdrop-blur-sm"
                    placeholder="Repeat password"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/25 border-0 h-11"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Reset Password"
                )}
              </Button>

              <div className="text-center">
                <Link to="/login" className="text-sm text-amber-400 hover:text-amber-300">
                  <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
