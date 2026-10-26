"use client";
import { useEffect, useRef } from "react";
export default function ParticleCanvas({
  burst,
  reduced,
}: {
  burst: { x: number; y: number; id: number } | null;
  reduced: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!burst || reduced) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const box = canvas.getBoundingClientRect();
    canvas.width = box.width * devicePixelRatio;
    canvas.height = box.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const count = navigator.hardwareConcurrency < 4 ? 24 : 65;
    const particles = Array.from({ length: count }, (_, i) => ({
      x: (burst.x * box.width) / 100,
      y: (burst.y * box.height) / 100,
      vx: Math.cos(i * 2.4) * (40 + i * 3),
      vy: Math.sin(i * 2.4) * (40 + i * 3),
      life: 1,
    }));
    let frame = 0,
      last = 0;
    function draw(t: number) {
      if (document.hidden) {
        last = t;
        frame = requestAnimationFrame(draw);
        return;
      }
      const dt = last ? Math.min((t - last) / 1000, 0.04) : 0.016;
      last = t;
      ctx!.clearRect(0, 0, box.width, box.height);
      for (const p of particles) {
        p.life -= dt * 1.6;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 110 * dt;
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.fillStyle =
          p.life > 0.65 ? "#fff5bc" : p.life > 0.3 ? "#ff823c" : "#ff3d5a";
        ctx!.fillRect(p.x, p.y, 4, 4);
      }
      ctx!.globalAlpha = 1;
      if (particles.some((p) => p.life > 0))
        frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [burst, reduced]);
  return <canvas aria-hidden="true" className="particles" ref={ref} />;
}
