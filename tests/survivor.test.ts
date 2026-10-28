import { describe, it, expect, vi } from "vitest";
import {
  chainPower,
  createWorld,
  stepWorld,
  chooseUpgrade,
  upgrades,
  evolutionPartners,
  survivorReport,
  STEP,
  wave,
  RUN_SECONDS,
  type World,
} from "../src/game/survivor";
import { read, write } from "../src/lib/storage";
function simulate(w: World, frames: number) {
  for (let i = 0; i < frames; i++) {
    if (w.phase === "upgrade") w = chooseUpgrade(w, w.choices[0]);
    w = stepWorld(w, { x: Math.cos(i / 120), y: Math.sin(i / 120) });
  }
  return w;
}
describe("survivor fixed-step engine", () => {
  it("rewards chain milestones with predictable propagation power", () => {
    expect([0, 9, 10, 29, 30, 100].map(chainPower)).toEqual([1, 1, 1.25, 1.25, 1.5, 1.5]);
    const w = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    if (w.combo >= 10) expect(w.effects.some((e) => e.kind === "milestone")).toBe(true);
  });
  it("supports all durations and finishes at the selected time", () => {
    for (const duration of [90, 180, 300]) {
      const w = createWorld(42, duration);
      expect(w.duration).toBe(duration);
      w.time = duration - STEP / 2;
      expect(stepWorld(w, { x: 0, y: 0 }).phase).toBe("won");
    }
    expect(createWorld(42, 120).duration).toBe(90);
  });
  it("unlocks each evolution exactly once in either order", () => {
    const recipes = [
      ["retry", "timeout", "リトライストーム"],
      ["nplus", "leak", "コネクション枯渇祭り"],
      ["hotfix", "friday", "週末リリース"],
      ["threshold", "flush", "完全に正常"],
      ["select", "where", "全件フルスキャン"],
      ["force", "config", "本番直編集"],
      ["oncall", "rollback", "真夜中の復旧会議"],
      ["spec", "local", "動くから仕様"],
      ["cron", "batch", "二重起動フェスティバル"],
      ["migration", "index", "ロック待ちの行列"],
      ["feature", "canary", "全員カナリア"],
      ["cert", "clock", "期限切れタイムリープ"],
      ["approval", "review", "承認済みということにする"],
      ["autoscale", "quota", "無限スケール上限"],
      ["schema", "contract", "互換性は来世で"],
      ["meeting", "reboot", "再起動の承認会議"],
      ["staging", "drift", "環境差分パラダイス"],
      ["lockfile", "latest", "再現不能ビルド"],
      ["timezone", "midnight", "世界同時バッチ祭り"],
      ["secrets", "clipboard", "秘伝の設定コピペ"],
      ["terraform", "manual", "存在しないインフラ"],
    ] as const;
    expect(recipes).toHaveLength(21);
    expect(upgrades).toHaveLength(56);
    for (const [a, b, name] of recipes) {
      expect(evolutionPartners[a]).toBe(b);
      expect(evolutionPartners[b]).toBe(a);
      for (const order of [
        [a, b, a],
        [b, a, a],
      ] as const) {
        let w = createWorld();
        for (const id of order) {
          w.phase = "upgrade";
          w.choices = [id];
          w = chooseUpgrade(w, id);
        }
        expect(w.evolutions.filter((x) => x === name)).toHaveLength(1);
      }
    }
  });
  it("produces deterministic varied reports even for highly destructive runs", () => {
    const reports = Array.from({ length: 100 }, (_, seed) => {
      const w = createWorld(seed);
      w.destroyed = 120;
      w.maxCombo = 80;
      w.build = ["friday", "retry"];
      return survivorReport(w);
    });
    expect(new Set(reports.map((r) => r.title)).size).toBeGreaterThan(5);
    expect(new Set(reports.map((r) => r.cause)).size).toBeGreaterThan(8);
    expect(new Set(reports.map((r) => r.prevention)).size).toBeGreaterThan(8);
    const w = createWorld(7);
    w.destroyed = 120;
    expect(survivorReport(w)).toEqual(survivorReport(w));
    const before = Array.from({ length: 100 }, (_, seed) => {
      const state = createWorld(seed);
      state.destroyed = 79;
      return survivorReport(state).title;
    });
    const after = Array.from({ length: 100 }, (_, seed) => {
      const state = createWorld(seed);
      state.destroyed = 80;
      return survivorReport(state).title;
    });
    expect(before).not.toContain("本番の破壊神");
    expect(after).toContain("本番の破壊神");
  });
  it("is reproducible and never mutates its input", () => {
    const a = createWorld(123),
      before = structuredClone(a);
    expect(simulate(a, 300)).toEqual(simulate(createWorld(123), 300));
    expect(a).toEqual(before);
    expect(createWorld(124).entities).not.toEqual(a.entities);
  });
  it("moves continuously and normalizes diagonal input", () => {
    const a = createWorld();
    const b = stepWorld(a, { x: 1, y: 1 });
    expect(
      Math.hypot(b.player.x - a.player.x, b.player.y - a.player.y),
    ).toBeCloseTo(a.speed * STEP);
    expect(b.time).toBeCloseTo(STEP);
    expect(a.time).toBe(0);
  });
  it("clamps movement at world bounds and rejects nonfinite movement", () => {
    const a = createWorld();
    a.player.x = 1972;
    expect(stepWorld(a, { x: 1, y: 0 }).player.x).toBe(1972);
    expect(stepWorld(a, { x: NaN, y: Infinity }).player.x).toBe(1972);
  });
  it("automatically fires without an attack input", () => {
    const a = stepWorld(createWorld(), { x: 0, y: 0 });
    expect(a.shots.length).toBeGreaterThan(0);
    expect(a.entities.length).toBeGreaterThan(7);
  });
  it("creates a bounded chain, scores destruction, and vacuums XP with PANIC", () => {
    const a = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    expect(a.panicUses).toBe(1);
    expect(a.destroyed).toBeGreaterThanOrEqual(7);
    expect(a.maxCombo).toBeGreaterThanOrEqual(7);
    expect(a.score).toBeGreaterThan(0);
    expect(a.phase).toBe("upgrade");
    expect(a.choices).toHaveLength(3);
    expect(new Set(a.choices).size).toBe(3);
  });
  it("spaces opening upgrades while preserving earned XP", () => {
    let w = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    expect(w.phase).toBe("upgrade");
    const firstTime = w.time;
    w = chooseUpgrade(w, w.choices[0]);
    w.xp = 1000;
    const banked = w.xp;
    for (let i = 0; i < 150; i++) {
      w = stepWorld(w, { x: 0, y: 0 });
      expect(w.phase).toBe("playing");
    }
    expect(w.xp).toBeGreaterThanOrEqual(banked);
    while (w.phase === "playing" && w.time < firstTime + 7)
      w = stepWorld(w, { x: 0, y: 0 });
    expect(w.phase).toBe("upgrade");
    expect(w.time - firstTime).toBeGreaterThanOrEqual(6);
    expect(w.xp).toBeGreaterThan(0);
  });
  it("prevents repeated panic during cooldown", () => {
    let a = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    a = chooseUpgrade(a, a.choices[0]);
    for (let i = 0; i < 30; i++) {
      if (a.phase === "upgrade") a = chooseUpgrade(a, a.choices[0]);
      a = stepWorld(a, { x: 0, y: 0, panic: true });
    }
    expect(a.panicUses).toBe(1);
    expect(a.panicCooldown).toBeGreaterThan(20);
  });
  it("pauses simulation during upgrade and validates choices", () => {
    const a = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    expect(stepWorld(a, { x: 1, y: 0 })).toBe(a);
    const missing = upgrades.find((u) => !a.choices.includes(u.id))!;
    expect(() => chooseUpgrade(a, missing.id)).toThrow();
    const b = chooseUpgrade(a, a.choices[0]);
    expect(b.phase).toBe("playing");
    expect(b.build).toHaveLength(1);
    expect(a.build).toHaveLength(0);
  });
  it("applies every upgrade effect", () => {
    for (const u of upgrades) {
      const a = createWorld();
      a.phase = "upgrade";
      a.choices = [u.id];
      const b = chooseUpgrade(a, u.id);
      expect(b.build).toContain(u.id);
      expect(b.choices).toEqual([]);
      expect(b.phase).toBe("playing");
      expect(b.player.hp).toBeLessThanOrEqual(b.player.maxHp);
      const stats = (w: World) => [
        w.damage,
        w.fireInterval,
        w.multishot,
        w.pierce,
        w.speed,
        w.magnet,
        w.chainRange,
        w.chainDamage,
        w.multiplier,
        w.aura,
        w.slow,
        w.player.hp,
        w.player.maxHp,
      ];
      expect(stats(b), `${u.name} must have a gameplay effect`).not.toEqual(
        stats(a),
      );
    }
  });
  it("caps fire rate, shots, movement speed and chain radius", () => {
    let a = createWorld();
    for (let i = 0; i < 30; i++)
      for (const id of ["test", "cache", "env", "retry"] as const) {
        a.phase = "upgrade";
        a.choices = [id];
        a = chooseUpgrade(a, id);
      }
    expect(a.fireInterval).toBeGreaterThanOrEqual(0.12);
    expect(a.multishot).toBeLessThanOrEqual(6);
    expect(a.speed).toBeLessThanOrEqual(340);
    expect(a.chainRange).toBeLessThanOrEqual(400);
  });
  it("attracts and collects nearby logs", () => {
    const a = createWorld();
    a.pickups = [{ id: 999, x: a.player.x + 60, y: a.player.y, value: 2 }];
    let b = a;
    for (let i = 0; i < 10; i++) b = stepWorld(b, { x: 0, y: 0 });
    expect(b.xp).toBe(2);
    expect(b.pickups.some((p) => p.id === 999)).toBe(false);
  });
  it("chasing enemies cause contact damage with an immunity window", () => {
    const a = createWorld();
    a.entities = [
      {
        id: 999,
        x: 1000,
        y: 1000,
        hp: 1000,
        maxHp: 1000,
        kind: "drone",
        label: "WAF",
        flash: 0,
      },
    ];
    const b = stepWorld(a, { x: 0, y: 0 });
    expect(b.player.hp).toBe(88);
    expect(stepWorld(b, { x: 0, y: 0 }).player.hp).toBe(88);
  });
  it("repair bots restore damaged services", () => {
    const a = createWorld();
    a.shotTimer = 10;
    a.entities = [
      {
        id: 1,
        x: 1100,
        y: 1000,
        hp: 10,
        maxHp: 30,
        kind: "server",
        label: "DB",
        flash: 0,
      },
      {
        id: 2,
        x: 1101,
        y: 1000,
        hp: 30,
        maxHp: 30,
        kind: "repair",
        label: "FIX",
        flash: 0,
      },
    ];
    expect(stepWorld(a, { x: 0, y: 0 }).entities[0].hp).toBeGreaterThan(10);
  });
  it("advances waves and spawns the boss once", () => {
    let a = createWorld();
    a.time = 60 - STEP;
    const b = stepWorld(a, { x: 0, y: 0 });
    expect(wave(b)).toBe(3);
    expect(b.bossSpawned).toBe(true);
    expect(b.entities.filter((e) => e.kind === "boss")).toHaveLength(1);
    a = stepWorld(b, { x: 0, y: 0 });
    expect(a.entities.filter((e) => e.kind === "boss")).toHaveLength(1);
  });
  it("wins at 90 seconds and freezes terminal states", () => {
    const a = createWorld();
    a.time = RUN_SECONDS - STEP / 2;
    const b = stepWorld(a, { x: 0, y: 0 });
    expect(b.phase).toBe("won");
    expect(b.time).toBe(90);
    expect(stepWorld(b, { x: 1, y: 1 })).toBe(b);
  });
  it("loses at zero HP, never allowing negative HP", () => {
    const a = createWorld();
    a.player.hp = 1;
    a.entities = [
      {
        id: 999,
        x: 1000,
        y: 1000,
        hp: 1000,
        maxHp: 1000,
        kind: "boss",
        label: "BOSS",
        flash: 0,
      },
    ];
    const b = stepWorld(a, { x: 0, y: 0 });
    expect(b.phase).toBe("lost");
    expect(b.player.hp).toBe(0);
  });
  it("bounds entities, particles, bullets and loot over long runs", () => {
    for (let seed = 0; seed < 8; seed++) {
      const w = simulate(createWorld(seed), 1800);
      expect(w.entities.length).toBeLessThanOrEqual(100);
      expect(w.shots.length).toBeLessThanOrEqual(120);
      expect(w.effects.length).toBeLessThanOrEqual(100);
      expect(w.pickups.length).toBeLessThanOrEqual(160);
      expect(Number.isFinite(w.score)).toBe(true);
      expect(w.entities.every((e) => e.hp >= 0)).toBe(true);
    }
  });
  it("survives unavailable and corrupt storage", () => {
    localStorage.setItem("bad", "{");
    expect(read("bad", 7)).toBe(7);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(read("x", 42)).toBe(42);
    expect(() => write("x", 1)).not.toThrow();
    vi.restoreAllMocks();
  });
});
