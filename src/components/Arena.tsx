"use client";
import { useEffect, useRef, type RefObject } from "react";
import type { World, Vec } from "@/game/survivor";
export type Stick = { active: boolean; origin: Vec; current: Vec };
type Props = {
  world: RefObject<World>;
  input: RefObject<Vec>;
  reduced: boolean;
  stick: RefObject<Stick>;
  onBlur: () => void;
};
const colors = {
  lime: "#d4fa53",
  orange: "#ff8b50",
  blue: "#73d9ff",
  red: "#ff596d",
};
export default function Arena({
  world: worldRef,
  input: inputRef,
  reduced,
  stick: stickRef,
  onBlur,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const box = canvas.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
    });
    observer.observe(canvas);
    function draw() {
      if (!canvas || !ctx) return;
      if (!document.hidden) {
        const box = canvas.getBoundingClientRect();
        if (!box.width || !box.height) {
          frame = requestAnimationFrame(draw);
          return;
        }
        const w = worldRef.current;
        const dpr = canvas.width / box.width;
        const width = box.width,
          height = box.height;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#080f12";
        ctx.fillRect(0, 0, width, height);
        const scale = width / (width < 600 ? 650 : 1050);
        const p = w.player;
        const shake =
          !reduced &&
          (w.effects.some((e) => e.kind === "panic") ||
            (w.combo >= 30 &&
              w.effects.some((e) => e.kind === "explosion" && e.life > 0.55)))
            ? Math.sin(w.time * 100) * (w.combo >= 100 ? 4 : 2)
            : 0;
        ctx.save();
        ctx.translate(width / 2 + shake, height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-p.x, -p.y);
        const left = p.x - width / scale / 2,
          top = p.y - height / scale / 2,
          right = left + width / scale,
          bottom = top + height / scale;
        const floorGlow = ctx.createRadialGradient(
          p.x,
          p.y,
          30,
          p.x,
          p.y,
          (Math.max(width, height) / scale) * 0.75,
        );
        floorGlow.addColorStop(0, "#142826");
        floorGlow.addColorStop(1, "#080f12");
        ctx.fillStyle = floorGlow;
        ctx.fillRect(left, top, right - left, bottom - top);
        ctx.strokeStyle = "#19272b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = Math.floor(left / 60) * 60; x < right; x += 60) {
          ctx.moveTo(x, top);
          ctx.lineTo(x, bottom);
        }
        for (let y = Math.floor(top / 60) * 60; y < bottom; y += 60) {
          ctx.moveTo(left, y);
          ctx.lineTo(right, y);
        }
        ctx.stroke();
        ctx.strokeStyle = "#293933";
        ctx.setLineDash([5, 10]);
        ctx.strokeRect(20, 20, 1960, 1960);
        ctx.setLineDash([]);
        ctx.font = "10px monospace";
        ctx.fillStyle = "#293c36";
        for (let x = Math.floor(left / 400) * 400; x < right; x += 400)
          for (let y = Math.floor(top / 300) * 300; y < bottom; y += 300) {
            ctx.fillText(
              `SECTOR ${Math.floor(x / 400)}:${Math.floor(y / 300)} / PROD`,
              x + 20,
              y + 22,
            );
            ctx.fillRect(x + 20, y + 30, 24, 2);
          }
        // Nearby servers form a visible dependency network.
        const servers = w.entities.filter((e) => e.kind === "server");
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#314139";
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        for (let i = 0; i < servers.length; i++)
          for (let j = i + 1; j < servers.length; j++)
            if (
              Math.hypot(
                servers[i].x - servers[j].x,
                servers[i].y - servers[j].y,
              ) < 165
            ) {
              ctx.moveTo(servers[i].x, servers[i].y);
              ctx.lineTo(servers[j].x, servers[j].y);
            }
        ctx.stroke();
        ctx.setLineDash([]);
        if (w.aura > 0) {
          ctx.fillStyle = "#6b73ff12";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 125, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#8995ff55";
          ctx.stroke();
        }
        for (const gem of w.pickups) {
          ctx.fillStyle = "#73d9ff";
          ctx.save();
          ctx.translate(gem.x, gem.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-4, -4, 8, 8);
          ctx.fillStyle = "#dcf7ff";
          ctx.fillRect(-2, -2, 3, 3);
          ctx.restore();
        }
        for (const e of w.entities) {
          if (
            e.x < left - 60 ||
            e.x > right + 60 ||
            e.y < top - 60 ||
            e.y > bottom + 60
          )
            continue;
          const c =
            e.kind === "server"
              ? e.hp / e.maxHp > 0.6
                ? "#a8cf70"
                : e.hp / e.maxHp > 0.3
                  ? "#f1d26c"
                  : "#ff8050"
              : e.kind === "repair"
                ? "#6edbc7"
                : "#ff596d";
          ctx.save();
          ctx.translate(Math.round(e.x), Math.round(e.y));
          ctx.fillStyle = "#0006";
          ctx.fillRect(-23, 19, 48, 8);
          if (e.kind === "server") {
            const metal = ctx.createLinearGradient(-21, -25, 21, 23);
            metal.addColorStop(0, "#415750");
            metal.addColorStop(0.45, "#172a28");
            metal.addColorStop(1, "#091311");
            ctx.fillStyle = metal;
            ctx.fillRect(-21, -25, 42, 48);
            ctx.strokeStyle = c;
            ctx.lineWidth = 2;
            ctx.strokeRect(-21, -25, 42, 48);
            for (let k = 0; k < 3; k++) {
              ctx.fillStyle = "#203431";
              ctx.fillRect(-15, -18 + k * 12, 30, 8);
              ctx.fillStyle = c;
              ctx.fillRect(9, -16 + k * 12, 3, 3);
              ctx.fillStyle = "#4b6454";
              ctx.fillRect(-11, -15 + k * 12, 13, 2);
            }
            ctx.fillStyle = c;
            ctx.font = "9px monospace";
            ctx.textAlign = "center";
            ctx.fillText(e.label, 0, 39);
          } else if (e.kind === "boss") {
            const armor = ctx.createLinearGradient(-36, -36, 36, 36);
            armor.addColorStop(0, "#8e4650");
            armor.addColorStop(0.4, "#39141e");
            armor.addColorStop(1, "#110c15");
            ctx.fillStyle = armor;
            ctx.strokeStyle = colors.red;
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
              const a = (i * Math.PI) / 4;
              const x = Math.cos(a) * 36,
                y = Math.sin(a) * 36;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#1c1018";
            ctx.fillRect(-18, -16, 36, 30);
            ctx.strokeStyle = "#c45b63";
            ctx.lineWidth = 1;
            ctx.strokeRect(-18, -16, 36, 30);
            ctx.fillStyle = "#ff6570";
            ctx.fillRect(-12, -7, 8, 4);
            ctx.fillRect(4, -7, 8, 4);
            ctx.fillStyle = "#ffb49b";
            ctx.fillRect(-10, -7, 4, 2);
            ctx.fillRect(6, -7, 4, 2);
            ctx.fillStyle = "#773b43";
            ctx.fillRect(-9, 5, 18, 2);
            ctx.font = "bold 10px monospace";
            ctx.textAlign = "center";
            ctx.fillStyle = "#ff9aa7";
            ctx.fillText("SRE CORE", 0, -49);
          } else {
            ctx.fillStyle = e.kind === "repair" ? "#13352f" : "#331925";
            ctx.fillRect(-14, -14, 28, 28);
            ctx.strokeStyle = c;
            ctx.lineWidth = 2;
            ctx.strokeRect(-14, -14, 28, 28);
            ctx.fillStyle = c;
            if (e.kind === "repair") {
              ctx.fillRect(-8, -3, 16, 6);
              ctx.fillRect(-3, -8, 6, 16);
            } else {
              ctx.fillRect(-21, -5, 7, 3);
              ctx.fillRect(14, -5, 7, 3);
              ctx.fillRect(-21, 5, 7, 3);
              ctx.fillRect(14, 5, 7, 3);
              ctx.fillRect(-8, -5, 5, 5);
              ctx.fillRect(4, -5, 5, 5);
            }
          }
          if (e.hp < e.maxHp) {
            ctx.fillStyle = "#293437";
            ctx.fillRect(-20, -34, 40, 3);
            ctx.fillStyle = c;
            ctx.fillRect(-20, -34, (40 * e.hp) / e.maxHp, 3);
          }
          if (e.flash > 0 && !reduced) {
            ctx.fillStyle = "#fff5";
            ctx.fillRect(-20, -24, 40, 48);
          }
          ctx.restore();
        }
        for (const shot of w.shots) {
          if (!reduced && width >= 600) {
            ctx.shadowColor = colors.lime;
            ctx.shadowBlur = 8;
          }
          ctx.strokeStyle = colors.lime;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(shot.x - shot.vx * 0.026, shot.y - shot.vy * 0.026);
          ctx.lineTo(shot.x, shot.y);
          ctx.stroke();
          ctx.fillStyle = "#f5ffda";
          ctx.fillRect(shot.x - 2, shot.y - 2, 4, 4);
          ctx.shadowBlur = 0;
        }
        // The bug is always visibly distinct from servers and chasing drones.
        ctx.save();
        ctx.translate(Math.round(p.x), Math.round(p.y));
        if (p.invulnerable > 0) {
          ctx.strokeStyle = "#d4fa5380";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 26, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (w.time < w.overdriveUntil) {
          ctx.strokeStyle = reduced ? "#b4dc75" : "#7de6ff";
          ctx.lineWidth = 2;
          ctx.setLineDash([7, 5]);
          ctx.beginPath();
          ctx.arc(0, 0, 31 + (reduced ? 0 : Math.sin(w.time * 8) * 2), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Compact robot silhouette matches the home-screen mascot.
        ctx.fillStyle = "#0008";
        ctx.beginPath();
        ctx.ellipse(0, 22, 19, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#6a9845";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        for (const y of [-6, 5]) {
          ctx.beginPath();
          ctx.moveTo(-13, y); ctx.lineTo(-20, y);
          ctx.moveTo(13, y); ctx.lineTo(20, y);
          ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(0, -24); ctx.stroke();
        ctx.fillStyle = "#dfff9d";
        ctx.beginPath(); ctx.arc(0, -25, 2, 0, Math.PI * 2); ctx.fill();
        const shell = ctx.createLinearGradient(-14, -18, 14, 19);
        shell.addColorStop(0, "#e6ffa5");
        shell.addColorStop(0.5, "#a2d54f");
        shell.addColorStop(1, "#52782d");
        ctx.fillStyle = shell;
        ctx.strokeStyle = "#294b2c";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-14, -18, 28, 38, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#142e25";
        ctx.beginPath(); ctx.roundRect(-11, -12, 22, 17, 4); ctx.fill();
        ctx.fillStyle = "#e5ffa8";
        ctx.beginPath();
        ctx.moveTo(-8, -9); ctx.lineTo(-3, -7); ctx.lineTo(-3, -3); ctx.lineTo(-8, -3); ctx.closePath();
        ctx.moveTo(8, -9); ctx.lineTo(3, -7); ctx.lineTo(3, -3); ctx.lineTo(8, -3); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#b4e77e";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-3, 1); ctx.quadraticCurveTo(0, 4, 4, 0); ctx.stroke();
        ctx.fillStyle = "#588e3e";
        ctx.fillRect(-8, 11, 9, 2);
        ctx.fillStyle = "#a9f2ed";
        ctx.fillRect(6, 11, 3, 3);
        ctx.restore();
        let brightBursts = 0;
        for (const e of w.effects) {
          const progress = 1 - e.life / e.maxLife;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - progress);
          if (e.kind === "arc" && e.to) {
            ctx.strokeStyle = colors.blue;
            if (!reduced && width >= 600) {
              ctx.shadowColor = colors.blue;
              ctx.shadowBlur = 12;
            }
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            const midx = (e.x + e.to.x) / 2,
              midy = (e.y + e.to.y) / 2;
            ctx.lineTo(midx + Math.sin(e.id) * 14, midy - 10);
            ctx.lineTo(e.to.x, e.to.y);
            ctx.stroke();
            if (!reduced) {
              const t = Math.min(1, progress * 1.5);
              ctx.fillStyle = "#ecffff";
              ctx.beginPath();
              ctx.arc(e.x + (e.to.x - e.x) * t, e.y + (e.to.y - e.y) * t, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (e.kind === "explosion") {
            if (!reduced) {
              if (brightBursts++ < (width < 600 ? 3 : 8)) {
                const glow = ctx.createRadialGradient(
                  e.x,
                  e.y,
                  0,
                  e.x,
                  e.y,
                  70 + progress * 45,
                );
                glow.addColorStop(0, "#fff2baaa");
                glow.addColorStop(0.2, "#ff913a77");
                glow.addColorStop(1, "#ff3c1900");
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(e.x, e.y, 70 + progress * 45, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.strokeStyle = colors.orange;
              ctx.lineWidth = 3 * (1 - progress);
              ctx.beginPath();
              ctx.arc(e.x, e.y, 12 + progress * 65, 0, Math.PI * 2);
              ctx.stroke();
              ctx.strokeStyle = "#ffe9a4";
              ctx.lineWidth = 2 * (1 - progress);
              ctx.beginPath();
              ctx.arc(e.x, e.y, 6 + progress * 42, 0, Math.PI * 2);
              ctx.stroke();
              const count = width < 600 ? 12 : 22;
              for (let i = 0; i < count; i++) {
                const a = i * 2.4 + e.id;
                const radius = progress * (25 + (i % 5) * 15);
                ctx.fillStyle = i % 3 ? "#ff8b50" : "#fff2b0";
                ctx.fillRect(
                  e.x + Math.cos(a) * radius,
                  e.y + Math.sin(a) * radius,
                  4,
                  4,
                );
              }
            }
            ctx.fillStyle = colors.orange;
            ctx.font = "bold 13px monospace";
            ctx.textAlign = "center";
            ctx.fillText(e.text, e.x, e.y - 30 - (reduced ? 0 : progress * 30));
          } else if (e.kind === "milestone") {
            if (!reduced) {
              ctx.strokeStyle = "#d4fa53";
              ctx.lineWidth = 4 * (1 - progress);
              ctx.beginPath();
              ctx.arc(e.x, e.y, 25 + progress * 130, 0, Math.PI * 2);
              ctx.stroke();
              ctx.strokeStyle = "#73d9ff";
              ctx.lineWidth = 2 * (1 - progress);
              ctx.beginPath();
              ctx.arc(e.x, e.y, 15 + progress * 95, 0, Math.PI * 2);
              ctx.stroke();
              const rays = width < 600 ? 8 : 14;
              for (let i = 0; i < rays; i++) {
                const angle = i * Math.PI * 2 / rays + e.id;
                const radius = 35 + progress * 95;
                ctx.strokeStyle = i % 2 ? "#ffe4a0" : "#a4f2ff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(e.x + Math.cos(angle) * radius, e.y + Math.sin(angle) * radius);
                ctx.lineTo(e.x + Math.cos(angle) * (radius + 14 * (1 - progress)), e.y + Math.sin(angle) * (radius + 14 * (1 - progress)));
                ctx.stroke();
              }
            }
            ctx.fillStyle = "#efffb4";
            ctx.font = "bold 18px monospace";
            ctx.textAlign = "center";
            ctx.fillText(e.text, e.x, e.y - 55 - (reduced ? 0 : progress * 20));
          } else if (e.kind === "panic") {
            if (!reduced) {
              ctx.strokeStyle = colors.lime;
              ctx.lineWidth = 5 * (1 - progress);
              ctx.beginPath();
              ctx.arc(e.x, e.y, progress * 460, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else if (e.text) {
            ctx.fillStyle = e.kind === "heal" ? colors.lime : colors.red;
            ctx.font = "11px monospace";
            ctx.textAlign = "center";
            ctx.fillText(e.text, e.x, e.y - 40);
          }
          ctx.restore();
        }
        ctx.restore();
        // Radar and pointer joystick use screen coordinates.
        const radar = width < 600 ? 65 : 82;
        ctx.fillStyle = "#081114dd";
        ctx.fillRect(width - radar - 14, 14, radar, radar);
        ctx.strokeStyle = "#3f5146";
        ctx.strokeRect(width - radar - 14, 14, radar, radar);
        for (const e of w.entities) {
          ctx.fillStyle = e.kind === "server" ? "#6d8e4a" : colors.red;
          ctx.fillRect(
            width - radar - 14 + (e.x / 2000) * radar,
            14 + (e.y / 2000) * radar,
            2,
            2,
          );
        }
        ctx.fillStyle = colors.lime;
        ctx.fillRect(
          width - radar - 15 + (p.x / 2000) * radar,
          13 + (p.y / 2000) * radar,
          4,
          4,
        );
        if (stickRef.current.active) {
          const { origin, current } = stickRef.current;
          ctx.strokeStyle = "#d4fa5360";
          ctx.lineWidth = 2;
          ctx.fillStyle = "#d4fa5311";
          ctx.beginPath();
          ctx.arc(origin.x, origin.y, 44, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          const dx = current.x - origin.x,
            dy = current.y - origin.y,
            d = Math.max(1, Math.hypot(dx, dy) / 36);
          ctx.fillStyle = "#d4fa5380";
          ctx.beginPath();
          ctx.arc(origin.x + dx / d, origin.y + dy / d, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [worldRef, stickRef, reduced]);
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }
  function release() {
    stickRef.current.active = false;
    inputRef.current = { x: 0, y: 0 };
  }
  return (
    <canvas
      ref={ref}
      className="arena-canvas"
      tabIndex={0}
      role="application"
      aria-label="ゲームフィールド。WASD・矢印キー、またはドラッグで移動。攻撃は自動。スペースでPANIC。"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = point(e);
        stickRef.current = { active: true, origin: p, current: p };
      }}
      onPointerMove={(e) => {
        if (!stickRef.current.active) return;
        const p = point(e);
        stickRef.current.current = p;
        inputRef.current = {
          x: (p.x - stickRef.current.origin.x) / 44,
          y: (p.y - stickRef.current.origin.y) / 44,
        };
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onBlur={() => {
        release();
        onBlur();
      }}
    />
  );
}
