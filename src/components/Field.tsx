"use client";
import { useEffect, useRef, type RefObject } from "react";
import { SIZE, type World, type Point, type EnemyKind } from "@/game/engine";
const colors: Record<EnemyKind, string> = {
  brute: "#e9a36c",
  phish: "#d8b2fc",
  inject: "#ff7b93",
  ransom: "#b0a0ef",
  ddos: "#eed47e",
  zero: "#ff6585",
};
function hex(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}
export default function Field({
  world,
  input,
  reduced,
  decorative = false,
}: {
  world: RefObject<World>;
  input: RefObject<Point>;
  reduced: boolean;
  decorative?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!,
      c = canvas.getContext("2d");
    if (!c) return;
    let frame = 0,
      width = 0,
      height = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    let active: { id: number; start: Point; end: Point } | null = null;
    const down = (e: PointerEvent) => {
      if (decorative || active || world.current.phase !== "playing") return;
      e.preventDefault();
      const p = point(e);
      active = { id: e.pointerId, start: p, end: p };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (active?.id !== e.pointerId) return;
      e.preventDefault();
      active.end = point(e);
      input.current = {
        x: (active.end.x - active.start.x) / 40,
        y: (active.end.y - active.start.y) / 40,
      };
    };
    const up = (e: PointerEvent) => {
      if (active?.id !== e.pointerId) return;
      active = null;
      input.current = { x: 0, y: 0 };
    };
    const clear = () => {
      active = null;
      input.current = { x: 0, y: 0 };
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", clear);
    window.addEventListener("blur", clear);
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (document.hidden) return;
      const w = world.current;
      const dpr = canvas.width / width;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, width, height);
      c.fillStyle = "#0a1819";
      c.fillRect(0, 0, width, height);
      const scale = Math.min(width / SIZE, height / SIZE),
        ox = (width - SIZE * scale) / 2,
        oy = (height - SIZE * scale) / 2;
      c.translate(ox, oy);
      c.scale(scale, scale);
      const g = c.createRadialGradient(450, 450, 30, 450, 450, 480);
      g.addColorStop(0, "#193e35");
      g.addColorStop(1, "#0a1819");
      c.fillStyle = g;
      c.fillRect(0, 0, SIZE, SIZE);
      c.lineWidth = 1;
      c.strokeStyle = "#91c9b00c";
      for (let n = 0; n <= 900; n += 45) {
        c.beginPath();
        c.moveTo(n, 0);
        c.lineTo(n, 900);
        c.moveTo(0, n);
        c.lineTo(900, n);
        c.stroke();
      }
      c.strokeStyle = "#739c8820";
      c.setLineDash([3, 10]);
      c.beginPath();
      c.arc(450, 450, 365, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.font = "11px monospace";
      c.fillStyle = "#5e8070";
      c.fillText("SECURE PERIMETER / TOKYO-01", 42, 54);
      c.fillText("PRODUCTION NETWORK", 42, 858);
      for (const f of w.facilities) {
        c.strokeStyle = f.active ? "#a5e78b50" : "#6d8d7730";
        c.lineWidth = f.active ? 2 : 1;
        c.setLineDash(f.active ? [] : [6, 8]);
        c.beginPath();
        c.moveTo(450, 450);
        c.lineTo(f.x, f.y);
        c.stroke();
        c.setLineDash([]);
        if (!f.active) {
          c.strokeStyle = "#c0df9a18";
          c.beginPath();
          c.arc(f.x, f.y, 78, 0, Math.PI * 2);
          c.stroke();
          if (f.progress > 0) {
            c.strokeStyle = "#c3f18d";
            c.lineWidth = 4;
            c.beginPath();
            c.arc(
              f.x,
              f.y,
              43,
              -Math.PI / 2,
              -Math.PI / 2 + Math.PI * 2 * f.progress,
            );
            c.stroke();
          }
        }
        hex(c, f.x, f.y, 35);
        c.fillStyle = f.active ? "#234b3a" : "#182a29";
        c.fill();
        c.strokeStyle = f.active ? "#b9e990" : "#5d7870";
        c.lineWidth = 2;
        c.stroke();
        c.textAlign = "center";
        c.font = "bold 15px monospace";
        c.fillStyle = f.active ? "#daf6af" : "#afc4b6";
        c.fillText(f.name, f.x, f.y + 5);
        c.font = "10px monospace";
        c.fillStyle = f.active ? "#b8da94" : "#809789";
        c.fillText(
          f.active ? "ONLINE" : `${Math.floor(f.progress * 100)}% / 救援`,
          f.x,
          f.y + 57,
        );
        if (f.active) {
          c.fillStyle = "#132823";
          c.fillRect(f.x - 24, f.y + 26, 48, 3);
          c.fillStyle = "#b7de8d";
          c.fillRect(f.x - 24, f.y + 26, (48 * f.hp) / 100, 3);
        }
      }
      c.textAlign = "center";
      c.strokeStyle = "#8fe4ca40";
      c.lineWidth = 1;
      hex(c, 450, 450, 76);
      c.stroke();
      hex(c, 450, 450, 60);
      c.fillStyle = "#16362e";
      c.fill();
      c.strokeStyle = w.core < 30 ? "#ff7b93" : "#c6e5ab";
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = "#c8e8ae";
      c.font = "bold 12px monospace";
      c.fillText("PRODUCTION", 450, 442);
      c.font = "bold 24px monospace";
      c.fillText("CORE", 450, 465);
      c.font = "10px monospace";
      c.fillStyle = "#7d9c87";
      c.fillText("DO NOT LET IT FALL", 450, 548);
      if (w.shield > 0) {
        c.strokeStyle = "#a0dfc160";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(
          450,
          450,
          84,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * w.shield) / 46,
        );
        c.stroke();
      }
      for (const log of w.logs) {
        c.fillStyle = "#c4ef8a";
        c.save();
        c.translate(log.x, log.y);
        c.rotate(Math.PI / 4);
        c.fillRect(-3, -3, 6, 6);
        c.restore();
      }
      for (const e of w.enemies) {
        const color = colors[e.kind];
        c.save();
        c.translate(e.x, e.y);
        const r = e.kind === "zero" ? 29 : e.kind === "ransom" ? 19 : 12;
        c.fillStyle =
          e.hitAt > w.time - 0.08 && !reduced ? "#e8f3da" : "#211e28";
        c.strokeStyle = color;
        c.lineWidth = e.kind === "zero" ? 3 : 1.8;
        if (e.kind === "phish") {
          c.beginPath();
          c.rect(-13, -9, 26, 18);
          c.fill();
          c.stroke();
          c.beginPath();
          c.moveTo(-13, -9);
          c.lineTo(0, 2);
          c.lineTo(13, -9);
          c.stroke();
        } else if (e.kind === "inject") {
          c.beginPath();
          c.moveTo(0, -17);
          c.lineTo(10, 12);
          c.lineTo(0, 7);
          c.lineTo(-10, 12);
          c.closePath();
          c.fill();
          c.stroke();
        } else {
          hex(c, 0, 0, r);
          c.fill();
          c.stroke();
          c.fillStyle = color;
          c.fillRect(-6, -3, 3, 3);
          c.fillRect(3, -3, 3, 3);
          if (e.kind === "zero") {
            hex(c, 0, 0, r + 7);
            c.stroke();
            c.font = "bold 9px monospace";
            c.textAlign = "center";
            c.fillText("ZERO DAY", 0, -44);
          }
        }
        if (e.hp < e.maxHp) {
          c.fillStyle = "#303131";
          c.fillRect(-r, r + 5, r * 2, 3);
          c.fillStyle = color;
          c.fillRect(-r, r + 5, (r * 2 * e.hp) / e.maxHp, 3);
        }
        c.restore();
      }
      for (const f of w.effects) {
        const a = f.life / f.max;
        c.globalAlpha = a;
        c.strokeStyle = f.color;
        c.fillStyle = f.color;
        c.lineWidth = f.kind === "beam" ? 2 : 3;
        if (f.kind === "beam" && f.end) {
          c.beginPath();
          c.moveTo(f.x, f.y);
          c.lineTo(f.end.x, f.end.y);
          c.stroke();
        } else if (f.kind === "ring") {
          c.beginPath();
          c.arc(f.x, f.y, (1 - a) * 310 + 15, 0, Math.PI * 2);
          c.stroke();
        } else if (f.kind === "blast") {
          const radius = (1 - a) * 38 + 5;
          c.beginPath();
          c.arc(f.x, f.y, radius, 0, Math.PI * 2);
          c.stroke();
          if (!reduced)
            for (let n = 0; n < 6; n++) {
              const angle = (n * Math.PI) / 3;
              c.fillRect(
                f.x + Math.cos(angle) * radius - 2,
                f.y + Math.sin(angle) * radius - 2,
                4,
                4,
              );
            }
        } else {
          c.beginPath();
          c.arc(f.x, f.y, (1 - a) * 18 + 3, 0, Math.PI * 2);
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      const p = w.player;
      c.save();
      c.translate(p.x, p.y);
      if (!reduced && w.time < w.overdriveUntil) {
        c.strokeStyle = "#d6f88780";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, 28 + Math.sin(w.time * 8) * 3, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = "#0b1f20";
      c.strokeStyle = w.time < p.invuln ? "#ffb6b8" : "#daefc6";
      c.lineWidth = 2.5;
      hex(c, 0, 0, 19);
      c.fill();
      c.stroke();
      c.fillStyle = "#c3f28b";
      c.fillRect(-9, -5, 6, 4);
      c.fillRect(3, -5, 6, 4);
      c.strokeStyle = "#a8c7b7";
      c.beginPath();
      c.moveTo(-4, 7);
      c.lineTo(0, 10);
      c.lineTo(4, 7);
      c.stroke();
      c.fillStyle = "#285b49";
      c.strokeStyle = "#c1eb9d";
      hex(c, -20, 10, 11);
      c.fill();
      c.stroke();
      c.restore();
      if (active) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.strokeStyle = "#c5ee9e55";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(active.start.x, active.start.y, 40, 0, Math.PI * 2);
        c.stroke();
        const dx = active.end.x - active.start.x,
          dy = active.end.y - active.start.y,
          len = Math.max(40, Math.hypot(dx, dy));
        c.fillStyle = "#d5f4b980";
        c.beginPath();
        c.arc(
          active.start.x + (dx / len) * 30,
          active.start.y + (dy / len) * 30,
          14,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", clear);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, [world, input, reduced, decorative]);
  return (
    <canvas
      ref={ref}
      className="field"
      aria-label="防衛フィールド。ドラッグまたはWASD・矢印キーで移動"
      role={decorative ? undefined : "application"}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
