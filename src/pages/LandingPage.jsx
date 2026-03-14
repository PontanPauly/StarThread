import React, { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import AnimatedStarfield from "@/components/AnimatedStarfield";
import {
  Users,
  MapPin,
  Heart,
  Camera,
  BookOpen,
  Lightbulb,
  ArrowRight,
} from "lucide-react";

function ConstellationLines({ containerRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    let animId;
    const NODE_RADIUS = 36;

    const nodes = container.querySelectorAll("[data-step-node]");
    if (nodes.length < 2) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (time) => {
      const dpr = window.devicePixelRatio || 1;
      const containerRect = container.getBoundingClientRect();
      const w = containerRect.width;
      const h = containerRect.height;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.clearRect(0, 0, w, h);

      const centers = Array.from(nodes).map(node => {
        const r = node.getBoundingClientRect();
        return {
          x: r.left - containerRect.left + r.width / 2,
          y: r.top - containerRect.top + r.height / 2,
        };
      });

      const numLines = centers.length - 1;
      const conns = [];
      for (let i = 0; i < numLines; i++) {
        const dx = centers[i + 1].x - centers[i].x;
        const dy = centers[i + 1].y - centers[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / dist;
        const uy = dy / dist;
        conns.push({
          from: { x: centers[i].x + ux * NODE_RADIUS, y: centers[i].y + uy * NODE_RADIUS },
          to: { x: centers[i + 1].x - ux * NODE_RADIUS, y: centers[i + 1].y - uy * NODE_RADIUS },
        });
      }

      for (const conn of conns) {
        ctx.beginPath();
        ctx.moveTo(conn.from.x, conn.from.y);
        ctx.lineTo(conn.to.x, conn.to.y);
        ctx.strokeStyle = "rgba(56, 189, 186, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      const speed = 0.0001;
      const rawT = ((time * speed) % 1 + 1) % 1;
      const pauseStart = 0.08;
      const pauseEnd = 0.08;
      const travelRange = 1 - pauseStart - pauseEnd;
      let energyPos;
      let fade = 1;
      if (rawT < pauseStart) {
        energyPos = 0;
        const ft = rawT / pauseStart;
        fade = ft * ft * (3 - 2 * ft);
      } else if (rawT > 1 - pauseEnd) {
        energyPos = 1;
        const ft = (1 - rawT) / pauseEnd;
        fade = ft * ft * (3 - 2 * ft);
      } else {
        energyPos = (rawT - pauseStart) / travelRange;
      }

      const nodePos = centers.map((_, i) => i / (centers.length - 1));
      const glowR = 0.08;
      const edgeR = 0.04;
      const pw = 0.14;

      for (let i = 0; i < centers.length; i++) {
        const dist = Math.abs(energyPos - nodePos[i]);
        if (dist >= glowR) continue;
        const s = 1 - dist / glowR;
        const sm = s * s * (3 - 2 * s) * fade;
        if (sm < 0.01) continue;
        const cx = centers[i].x;
        const cy = centers[i].y;
        const maxExpand = 12;
        const r = NODE_RADIUS + sm * maxExpand;
        const grad = ctx.createRadialGradient(cx, cy, NODE_RADIUS - 2, cx, cy, r);
        grad.addColorStop(0, `rgba(56, 189, 186, 0)`);
        grad.addColorStop(0.3, `rgba(56, 189, 186, ${sm * 0.2})`);
        grad.addColorStop(0.6, `rgba(160, 235, 230, ${sm * 0.12})`);
        grad.addColorStop(1, `rgba(56, 189, 186, 0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, NODE_RADIUS + 1, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(160, 235, 230, ${sm * 0.35})`;
        ctx.lineWidth = 1.5 + sm * 1;
        ctx.stroke();
      }

      for (let i = 0; i < numLines; i++) {
        const lineStart = nodePos[i] + edgeR;
        const lineEnd = nodePos[i + 1] - edgeR;
        const lineLen = lineEnd - lineStart;
        const lineT = (energyPos - lineStart) / lineLen;
        if (lineT <= -pw || lineT >= 1 + pw) continue;

        const conn = conns[i];
        const eDx = conn.to.x - conn.from.x;
        const eDy = conn.to.y - conn.from.y;
        for (let s = 0; s < 80; s++) {
          const t0 = s / 80;
          const t1 = (s + 1) / 80;
          const d = Math.abs((t0 + t1) / 2 - lineT);
          const p = Math.max(0, 1 - d / pw);
          if (p < 0.01) continue;
          const sm = p * p * (3 - 2 * p) * fade;
          ctx.beginPath();
          ctx.moveTo(conn.from.x + eDx * t0, conn.from.y + eDy * t0);
          ctx.lineTo(conn.from.x + eDx * t1, conn.from.y + eDy * t1);
          ctx.strokeStyle = `rgba(160, 235, 230, ${sm * 0.6})`;
          ctx.lineWidth = 1.5 + sm * 2;
          ctx.lineCap = "butt";
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="hidden md:block absolute inset-0 w-full h-full z-0 pointer-events-none"
    />
  );
}

function MobileConstellationLines({ containerRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    let animId;
    const NODE_RADIUS = 36;

    const nodes = container.querySelectorAll("[data-step-node]");
    if (nodes.length < 2) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    function sampleCubic(p0, p1, p2, p3, segments) {
      const pts = [];
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const u = 1 - t;
        pts.push({
          x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
          y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
        });
      }
      return pts;
    }

    function buildPath(fromCenter, toCenter, bendDir, containerW) {
      const goRight = bendDir === "right";

      const sx = goRight ? fromCenter.x + NODE_RADIUS : fromCenter.x - NODE_RADIUS;
      const sy = fromCenter.y;
      const ex = goRight ? toCenter.x + NODE_RADIUS : toCenter.x - NODE_RADIUS;
      const ey = toCenter.y;

      const pad = 10;
      const farX = goRight ? containerW - pad : pad;

      const midY = (sy + ey) / 2;

      const p0 = { x: sx, y: sy };
      const p1 = { x: farX, y: midY };
      const p2 = { x: farX, y: midY };
      const p3 = { x: ex, y: ey };

      return sampleCubic(p0, p1, p2, p3, 120);
    }

    const draw = (time) => {
      const dpr = window.devicePixelRatio || 1;
      const containerRect = container.getBoundingClientRect();
      const w = containerRect.width;
      const h = containerRect.height;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.clearRect(0, 0, w, h);

      const centers = Array.from(nodes).map(node => {
        const r = node.getBoundingClientRect();
        return {
          x: r.left - containerRect.left + r.width / 2,
          y: r.top - containerRect.top + r.height / 2,
        };
      });

      const curves = [];
      const directions = ["right", "left"];
      for (let i = 0; i < centers.length - 1; i++) {
        curves.push(buildPath(centers[i], centers[i + 1], directions[i % 2], w));
      }

      for (const pts of curves) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let j = 1; j < pts.length; j++) {
          ctx.lineTo(pts[j].x, pts[j].y);
        }
        ctx.strokeStyle = "rgba(56, 189, 186, 0.18)";
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      const speed = 0.0001;
      const rawT = ((time * speed) % 1 + 1) % 1;
      const pauseStart = 0.08;
      const pauseEnd = 0.08;
      const travelRange = 1 - pauseStart - pauseEnd;
      let energyPos;
      let fade = 1;
      if (rawT < pauseStart) {
        energyPos = 0;
        const ft = rawT / pauseStart;
        fade = ft * ft * (3 - 2 * ft);
      } else if (rawT > 1 - pauseEnd) {
        energyPos = 1;
        const ft = (1 - rawT) / pauseEnd;
        fade = ft * ft * (3 - 2 * ft);
      } else {
        energyPos = (rawT - pauseStart) / travelRange;
      }

      const nodePos = centers.map((_, i) => i / (centers.length - 1));
      const glowR = 0.08;
      const pw = 0.12;

      for (let i = 0; i < centers.length; i++) {
        const dist = Math.abs(energyPos - nodePos[i]);
        if (dist >= glowR) continue;
        const s = 1 - dist / glowR;
        const sm = s * s * (3 - 2 * s) * fade;
        if (sm < 0.01) continue;
        const cx = centers[i].x;
        const cy = centers[i].y;
        const maxExpand = 10;
        const r = NODE_RADIUS + sm * maxExpand;
        const grad = ctx.createRadialGradient(cx, cy, NODE_RADIUS - 2, cx, cy, r);
        grad.addColorStop(0, `rgba(56, 189, 186, 0)`);
        grad.addColorStop(0.3, `rgba(56, 189, 186, ${sm * 0.18})`);
        grad.addColorStop(0.6, `rgba(160, 235, 230, ${sm * 0.1})`);
        grad.addColorStop(1, `rgba(56, 189, 186, 0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, NODE_RADIUS + 1, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(160, 235, 230, ${sm * 0.3})`;
        ctx.lineWidth = 1.5 + sm * 0.8;
        ctx.stroke();
      }

      for (let c = 0; c < curves.length; c++) {
        const pts = curves[c];
        const eStart = nodePos[c] + 0.04;
        const eEnd = nodePos[c + 1] - 0.04;
        const eLen = eEnd - eStart;

        for (let j = 1; j < pts.length; j++) {
          const segT = (j - 0.5) / (pts.length - 1);
          const lineNorm = eStart + segT * eLen;
          const d = Math.abs(energyPos - lineNorm);
          const p = Math.max(0, 1 - d / pw);
          if (p < 0.01) continue;
          const sm = p * p * (3 - 2 * p) * fade;
          ctx.beginPath();
          ctx.moveTo(pts[j-1].x, pts[j-1].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(160, 235, 230, ${sm * 0.55})`;
          ctx.lineWidth = 1.5 + sm * 1.8;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="md:hidden absolute inset-0 w-full h-full z-0 pointer-events-none"
    />
  );
}

const features = [
  {
    icon: Users,
    title: "Family Galaxy",
    description: "Map your entire family tree as a constellation of stars. See how everyone connects across generations.",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: MapPin,
    title: "Trip Planning",
    description: "Plan family adventures together. Coordinate trips, share itineraries, and build anticipation for your next journey.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Camera,
    title: "Moments",
    description: "Capture and preserve precious family moments. Photos, milestones, and everyday memories all in one place.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: Heart,
    title: "Love Notes",
    description: "Send heartfelt notes of gratitude to family members. Strengthen bonds with words of appreciation.",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: BookOpen,
    title: "Family Stories",
    description: "Record and share the stories that define your family. Preserve traditions, recipes, and wisdom for generations.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Lightbulb,
    title: "Smart Insights",
    description: "Get personalized insights about your family. Birthday reminders, relationship suggestions, and more.",
    gradient: "from-violet-500 to-purple-500",
  },
];

const steps = [
  {
    number: "01",
    title: "Create Your Star",
    description: "Sign up and create your star. Your family galaxy already exists, and you're stepping into it.",
  },
  {
    number: "02",
    title: "Connect & Map",
    description: "Define relationships and watch your family tree come alive as an interactive star map.",
  },
  {
    number: "03",
    title: "Grow Together",
    description: "Plan trips, capture moments, share stories, and send love notes to keep your family close.",
  },
];

export default function LandingPage() {
  const canvasRef = useRef(null);
  const stepsContainerRef = useRef(null);

  return (
    <div className="login-page min-h-screen relative overflow-x-hidden">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full z-0"
        style={{ pointerEvents: "none" }}
      />
      <AnimatedStarfield canvasRef={canvasRef} />

      <div className="login-nebula-bg" />
      <div className="login-nebula-accent login-nebula-accent--1" />
      <div className="login-nebula-accent login-nebula-accent--2" />
      <div className="login-nebula-accent login-nebula-accent--3" />
      <div className="login-vignette" />

      <div className="relative z-10">
        <nav className="flex items-center justify-end px-6 md:px-12 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/login">
              <button className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                Log In
              </button>
            </Link>
            <Link to="/login?signup=true">
              <button className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 rounded-lg shadow-lg shadow-amber-500/20 transition-all">
                Sign Up Free
              </button>
            </Link>
          </div>
        </nav>

        <section className="px-6 md:px-12 pt-16 pb-24 md:pt-24 md:pb-32 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-4 mb-10">
            <img src="/logo.png" alt="StarThread" className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_0_16px_rgba(0,200,255,0.5)]" />
            <span className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent tracking-wide">StarThread</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-amber-200 via-slate-100 to-purple-200 bg-clip-text text-transparent">
              Every Family Is a
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-300 via-amber-200 to-amber-400 bg-clip-text text-transparent">
              Galaxy of Stars
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Map your family tree as a constellation. Plan trips, capture moments,
            share stories, and send love notes, all woven together in one
            beautiful space.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login?signup=true">
              <button className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/login">
              <button className="w-full sm:w-auto px-8 py-3.5 text-base font-medium text-white bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/50 rounded-xl backdrop-blur-sm transition-all">
                Sign In
              </button>
            </Link>
          </div>
        </section>

        <section className="px-6 md:px-12 py-20 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-amber-200 to-slate-100 bg-clip-text text-transparent">
              Built for Families Like Yours
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              From mapping your family tree to preserving precious memories,
              StarThread brings your family closer together.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl p-6 border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm hover:border-slate-600/50 transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg`}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 md:px-12 py-20 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-purple-200 to-slate-100 bg-clip-text text-transparent">
              How It Works
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Get started in minutes. Your family galaxy is waiting for you.
            </p>
          </div>

          <div className="relative pt-6 pb-2" ref={stepsContainerRef}>
            <ConstellationLines containerRef={stepsContainerRef} />
            <MobileConstellationLines containerRef={stepsContainerRef} />

            <div className="grid md:grid-cols-3 gap-8 relative z-10">
              {steps.map((step, i) => (
                <div key={step.number} className="relative text-center flex flex-col items-center">
                  <div className="relative mb-6">
                    <div
                      data-step-node
                      className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-amber-500/15 to-teal-500/10 border border-teal-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,186,0.15)] relative z-10"
                    >
                      <span className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                        {step.number}
                      </span>
                    </div>
                    <div className="absolute -inset-2 rounded-full bg-teal-500/8 blur-md" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-100 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-[260px]">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 md:px-12 py-20 max-w-4xl mx-auto">
          <div className="relative rounded-3xl p-10 md:p-16 text-center border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-slate-800/40 to-purple-500/5 backdrop-blur-sm overflow-hidden">
            <div className="absolute top-4 right-4 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl" />
            <div className="absolute bottom-4 left-4 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-amber-200 via-slate-100 to-purple-200 bg-clip-text text-transparent">
                Step Into Your Family Galaxy
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto mb-8">
                Create your star, map your stories, plan adventures, and grow closer, one star at a time.
              </p>
              <Link to="/login?signup=true">
                <button className="px-10 py-4 text-base font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 rounded-xl shadow-lg shadow-amber-500/25 transition-all inline-flex items-center gap-2">
                  Create Your Free Account
                  <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
            </div>
          </div>
        </section>

        <footer className="px-6 md:px-12 py-12 border-t border-slate-800/80 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="StarThread" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(0,200,255,0.4)]" />
              <span className="text-sm font-semibold text-slate-300">
                StarThread
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <Link
                to="/login"
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/login?signup=true"
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Sign Up
              </Link>
            </div>
            <p className="text-xs text-slate-600">
              &copy; {new Date().getFullYear()} StarThread. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
