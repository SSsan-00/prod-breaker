import { describe, it, expect } from "vitest";
import {
  createWorld,
  step,
  choose,
  skills,
  recipes,
  ready,
  STEP,
  type World,
  type Input,
} from "../src/game/engine";
const tick = (w: World, n: number, input: Input = { x: 0, y: 0 }) => {
  for (let i = 0; i < n; i++) w = step(w, input);
  return w;
};
describe("deterministic defense simulation", () => {
  it("reproduces a seed and keeps the input world immutable", () => {
    const start = createWorld(42);
    const before = structuredClone(start);
    expect(tick(start, 500)).toEqual(tick(createWorld(42), 500));
    expect(start).toEqual(before);
  });
  it("normalizes diagonal and invalid movement and stays inside the map", () => {
    let w = createWorld(1);
    const next = step(w, { x: 1, y: 1 });
    expect(
      Math.hypot(next.player.x - w.player.x, next.player.y - w.player.y),
    ).toBeCloseTo(w.speed * STEP);
    w = tick(w, 500, { x: NaN, y: Infinity });
    expect(Number.isFinite(w.player.x)).toBe(true);
  });
  it("rescues facilities only when nearby and adds them to the defense", () => {
    let w = createWorld(2);
    w.player = { ...w.player, x: 240, y: 300 };
    w = tick(w, 82);
    expect(w.facilities[0].active).toBe(true);
    expect(w.facilities[1].progress).toBe(0);
    expect(w.core).toBeLessThanOrEqual(100);
    expect(w.xp).toBeGreaterThanOrEqual(4);
  });
  it("prevents repeated panic activation during cooldown", () => {
    let w = step(createWorld(3), { x: 0, y: 0, panic: true });
    w = tick(w, 30, { x: 0, y: 0, panic: true });
    expect(w.panicUses).toBe(1);
    expect(w.shield).toBeGreaterThan(30);
  });
  it("requires a valid offered choice and pauses simulation for upgrades", () => {
    const w = createWorld(1);
    expect(() => choose(w, "input")).toThrow();
    w.phase = "upgrade";
    w.choices = ["input"];
    expect(step(w, { x: 1, y: 1 })).toBe(w);
    expect(choose(w, "input").damage).toBe(w.damage + 7);
    expect(() => choose(w, "rules")).toThrow();
  });
  it("offers three distinct cards and an evolution partner when available", () => {
    let w = createWorld(5);
    w.time = 8;
    w.build = ["input"];
    w.xp = w.nextXp;
    w = step(w, { x: 0, y: 0 });
    expect(new Set(w.choices).size).toBe(3);
    expect(w.choices).toContain("prepared");
    expect(ready(w, "prepared")).toBeTruthy();
  });
  it("every recipe evolves once and every skill is functional", () => {
    for (const r of recipes) {
      let w = createWorld(2);
      w.build = [r.pair[0]];
      w.phase = "upgrade";
      w.choices = [r.pair[1]];
      w = choose(w, r.pair[1]);
      expect(w.evolutions).toContain(r.name);
      w.phase = "upgrade";
      w.choices = [r.pair[1]];
      w = choose(w, r.pair[1]);
      expect(w.evolutions.filter((n) => n === r.name)).toHaveLength(1);
    }
    for (const s of skills) {
      const w = createWorld(4);
      w.phase = "upgrade";
      w.choices = [s.id];
      expect(choose(w, s.id).build).toContain(s.id);
    }
  });
  it("bounds effects, enemies, logs, and hp in an unattended run", () => {
    let w = createWorld(99, 300);
    for (
      let n = 0;
      n < 9000 && (w.phase === "playing" || w.phase === "upgrade");
      n++
    ) {
      if (w.phase === "upgrade") w = choose(w, w.choices[0]);
      w = step(w, { x: 0, y: 0 });
      expect(w.enemies.length).toBeLessThanOrEqual(150);
      expect(w.effects.length).toBeLessThanOrEqual(100);
      expect(w.logs.length).toBeLessThanOrEqual(200);
      expect(w.core).toBeGreaterThanOrEqual(0);
      expect(w.player.hp).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(w.score)).toBe(true);
    }
    expect(["lost", "won"]).toContain(w.phase);
  });
  it("advances waves and spawns zero-day bosses", () => {
    const w = createWorld(1);
    w.time = 29.99;
    const next = step(w, { x: 0, y: 0 });
    expect(next.wave).toBe(2);
    expect(next.enemies.some((e) => e.kind === "zero")).toBe(true);
    expect(next.notice).toContain("WAVE 02");
  });
  it("completes each selected shift at its deadline", () => {
    for (const duration of [90, 180, 300]) {
      const w = createWorld(1, duration);
      w.time = duration - STEP / 2;
      expect(step(w, { x: 0, y: 0 }).phase).toBe("won");
    }
  });
  it("converts capped rate, projectile and pierce upgrades to damage", () => {
    const w = createWorld(1);
    w.phase = "upgrade";
    w.choices = ["rate"];
    w.interval = 0.12;
    expect(choose(w, "rate").interval).toBe(0.12);
    expect(choose(w, "rate").damage).toBeGreaterThan(w.damage + 3);
  });
});

it("spaces burst XP upgrades by eight active seconds without losing XP", () => {
  let w = createWorld(42);
  w.xp = 1000;
  w = step(w, {x:0,y:0,panic:true});
  expect(w.phase).toBe("playing");
  while(w.phase === "playing" && w.time < 9) w=step(w,{x:0,y:0});
  expect(w.phase).toBe("upgrade");
  expect(w.time).toBeGreaterThanOrEqual(8);
  w=choose(w,w.choices[0]);
  const xp=w.xp;
  for(let i=0;i<210;i++)w=step(w,{x:0,y:0});
  expect(w.phase).toBe("playing");
  expect(w.xp).toBeGreaterThanOrEqual(xp);
});
