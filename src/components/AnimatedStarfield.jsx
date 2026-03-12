import { useEffect } from "react";

export default function AnimatedStarfield({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let stars = [];
    let shootingStars = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const STAR_COUNT = 280;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 1.2,
        color: Math.random() > 0.7
          ? `rgba(251,191,36,` 
          : Math.random() > 0.5
          ? `rgba(245,158,11,`
          : `rgba(255,255,255,`,
      });
    }

    const spawnShootingStar = () => {
      if (shootingStars.length < 2 && Math.random() < 0.003) {
        shootingStars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.4,
          vx: 3 + Math.random() * 4,
          vy: 1 + Math.random() * 2,
          life: 1,
          length: 40 + Math.random() * 60,
        });
      }
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const s of stars) {
        const twinkle = Math.sin(time * 0.001 * s.speed + s.phase) * 0.3 + 0.7;
        const a = s.alpha * twinkle;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color + a + ")";
        ctx.fill();

        if (s.radius > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = s.color + (a * 0.15) + ")";
          ctx.fill();
        }
      }

      spawnShootingStar();
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life -= 0.012;

        if (ss.life <= 0) {
          shootingStars.splice(i, 1);
          continue;
        }

        const grad = ctx.createLinearGradient(
          ss.x, ss.y,
          ss.x - ss.vx * ss.length * 0.3, ss.y - ss.vy * ss.length * 0.3
        );
        grad.addColorStop(0, `rgba(251,191,36,${ss.life * 0.8})`);
        grad.addColorStop(1, `rgba(251,191,36,0)`);
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(
          ss.x - ss.vx * ss.length * 0.3,
          ss.y - ss.vy * ss.length * 0.3
        );
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
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
